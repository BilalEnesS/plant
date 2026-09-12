import { prepare } from '@/services/prepare';
import { resolveProject } from '@/api/plantnet/projects';
import {
  identifyWithPlantNet,
  PlantNetNotAPlantError,
  PlantNetQuotaError,
  PlantNetServiceError,
} from '@/api/plantnet/client';
import { secondOpinion, enrich } from '@/api/eachlabs/llm';
import { bandForScore, resolveBand } from '@/services/confidence';
import { escalationReason } from '@/services/escalation';
import { HttpNetworkError, HttpTimeoutError } from '@/lib/http';
import { fs } from '@/lib/fs';
import { generateId } from '@/lib/id';
import { discoveries, type NewDiscovery } from '@/db/discoveries';
import { useCollectionStore } from '@/store/useCollectionStore';
import { stickerQueue } from '@/services/stickerQueue';
import type {
  Enrichment,
  IdentifiedPlant,
  IdentifyOutcome,
  IdentifyStage,
  Organ,
  PreparedImage,
} from '@/services/types';
import type { Locale } from '@/store/useLocaleStore';

/**
 * Steps 9-10: moves the photo into the permanent photos/ dir, writes the row
 * to SQLite, optimistically adds it to the collection store, and enqueues the
 * sticker (fire-and-forget, not awaited). Both `identify()` `identified`
 * return points call this.
 */
async function persistAndEnqueue(data: Omit<NewDiscovery, 'id' | 'photoUri' | 'createdAt'> & {
  rawPhotoUri: string;
  onStage?: (stage: IdentifyStage) => void;
}): Promise<{ id: string; photoUri: string; isDuplicate: boolean }> {
  data.onStage?.('saving');
  const id = generateId();
  const createdAt = Date.now();
  // Count BEFORE inserting — was this species already in the collection?
  // result.tsx uses this to show a "already in your collection" note. The
  // row is still created (per spec: a repeat species opens a new row, the
  // counter doesn't move) — this is informational only, never a block.
  const isDuplicate = (await discoveries.countBySpecies(data.speciesLatin)) > 0;
  // Permanent copy — prepare()'s cache-dir file can be cleaned up by the OS.
  // result.tsx and the collection screens should always see this one stable
  // path rather than depending on two different file locations.
  const photoUri = await fs.persistPhoto(data.rawPhotoUri, id);

  const record: NewDiscovery = {
    id,
    speciesLatin: data.speciesLatin,
    speciesCommonTr: data.speciesCommonTr,
    confidence: data.confidence,
    confidenceBand: data.confidenceBand,
    photoUri,
    care: data.care,
    toxicToPets: data.toxicToPets,
    toxicityNote: data.toxicityNote,
    alternatives: data.alternatives,
    stickerTraits: data.stickerTraits,
    viaVlmFallback: data.viaVlmFallback,
    lat: data.lat,
    lng: data.lng,
    createdAt,
  };

  await discoveries.insert(record);

  const row = await discoveries.getById(id);
  if (row) useCollectionStore.getState().addOptimistic(row);

  if (data.stickerTraits) {
    stickerQueue.enqueue({ discoveryId: id, speciesLatin: data.speciesLatin, stickerTraits: data.stickerTraits });
  }

  return { id, photoUri, isDuplicate };
}

export interface IdentifyInput {
  /** 1..5 images. The second-photo loop adds the second element. */
  images: Array<{ uri: string; width: number; height: number; organ?: Organ }>;
  attempt?: 1 | 2;
  signal?: AbortSignal;
  /** Stage callback so the UI can show real progress. */
  onStage?: (stage: IdentifyStage) => void;
  /** Language for care text / common name — the UI's active locale. Defaults to 'tr'. */
  locale?: Locale;
}

/**
 * The single entry point. Never throws — every error path is an
 * IdentifyOutcome value. Screens switch on `kind`; TypeScript's exhaustiveness
 * check guarantees the error matrix stays complete at compile time.
 *
 * Before returning `identified`, persistAndEnqueue() saves the photo, writes
 * the SQLite row, adds it to the collection store, and enqueues the sticker
 * (fire-and-forget — sticker generation isn't awaited, the user doesn't wait).
 */
export async function identify(input: IdentifyInput): Promise<IdentifyOutcome> {
  const attempt = input.attempt ?? 1;
  const stage = (s: IdentifyStage) => input.onStage?.(s);
  const prepared: PreparedImage[] = [];

  stage('preparing');

  // Kick off regional-flora resolution IN PARALLEL with image prep (don't await).
  // The two are independent; running them sequentially added dead latency to
  // every scan. Cached for the session after the first call (projects.ts).
  const projectPromise = resolveProject();

  // Blur gate only on the FIRST image. For the second-photo loop's follow-up
  // close-up, the user is already committed to the API call — use that image
  // as-is rather than rejecting it.
  for (let i = 0; i < input.images.length; i++) {
    const raw = input.images[i];
    const outcome = await prepare({
      uri: raw.uri,
      width: raw.width,
      height: raw.height,
      organ: raw.organ,
      skipBlurGate: i > 0,
    });
    if (outcome.kind === 'blurry') {
      return { kind: 'blurry', variance: outcome.variance, threshold: outcome.threshold };
    }
    prepared.push(outcome.image);
  }

  const project = await projectPromise;

  stage('classifying');

  let candidates;
  let remaining: number | null;
  try {
    const result = await identifyWithPlantNet({ images: prepared, project, signal: input.signal });
    candidates = result.candidates;
    remaining = result.remaining;
  } catch (err) {
    // console.log — 404 (no plant) and 429 (quota) are handled, expected
    // states; console.error opens a full-screen error overlay in RN, and this isn't a crash.
    if (__DEV__) {
      const e = err as { name?: string; message?: string; cause?: unknown };
      console.log('[pipeline] plantnet call failed ->', e?.name, e?.message, 'cause:', e?.cause);
    }
    if (err instanceof PlantNetNotAPlantError) return { kind: 'not-a-plant' };
    if (err instanceof PlantNetQuotaError) return { kind: 'error', error: { kind: 'quota' } };
    // Timeout: connection established but the service is slow/unresponsive — a "service" error, not "no internet".
    if (err instanceof HttpTimeoutError || err instanceof PlantNetServiceError) {
      return { kind: 'error', error: { kind: 'service' } };
    }
    // A real connection failure (DNS/TLS/connect failed).
    if (err instanceof HttpNetworkError) {
      return { kind: 'error', error: { kind: 'network' } };
    }
    return { kind: 'error', error: { kind: 'service' } };
  }

  if (__DEV__) {
    console.log('[plantnet] remainingIdentificationRequests =', remaining);
    console.log('[plantnet] candidates =', candidates.slice(0, 3).map((c) => `${c.latin} (${c.score.toFixed(3)})`));
  }

  // Pl@ntNet may return NO candidates at all (candidates.length === 0) — this
  // is treated as a "best candidate" with a score of zero, so all logic below
  // (very-low-score → VLM own-guess) keeps working unchanged.
  const hasNoCandidates = candidates.length === 0;
  const top = hasNoCandidates ? { latin: '', commonNames: [] as string[], score: 0, gbifId: null } : candidates[0];
  const topBand = bandForScore(top.score);

  // The classifier has PRACTICALLY FAILED (no candidates OR score < 5%):
  // Pl@ntNet's candidates may be garbage (e.g. an unrelated grass species for
  // a cactus) or absent entirely. In this case it's worth also asking the VLM
  // for its own independent guess rather than just picking among the (if any)
  // 3 candidates — a general VLM's broad training data can help where the
  // specialist classifier is weak. In the normal low band (5-25%) the VLM
  // still runs, but it is NOT allowed to name its own species there: the
  // classifier's candidates are still usable, so the VLM's job is confirming
  // them, not replacing them.
  const veryLowScore = hasNoCandidates || top.score < 0.05;
  const allowOwnGuess = topBand === 'low' && attempt === 1 && veryLowScore;

  /**
   * NOTE — removed short-circuit: the low band (5-25%) on attempt 1 used to
   * return `needs-second-photo` RIGHT HERE, before the VLM was ever called,
   * as "a deliberate cost saving." It was neither a saving nor correct.
   *
   * `resolveBand` can lift a low-band score to 'medium' when both tiers
   * independently confirm the same species — and that is by far the most
   * common escalation trigger in the eval (`low-score-but-vlm-confident`,
   * 7 of 9 escalations). Returning before the VLM ran made that upgrade
   * UNREACHABLE on attempt 1, so every 5-25% scan demanded a second photo
   * no matter how clearly the plant was identifiable.
   *
   * Observed on-device (2026-09-12, Lilium candidum): attempt 1 scored
   * 0.20358 → forced second photo → attempt 2 scored 0.205 (statistically
   * the same picture) → tier 1 'high', tier 2 'high', same species → band
   * upgraded to 'medium' and the result shown. The second photo contributed
   * nothing; the VLM confirmation decided it, and that could have happened
   * on the first.
   *
   * The cost argument was also backwards: the old path spent TWO Pl@ntNet
   * calls, both VLM tiers, three image prepares and one extra user photo to
   * avoid one VLM call. The band gate at the bottom of this function
   * already asks for a second photo when the band really is low after the
   * VLM has had its say — which is the gate the eval measures.
   */

  if (__DEV__) console.log('[pipeline] vlmBase64 length =', prepared[0].vlmBase64.length, 'allowOwnGuess =', allowOwnGuess);

  stage('verifying');

  const locale: Locale = input.locale ?? 'tr';

  const tier1 = await enrich({
    candidates: candidates.slice(0, 3),
    imageBase64: prepared[0].vlmBase64,
    allowOwnGuess,
    locale,
    signal: input.signal,
  });

  if (__DEV__) console.log('[pipeline] tier1 =', tier1);

  // --- Two-tier model routing ---
  // Tier 2 runs ONLY on structural disagreement, never on the model's
  // self-reported confidence (which is poorly calibrated). At most one escalation.
  let enrichment = tier1;
  let tier2Agreement: Enrichment['visualAgreement'] | null = null;
  let tiersAgreeOnSpecies = false;
  const escalation = escalationReason(tier1, topBand, hasNoCandidates);

  if (escalation) {
    if (__DEV__) console.log('[pipeline] tier2 escalation ->', escalation);
    stage('adjudicating');
    // Tier 1's verdict is deliberately NOT passed: Tier 2 is an independent
    // second reading, and anchoring it on the first would make their
    // agreement — which confidence.ts treats as upgrade evidence — mostly
    // self-confirmation. See buildSecondOpinionPrompt.
    const tier2 = await secondOpinion({
      candidates: candidates.slice(0, 3),
      imageBase64: prepared[0].vlmBase64,
      allowOwnGuess: true, // the second opinion must always be able to name its own species
      locale,
      signal: input.signal,
    });
    // If Tier 2 fails, keep Tier 1's result — an escalation failure never drops the identification.
    if (tier2) {
      enrichment = tier2;
      tier2Agreement = tier2.visualAgreement;
      // Agreement has to be about the species we will ACTUALLY SHOW. In the
      // very-low-score regime that is the models' own guess; otherwise it is
      // Pl@ntNet's top-1 (index 0), and two tiers pointing elsewhere is a
      // challenge to the shown result, not a confirmation of it.
      //
      // This used to key off `hasNoCandidates`, which was too narrow: when
      // Pl@ntNet returned junk candidates (0.3%) and BOTH tiers rejected them
      // and named the exact same species, the else-branch compared indices,
      // saw -1 !== 0, and scored a perfect agreement as a disagreement.
      tiersAgreeOnSpecies = veryLowScore
        ? Boolean(tier1?.ownGuessLatin && tier1.ownGuessLatin === tier2.ownGuessLatin)
        : tier1?.bestMatchIndex === 0 && tier2.bestMatchIndex === 0;
      if (__DEV__) {
        console.log('[pipeline] tier2 =', tier2, 'agreeOnSpecies =', tiersAgreeOnSpecies);
      }
    }
  }

  // The "not a plant" verdict now comes from the FINAL model. If Tier 1
  // rejected and Tier 2 overrode it (trigger F), Tier 2 wins — measurement
  // showed Tier 2 is more reliable on this call (0/36 false rejections).
  if (enrichment?.isPlant === false) {
    if (__DEV__) console.log('[pipeline] not-a-plant: VLM isPlant=false (final)');
    return { kind: 'not-a-plant' };
  }

  /**
   * The VLM's own guess becomes the species name only where the classifier
   * has PRACTICALLY FAILED — the same `veryLowScore` bar that made us ask
   * for that guess in the first place (`allowOwnGuess`). Above that bar the
   * species still always comes from Pl@ntNet; the VLM never re-ranks.
   *
   * Measured (eval/results.md): letting the VLM override Pl@ntNet at ANY
   * score broke 3 correct identifications to fix 1 (net −2), dropping top-1
   * from 63.9% to 58.3% — the VLM alone is only 22.2% accurate at species
   * level. So the override stays closed in the normal regime.
   *
   * But the gate used to be `hasNoCandidates`, which asked "are there
   * candidates?" instead of "are the candidates usable?". When Pl@ntNet
   * returned two unrelated species at 0.3%, the pipeline requested an
   * independent guess and then discarded the answer — a contradiction that
   * left a correctly-identified plant in an endless second-photo loop
   * (device log, 2026-09-10: Gazania rigens, both tiers agreeing).
   *
   * Eval path F measures this exact policy at 63.9% / 83.3% / 72.2% —
   * identical to E, i.e. no regression. It is NOT positive evidence: only
   * 1 of the 36 GBIF images falls below 5%, and that one has zero
   * candidates, so the rescue branch never fires there. The GBIF set is
   * drawn from imagery Pl@ntNet handles well; the phone-camera garden
   * flower that motivated this is exactly the gap it doesn't cover.
   */
  const usingOwnGuess = Boolean(veryLowScore && enrichment && enrichment.ownGuessLatin);

  if (usingOwnGuess && enrichment) {
    // No Pl@ntNet confirmation — band is pinned to 'medium' (never 'high'),
    // and the user is told explicitly this is the VLM's own guess (result.tsx).
    const speciesLatin = enrichment.ownGuessLatin as string;
    const speciesCommonTr = enrichment.speciesCommonTr || null;
    const { id, photoUri, isDuplicate } = await persistAndEnqueue({
      onStage: input.onStage,
      rawPhotoUri: prepared[0].uri,
      speciesLatin,
      speciesCommonTr,
      confidence: top.score,
      confidenceBand: 'medium',
      care: enrichment.care ?? null,
      toxicToPets: enrichment.toxicToPets ?? null,
      toxicityNote: enrichment.toxicityNote ?? null,
      alternatives: candidates,
      stickerTraits: enrichment.stickerTraits ?? null,
      viaVlmFallback: true,
      lat: null,
      lng: null,
    });

    const plant: IdentifiedPlant = {
      id,
      speciesLatin,
      speciesCommonTr,
      photoUri,
      confidence: top.score,
      confidenceBand: 'medium',
      bandDowngraded: false,
      viaVlmFallback: true,
      isDuplicate,
      care: enrichment.care ?? null,
      toxicToPets: enrichment.toxicToPets ?? null,
      toxicityNote: enrichment.toxicityNote ?? null,
      alternatives: candidates,
      stickerTraits: enrichment.stickerTraits ?? null,
    };
    return { kind: 'identified', plant };
  }

  if (veryLowScore && attempt === 1) {
    // The VLM didn't give (or wasn't confident in) its own guess either — fall to the second-photo loop.
    if (__DEV__) console.log('[pipeline] needs-second-photo: VLM did not provide an own-guess');
    return { kind: 'needs-second-photo', session: { images: prepared, attempt: 1 } };
  }

  const { band, downgraded, upgraded } = resolveBand({
    score: top.score,
    tier1Agreement: tier1?.visualAgreement ?? null,
    tier2Agreement,
    tiersAgreeOnSpecies,
  });

  if (__DEV__) {
    console.log('[pipeline] band =', band, 'downgraded =', downgraded, 'upgraded =', upgraded);
  }

  if (band === 'low') {
    if (attempt === 1) {
      return { kind: 'needs-second-photo', session: { images: prepared, attempt: 1 } };
    }
    // attempt === 2: don't loop again (capped at two), and NEVER show a species name in this band.
    return { kind: 'low-confidence-exhausted' };
  }

  /**
   * The species name ALWAYS comes from Pl@ntNet's top-1. The VLM never re-ranks.
   *
   * This line used to read `enrichment.bestMatchIndex`. Measurement
   * (eval/results.md) showed re-ranking was a net loss: cross-genus
   * overrides were catastrophically wrong (Phacelia → Heuchera,
   * Vachellia → Taxodium), and within-genus it was a coin flip. We leave
   * the classifier's ranking untouched; the VLM's contribution is the
   * confidence band and the enrichment content.
   */
  const bestIndex = 0;
  const best = candidates[bestIndex];
  const alternatives = candidates.filter((_, i) => i !== bestIndex);
  const speciesLatin = best.latin;
  const speciesCommonTr = enrichment?.speciesCommonTr || best.commonNames[0] || null;

  const { id, photoUri, isDuplicate } = await persistAndEnqueue({
    onStage: input.onStage,
    rawPhotoUri: prepared[0].uri,
    speciesLatin,
    speciesCommonTr,
    confidence: top.score,
    confidenceBand: band,
    care: enrichment?.care ?? null,
    toxicToPets: enrichment?.toxicToPets ?? null,
    toxicityNote: enrichment?.toxicityNote ?? null,
    alternatives,
    stickerTraits: enrichment?.stickerTraits ?? null,
    viaVlmFallback: false,
    lat: null,
    lng: null,
  });

  const plant: IdentifiedPlant = {
    id,
    speciesLatin,
    speciesCommonTr,
    photoUri,
    confidence: top.score,
    confidenceBand: band,
    bandDowngraded: downgraded,
    viaVlmFallback: false,
    isDuplicate,
    care: enrichment?.care ?? null,
    toxicToPets: enrichment?.toxicToPets ?? null,
    toxicityNote: enrichment?.toxicityNote ?? null,
    alternatives,
    stickerTraits: enrichment?.stickerTraits ?? null,
  };

  return { kind: 'identified', plant };
}
