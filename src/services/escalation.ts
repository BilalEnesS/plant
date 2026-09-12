import type { ConfidenceBand, VisualAgreement } from '@/services/types';

/**
 * The minimum a Tier-1 response has to expose for the routing decision.
 * `Enrichment` satisfies this structurally, so pipeline.ts passes its parsed
 * result straight in; the eval maps its raw snake_case JSON onto the same
 * shape. That is the point of this module existing at all — see below.
 */
export interface EscalationSignals {
  isPlant: boolean;
  visualAgreement: VisualAgreement;
}

export type EscalationTrigger =
  | 'tier1-unparseable'
  | 'tier1-says-not-a-plant'
  | 'no-classifier-candidates'
  | 'score-vs-agreement-conflict'
  | 'low-score-but-vlm-confident';

/**
 * Decides whether to escalate to Tier 2 (the strong adjudicator model).
 *
 * Every trigger is an OBSERVABLE signal, never the model's self-reported
 * confidence (LLM self-reports are poorly calibrated). Instead it looks for
 * structural disagreement between the two independent sources — the
 * classifier and the VLM — which is the architecture's key design point.
 *
 * Returns null when no escalation is needed: Tier 1 alone covers most cases,
 * so cost and latency are not spent by default.
 *
 * WHY THIS IS ITS OWN MODULE: eval/run.mjs used to carry a hand-maintained
 * copy of this function, because pipeline.ts cannot be imported from Node —
 * it pulls in React Native. The copy drifted at least once (it cancelled
 * escalation on "not a plant", where the app wants a second opinion, and
 * still carried a trigger measurement had already removed). Everything here
 * is pure, so both the app and the eval now import the same code and the
 * measured policy cannot diverge from the shipped one.
 */
export function escalationReason(
  tier1: EscalationSignals | null,
  topBand: ConfidenceBand,
  hasNoCandidates: boolean,
): EscalationTrigger | null {
  // Tier 1's response could not be parsed at all — the stronger model may
  // produce better JSON.
  if (!tier1) return 'tier1-unparseable';

  // If Tier 1 says "not a plant", get a SECOND OPINION instead of rejecting
  // outright. Measured (eval/results.md, 36 GBIF images): Tier 1 wrongly
  // rejected a real fern (1/36 false rejections), Tier 2 had zero. A
  // rejection shows the user nothing — the most expensive failure mode — so
  // a second opinion is worth the cost.
  if (!tier1.isPlant) return 'tier1-says-not-a-plant';

  // Pl@ntNet produced no candidates at all: the VLM is the only support, so
  // don't leave it unchecked. This is the only case where the species name
  // may come from the VLM itself.
  if (hasNoCandidates) return 'no-classifier-candidates';

  // Pl@ntNet was reasonably confident but the VLM found low visual
  // agreement — a real conflict. This only affects the BAND, never the name.
  if (topBand !== 'low' && tier1.visualAgreement === 'low') return 'score-vs-agreement-conflict';

  // Pl@ntNet is in the low band but the VLM strongly confirms — a
  // band-upgrade candidate. Tier 1's confirmation alone is not enough: it saw
  // the candidate list, so its "high" carries a sycophancy risk. A second,
  // independent confirmation is required (see confidence.ts).
  if (topBand === 'low' && tier1.visualAgreement === 'high') {
    return 'low-score-but-vlm-confident';
  }

  // NOTE — removed trigger: `bestMatchIndex === -1` ("the VLM rejected all
  // candidates") used to escalate and let the VLM's own guess become the
  // species name. Measurement showed this was HARMFUL: the VLM alone is only
  // ~22% accurate at species level vs. Pl@ntNet's ~64%. Letting it override
  // broke 3 correct calls and fixed 1 (net −2). The species name now ALWAYS
  // comes from Pl@ntNet when candidates exist.
  return null;
}
