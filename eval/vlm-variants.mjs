/**
 * Measures, honestly, whether the "AI-first approach" is really worse.
 *
 * The main run's "VLM only" path used the cheapest model (Flash) with a plain
 * prompt — which is not a FAIR test of an AI-first architecture. Here model
 * strength and prompt quality are varied independently, to see how much each
 * one actually contributes.
 *
 * Pl@ntNet quota is NOT spent — only LLM calls are made.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv, chatCompletion, parseJsonLoose, vlmImageBase64 } from './lib/clients.mjs';
import { binomialMatch, genusMatch, topKMatch } from './lib/match.mjs';
import { llmCost, percentile } from './lib/cost.mjs';

const DIR = import.meta.dirname;

const SIMPLE_PROMPT = `Identify the plant in this photo from your own visual knowledge.
Reply with a single JSON object:
{
  "is_plant": boolean,
  "species_latin": string or null,
  "alternatives": string[]
}
Do not invent a species to seem helpful. Reply with only that JSON object.`;

/**
 * Structured botanical reasoning: forces the model to enumerate the
 * distinguishing morphological characters BEFORE naming a species. In
 * fine-grained visual classification this "observe first, decide second"
 * shape usually improves accuracy.
 */
const REASONING_PROMPT = `You are a botanist identifying a plant from a photograph.

Work through it in this order, and put each step in the JSON:
1. observation — describe what you actually SEE: leaf shape, margin (entire/serrate/lobed), arrangement (alternate/opposite/whorled/basal), venation; flower symmetry, petal count, colour, inflorescence type; growth habit (herb/shrub/tree/vine/succulent); any distinctive structures (spines, tendrils, latex, hairs).
2. family — the most likely plant family, based only on those features.
3. genus — the most likely genus within that family.
4. species_latin — the single most likely species binomial. Use null if the features do not narrow it to one species.
5. alternatives — up to 2 other plausible species binomials, best first.

Do NOT skip to a species name from overall impression; let the morphology decide.
Do not invent a species to seem helpful — null is a valid, honest answer.

Reply with a single JSON object with exactly these fields:
{
  "observation": string,
  "family": string,
  "genus": string,
  "is_plant": boolean,
  "species_latin": string or null,
  "alternatives": string[]
}`;

const VARIANTS = [
  { key: 'V1', label: 'Flash + plain prompt', model: 'gemini-2.5-flash', prompt: SIMPLE_PROMPT, maxTokens: 400 },
  { key: 'V2', label: 'Sonnet 4.5 + plain prompt', model: 'claude-sonnet-4.5', prompt: SIMPLE_PROMPT, maxTokens: 400 },
  { key: 'V3', label: 'Sonnet 4.5 + reasoning', model: 'claude-sonnet-4.5', prompt: REASONING_PROMPT, maxTokens: 1200 },
  { key: 'V4', label: 'Flash + reasoning', model: 'gemini-2.5-flash', prompt: REASONING_PROMPT, maxTokens: 1200 },
];

async function main() {
  const env = await loadEnv();
  const csv = await readFile(path.join(DIR, 'dataset.csv'), 'utf8');
  const rows = csv
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => {
      const c = line.match(/"([^"]|"")*"/g).map((x) => x.slice(1, -1).replaceAll('""', '"'));
      return { filename: c[0], truth: c[1] };
    });

  const results = {};
  for (const v of VARIANTS) results[v.key] = { ...v, preds: [], top3: [], lat: [], cost: [], nulls: 0 };

  console.log(`${rows.length} images × ${VARIANTS.length} variants\n`);

  for (const [i, row] of rows.entries()) {
    const b64 = await vlmImageBase64(path.join(DIR, 'photos', row.filename));
    for (const v of VARIANTS) {
      const r = results[v.key];
      try {
        const res = await chatCompletion(env, {
          model: v.model,
          prompt: v.prompt,
          imageBase64: b64,
          maxTokens: v.maxTokens,
        });
        const p = parseJsonLoose(res.content);
        const species = p?.species_latin ?? null;
        if (!species) r.nulls++;
        r.preds.push(species);
        r.top3.push([species, ...(p?.alternatives ?? [])].filter(Boolean));
        r.lat.push(res.latencyMs);
        r.cost.push(llmCost(v.model, res.usage));
      } catch (e) {
        r.preds.push(null);
        r.top3.push([]);
        r.lat.push(0);
        r.cost.push(0);
      }
    }
    process.stdout.write(`\r  ${i + 1}/${rows.length}`);
  }

  console.log('\n');
  const n = rows.length;
  const pct = (x) => `${((x / n) * 100).toFixed(1)}%`;

  const lines = [];
  lines.push('# VLM-only variants — how good can an AI-first approach get?\n');
  lines.push(`Dataset: ${n} images (same as the main run). Pl@ntNet was not used.\n`);
  lines.push('| Varyant | top-1 | cins | top-3 | "bilmiyorum" | p50 | maliyet |');
  lines.push('|---|---|---|---|---|---|---|');

  for (const v of VARIANTS) {
    const r = results[v.key];
    const t1 = r.preds.filter((p, i) => binomialMatch(p, rows[i].truth)).length;
    const gen = r.preds.filter((p, i) => genusMatch(p, rows[i].truth)).length;
    const t3 = r.top3.filter((l, i) => topKMatch(l, rows[i].truth, 3)).length;
    const avgCost = r.cost.reduce((a, b) => a + b, 0) / n;
    lines.push(
      `| ${v.label} | ${pct(t1)} | ${pct(gen)} | ${pct(t3)} | ${pct(r.nulls)} | ` +
        `${percentile(r.lat, 50)}ms | $${avgCost.toFixed(5)} |`,
    );
  }

  const md = lines.join('\n') + '\n';
  console.log(md);
  await writeFile(path.join(DIR, 'results-vlm-variants.md'), md, 'utf8');
  console.log('→ wrote eval/results-vlm-variants.md');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
