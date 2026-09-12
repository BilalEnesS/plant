/**
 * Evaluation runner — compares six paths over the same data.
 *
 *   A  plantnet    Specialist classifier only (its top-1 candidate)
 *   B  vlm         VLM only, open-ended "what plant is this?" (NO candidate list)
 *   C  hybrid      Pl@ntNet + Tier-1 cross-validation (NO cascade)
 *   D  cascade     C + a Tier-2 adjudicator on disagreement
 *   E  conservative  C, but the VLM never re-ranks the species
 *   F  rescue      E + own-guess rescue when the candidates are unusable  ← shipped
 *
 * DESIGN DECISION — every API is called ONCE per image and all six paths are
 * derived from the same raw responses. Three benefits: (1) it protects
 * Pl@ntNet's free 500/day quota, (2) it guarantees the difference between
 * paths comes from the ARCHITECTURE rather than model variance, (3) it makes
 * the run fast.
 *
 * The confidence policy is imported from the app's REAL confidence.ts rather
 * than copied, so the measured behaviour and the shipped behaviour cannot
 * drift apart.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  loadEnv,
  callPlantNet,
  chatCompletion,
  parseJsonLoose,
  vlmImageBase64,
  TIER1_MODEL,
  TIER2_MODEL,
} from './lib/clients.mjs';
import { binomialMatch, genusMatch, topKMatch } from './lib/match.mjs';
import { llmCost, percentile, PLANTNET_PAID_PER_CALL } from './lib/cost.mjs';

// The app's real confidence policy (via Node --experimental-strip-types).
const confidence = await import(
  new URL('../src/services/confidence.ts', import.meta.url).href
);

/**
 * The app's REAL escalation policy. It used to be a hand-maintained copy in
 * this file — pipeline.ts cannot be imported here because it pulls in React
 * Native — and that copy had already drifted once. The routing logic now
 * lives in its own dependency-free module that both sides import, so the
 * measured policy and the shipped policy cannot diverge.
 */
const { escalationReason } = await import(
  new URL('../src/services/escalation.ts', import.meta.url).href
);

/** Maps a raw Tier-1 JSON response onto the shape escalationReason expects. */
function escalationSignals(parsed) {
  if (!parsed) return null;
  return { isPlant: parsed.is_plant !== false, visualAgreement: parsed.visual_agreement };
}

/**
 * The app's REAL prompts. This file used to carry its own copies, which was a
 * silent source of drift — when a prompt changed in the app the eval kept
 * measuring the old one, and the numbers described a system that was never
 * shipped. Same pattern as confidence.ts: one source, no copies.
 */
const prompts = await import(new URL('../src/services/prompt.ts', import.meta.url).href);

const DIR = import.meta.dirname;

const OPEN_ENDED_PROMPT = `Identify the plant in this photo from your own visual knowledge.
Reply with a single JSON object:
{
  "is_plant": boolean,
  "species_latin": string or null — the Latin binomial; null if you cannot identify it confidently,
  "alternatives": string[] — up to 2 additional plausible Latin binomials, best first
}
Do not invent a species to seem helpful. Reply with only that JSON object.`;

/** Derive the final species from a VLM response (a picked candidate, or its own guess). */
function resolveSpecies(vlm, candidates) {
  if (!vlm) return candidates[0]?.latin ?? null;
  if (vlm.best_match_index === -1) return vlm.own_guess_latin ?? null;
  const idx = Number.isInteger(vlm.best_match_index) ? vlm.best_match_index : 0;
  return candidates[idx]?.latin ?? candidates[0]?.latin ?? null;
}

/**
 * --replay: reuse the previous run's raw responses without calling any API.
 * Lets policy variants ("which path is better?") be tried without burning
 * Pl@ntNet's 500/day quota and without model variance entering the picture.
 */
const REPLAY = process.argv.includes('--replay');
const RAW_PATH = path.join(import.meta.dirname, 'results-raw.json');

async function main() {
  if (REPLAY) {
    const raw = JSON.parse(await readFile(RAW_PATH, 'utf8'));
    console.log(`--replay: ${raw.length} records read from disk (no API calls)\n`);
    report(raw);
    return;
  }

  const env = await loadEnv();
  const csv = await readFile(path.join(DIR, 'dataset.csv'), 'utf8');
  const rows = csv
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => {
      const cells = line.match(/"([^"]|"")*"/g).map((c) => c.slice(1, -1).replaceAll('""', '"'));
      return { filename: cells[0], truth: cells[1] };
    });

  console.log(`Evaluating ${rows.length} images…\n`);

  const records = [];

  for (const [i, row] of rows.entries()) {
    const file = path.join(DIR, 'photos', row.filename);
    const rec = { ...row, errors: [] };

    try {
      const b64 = await vlmImageBase64(file);

      // --- 1) Pl@ntNet (shared by A, C, D, E, F) ---
      const pn = await callPlantNet(env, file);
      rec.plantnet = pn;

      // --- 2) Open-ended VLM (B only) ---
      try {
        const r = await chatCompletion(env, {
          model: TIER1_MODEL,
          prompt: OPEN_ENDED_PROMPT,
          imageBase64: b64,
          maxTokens: 400,
        });
        rec.openEnded = { parsed: parseJsonLoose(r.content), usage: r.usage, latencyMs: r.latencyMs };
      } catch (e) {
        rec.errors.push(`openEnded: ${e.message}`);
      }

      // --- 3) Tier-1 cross-validation VLM (shared by C, D, E, F) ---
      // allowOwnGuess matches the app's condition exactly (pipeline.ts): when
      // the classifier has practically failed (no candidates OR top-1 < 5%),
      // an independent guess is requested from the VLM.
      const veryLowScore = pn.candidates.length === 0 || (pn.candidates[0]?.score ?? 0) < 0.05;
      try {
        const r = await chatCompletion(env, {
          model: TIER1_MODEL,
          prompt: prompts.buildVlmUserPrompt(pn.candidates, veryLowScore, 'tr'),
          imageBase64: b64,
        });
        rec.tier1 = { parsed: parseJsonLoose(r.content), usage: r.usage, latencyMs: r.latencyMs };
      } catch (e) {
        rec.errors.push(`tier1: ${e.message}`);
      }

      // --- 4) Tier-2 adjudicator (D onwards, only when a trigger fires) ---
      const topScore = pn.candidates[0]?.score ?? 0;
      const reason = escalationReason(
        escalationSignals(rec.tier1?.parsed ?? null),
        confidence.bandForScore(topScore),
        pn.candidates.length === 0,
      );
      rec.escalationReason = reason;
      if (reason) {
        try {
          const r = await chatCompletion(env, {
            model: TIER2_MODEL,
            // Tier 1's answer is DELIBERATELY withheld — an independent second reading.
            prompt: prompts.buildSecondOpinionPrompt(pn.candidates, true, 'tr'),
            imageBase64: b64,
            // Mirrors TIER2_MAX_TOKENS in src/api/eachlabs/llm.ts.
            maxTokens: 1200,
          });
          rec.tier2 = { parsed: parseJsonLoose(r.content), usage: r.usage, latencyMs: r.latencyMs };
        } catch (e) {
          rec.errors.push(`tier2: ${e.message}`);
        }
      }

      process.stdout.write(
        `\r  ${i + 1}/${rows.length}  quota:${pn.remaining ?? '?'}  ${reason ? 'escalated' : '         '}`,
      );
    } catch (e) {
      rec.errors.push(`fatal: ${e.message}`);
      console.warn(`\n  skipped ${row.filename}: ${e.message}`);
    }

    records.push(rec);
  }

  console.log('\n');
  // Keep the raw responses — policy variants can now be tried for free via --replay.
  await writeFile(RAW_PATH, JSON.stringify(records, null, 2), 'utf8');
  report(records);
}

function report(records) {
  const paths = {
    A_plantnet: { label: 'A · Pl@ntNet only', preds: [], top3: [], lat: [], cost: [] },
    B_vlm: { label: 'B · VLM only', preds: [], top3: [], lat: [], cost: [] },
    C_hybrid: { label: 'C · hybrid (Tier-1 re-ranks)', preds: [], top3: [], lat: [], cost: [] },
    D_cascade: { label: 'D · cascade (Tier-2 adjudicator)', preds: [], top3: [], lat: [], cost: [] },
    E_conservative: { label: 'E · conservative hybrid', preds: [], top3: [], lat: [], cost: [] },
    F_rescue: { label: 'F · conservative + junk-candidate rescue', preds: [], top3: [], lat: [], cost: [] },
  };

  let escalated = 0;
  let tier1ParseFail = 0;
  let tier2Rescued = 0;

  for (const r of records) {
    const cands = r.plantnet?.candidates ?? [];
    const pnLat = r.plantnet?.latencyMs ?? 0;
    const pnCost = PLANTNET_PAID_PER_CALL;

    // A — Pl@ntNet top-1
    paths.A_plantnet.preds.push(cands[0]?.latin ?? null);
    paths.A_plantnet.top3.push(cands.slice(0, 3).map((c) => c.latin));
    paths.A_plantnet.lat.push(pnLat);
    paths.A_plantnet.cost.push(pnCost);

    // B — open-ended VLM
    const oe = r.openEnded?.parsed;
    paths.B_vlm.preds.push(oe?.species_latin ?? null);
    paths.B_vlm.top3.push([oe?.species_latin, ...(oe?.alternatives ?? [])].filter(Boolean));
    paths.B_vlm.lat.push(r.openEnded?.latencyMs ?? 0);
    paths.B_vlm.cost.push(llmCost(TIER1_MODEL, r.openEnded?.usage));

    // C — hybrid, Tier-1
    const t1 = r.tier1?.parsed ?? null;
    if (!t1) tier1ParseFail++;
    paths.C_hybrid.preds.push(resolveSpecies(t1, cands));
    paths.C_hybrid.top3.push(cands.slice(0, 3).map((c) => c.latin));
    paths.C_hybrid.lat.push(pnLat + (r.tier1?.latencyMs ?? 0));
    paths.C_hybrid.cost.push(pnCost + llmCost(TIER1_MODEL, r.tier1?.usage));

    // D — cascade
    const t2 = r.tier2?.parsed ?? null;
    const finalVlm = t2 ?? t1;
    const dPred = resolveSpecies(finalVlm, cands);
    paths.D_cascade.preds.push(dPred);
    paths.D_cascade.top3.push(cands.slice(0, 3).map((c) => c.latin));
    paths.D_cascade.lat.push(pnLat + (r.tier1?.latencyMs ?? 0) + (r.tier2?.latencyMs ?? 0));
    paths.D_cascade.cost.push(
      pnCost + llmCost(TIER1_MODEL, r.tier1?.usage) + llmCost(TIER2_MODEL, r.tier2?.usage),
    );

    // E — CONSERVATIVE HYBRID (the design the measurement argues for)
    //
    // The VLM does NOT pick the species. Measurement showed it is weak at
    // species level on its own (22%); letting it override Pl@ntNet's top-1
    // lowers accuracy (it broke 3 correct calls to fix 1). So here:
    //   - the species NAME always comes from Pl@ntNet's top-1 (when there are candidates)
    //   - the VLM is used only for (a) the "not a plant" gate, (b) lowering the
    //     confidence band, (c) enrichment (care text / common name / sticker traits)
    //   - its own guess is allowed ONLY when Pl@ntNet produced no candidate at all
    const finalForE = t2 ?? t1;
    let ePred;
    if (cands.length > 0) {
      ePred = cands[0].latin; // trust the specialist classifier
    } else {
      ePred = finalForE?.own_guess_latin ?? null; // the VLM is the only support
    }
    // The "not a plant" gate is preserved — show nothing rather than a wrong species
    if (finalForE?.is_plant === false) ePred = null;
    paths.E_conservative.preds.push(ePred);
    paths.E_conservative.top3.push(cands.slice(0, 3).map((c) => c.latin));
    paths.E_conservative.lat.push(pnLat + (r.tier1?.latencyMs ?? 0));
    paths.E_conservative.cost.push(pnCost + llmCost(TIER1_MODEL, r.tier1?.usage));

    // F — E + "junk candidate" rescue
    //
    // E's blind spot: it asks "are there candidates?" rather than "are the
    // candidates usable?". When Pl@ntNet returns two unrelated species at
    // 0.3%, E counts that as "there are candidates" and DISCARDS the VLM's own
    // guess — even though the pipeline explicitly ASKED for that guess moments
    // earlier (allowOwnGuess is true below 5%). Requesting an answer and then
    // refusing it is incoherent; on-device it left a correctly identified
    // Gazania stuck in an endless "second photo" loop.
    //
    // F opens the rescue only at the threshold where the classifier has
    // PRACTICALLY FAILED (top-1 < 5%). This is not D's unbounded override:
    // above 5% the species name still ALWAYS comes from Pl@ntNet.
    const RESCUE_BELOW = 0.05;
    const topScore = cands[0]?.score ?? 0;
    let fPred;
    if (cands.length > 0 && topScore >= RESCUE_BELOW) {
      fPred = cands[0].latin;
    } else {
      fPred = finalForE?.own_guess_latin ?? cands[0]?.latin ?? null;
    }
    if (finalForE?.is_plant === false) fPred = null;
    paths.F_rescue.preds.push(fPred);
    paths.F_rescue.top3.push(cands.slice(0, 3).map((c) => c.latin));
    paths.F_rescue.lat.push(pnLat + (r.tier1?.latencyMs ?? 0));
    paths.F_rescue.cost.push(pnCost + llmCost(TIER1_MODEL, r.tier1?.usage));

    if (r.escalationReason) escalated++;
    // Count the cases where Tier-2 corrected a Tier-1 mistake
    const cPred = resolveSpecies(t1, cands);
    if (t2 && !binomialMatch(cPred, r.truth) && binomialMatch(dPred, r.truth)) tier2Rescued++;
  }

  const n = records.length;
  const pct = (x) => `${((x / n) * 100).toFixed(1)}%`;

  const lines = [];
  lines.push(`# Plantie — Measurement Results\n`);
  lines.push(`Dataset: ${n} images, GBIF CC0, expert-verified species names.`);
  // A --replay render is NOT a new measurement: the API calls happened on
  // the original run. Saying so keeps the timestamp from implying fresh data.
  lines.push(
    REPLAY
      ? `Report rendered: ${new Date().toISOString()} (--replay over cached raw responses, no new API calls)`
      : `Run: ${new Date().toISOString()}`,
  );
  lines.push('');
  lines.push(`| Path | top-1 (binomial) | top-1 (genus) | top-3 | p50 latency | p95 latency | cost/identification |`);
  lines.push(`|---|---|---|---|---|---|---|`);

  for (const key of Object.keys(paths)) {
    const p = paths[key];
    const t1b = p.preds.filter((pred, i) => binomialMatch(pred, records[i].truth)).length;
    const t1g = p.preds.filter((pred, i) => genusMatch(pred, records[i].truth)).length;
    const t3 = p.top3.filter((list, i) => topKMatch(list, records[i].truth, 3)).length;
    const avgCost = p.cost.reduce((a, b) => a + b, 0) / n;
    lines.push(
      `| ${p.label} | ${pct(t1b)} | ${pct(t1g)} | ${pct(t3)} | ` +
        `${percentile(p.lat, 50)}ms | ${percentile(p.lat, 95)}ms | $${avgCost.toFixed(5)} |`,
    );
  }

  lines.push(`\n## Cascade behaviour\n`);
  lines.push(`- Identifications escalated to Tier-2: **${escalated}/${n}** (${pct(escalated)})`);
  lines.push(`- Cases where Tier-2 corrected Tier-1: **${tier2Rescued}**`);
  lines.push(`- Tier-1 JSON parse failures: **${tier1ParseFail}/${n}**`);

  const reasons = {};
  for (const r of records) if (r.escalationReason) reasons[r.escalationReason] = (reasons[r.escalationReason] ?? 0) + 1;
  if (Object.keys(reasons).length) {
    lines.push(`\nTrigger distribution:\n`);
    for (const [k, v] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) lines.push(`- \`${k}\`: ${v}`);
  }

  const md = lines.join('\n') + '\n';
  console.log(md);

  writeFile(path.join(DIR, 'results.md'), md, 'utf8');

  const csvOut = [
    'filename,truth,A_plantnet,B_vlm,C_hybrid,D_cascade,escalation_reason',
    ...records.map((r, i) =>
      [
        r.filename,
        r.truth,
        paths.A_plantnet.preds[i] ?? '',
        paths.B_vlm.preds[i] ?? '',
        paths.C_hybrid.preds[i] ?? '',
        paths.D_cascade.preds[i] ?? '',
        r.escalationReason ?? '',
      ]
        .map((c) => `"${String(c).replaceAll('"', '""')}"`)
        .join(','),
    ),
  ].join('\n');
  writeFile(path.join(DIR, 'results.csv'), csvOut + '\n', 'utf8');

  console.log('→ wrote eval/results.md and eval/results.csv');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
