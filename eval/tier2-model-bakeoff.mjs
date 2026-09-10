/**
 * Tier-2 model bake-off on the REAL vision task.
 *
 * Question: is the strongest model actually the right Tier 2? A reasoning
 * model buys accuracy with latency and with thinking tokens that count
 * toward completion_tokens — and if that budget is set wrong, it truncates
 * mid-JSON and the whole tier silently degrades to null.
 *
 * So this measures the three things that decide the choice together:
 * species accuracy, latency, and completion tokens (cost + truncation risk).
 *
 * Open-ended (no Pl@ntNet candidates supplied) on purpose: that is exactly
 * the situation Tier 2 is asked to rescue — the classifier has failed and
 * the model must name the species itself.
 *
 * Usage: node --experimental-strip-types tier2-model-bakeoff.mjs [n]
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, vlmImageBase64 } from './lib/clients.mjs';

// fileURLToPath, not URL.pathname — this path contains non-ASCII characters
// and pathname leaves them percent-encoded, which sharp cannot open.
const HERE = dirname(fileURLToPath(import.meta.url));

const N = Number(process.argv[2] ?? 10);

/** Override with a comma-separated list as argv[3] to re-test a subset. */
const MODELS = (process.argv[3] ?? 'gemini-2.5-flash,gemini-3-flash-preview,gemini-2.5-pro').split(',');
const MAX_TOKENS = 2400; // headroom for reasoning models; see src/api/eachlabs/llm.ts

const PROMPT = `Identify the plant in this photo. Reply with only a JSON object:
{"species_latin": string — your best Latin binomial guess, or null if you cannot tell,
 "confident": boolean}
No candidate list is provided; this is your own identification.`;

const binomial = (s) => (s ?? '').trim().toLowerCase().split(/\s+/).slice(0, 2).join(' ');
const genus = (s) => (s ?? '').trim().toLowerCase().split(/\s+/)[0] ?? '';

async function call(env, model, imageBase64) {
  const started = Date.now();
  const res = await fetch('https://api.eachlabs.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.EACHLABS_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: MAX_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a strict JSON API. Reply with one JSON object only.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        },
      ],
    }),
  });
  const latencyMs = Date.now() - started;
  if (!res.ok) return { latencyMs, guess: null, tokens: 0, ok: false, finish: `HTTP ${res.status}` };
  const j = await res.json();
  const content = j.choices?.[0]?.message?.content ?? '';
  let guess = null;
  let parsed = true;
  try {
    const s = content.indexOf('{');
    const e = content.lastIndexOf('}');
    guess = JSON.parse(content.slice(s, e + 1)).species_latin ?? null;
  } catch {
    parsed = false;
  }
  return {
    latencyMs,
    guess,
    tokens: j.usage?.completion_tokens ?? 0,
    ok: parsed,
    finish: j.choices?.[0]?.finish_reason,
  };
}

const env = await loadEnv();
const rows = (await readFile(join(HERE, 'dataset.csv'), 'utf8'))
  .trim()
  .split('\n')
  .slice(1)
  .map((l) => l.split('","').map((c) => c.replace(/^"|"$/g, '')))
  .slice(0, N);

const stats = Object.fromEntries(
  MODELS.map((m) => [m, { hit: 0, genusHit: 0, lat: [], tok: [], fail: 0 }]),
);

console.log(`# Tier-2 model bake-off — ${rows.length} images, open-ended identification\n`);

for (const [filename, truth] of rows) {
  const b64 = await vlmImageBase64(join(HERE, 'photos', filename));
  const line = [filename.padEnd(8), truth.padEnd(26)];
  for (const model of MODELS) {
    const r = await call(env, model, b64);
    const s = stats[model];
    if (!r.ok) s.fail++;
    if (binomial(r.guess) === binomial(truth)) s.hit++;
    if (r.guess && genus(r.guess) === genus(truth)) s.genusHit++;
    s.lat.push(r.latencyMs);
    s.tok.push(r.tokens);
    const mark = binomial(r.guess) === binomial(truth) ? '✓' : genus(r.guess) === genus(truth) ? '~' : '✗';
    line.push(`${mark} ${String(r.guess ?? '—').slice(0, 22).padEnd(22)} ${String(r.latencyMs).padStart(6)}ms ${String(r.tokens).padStart(5)}t`);
  }
  console.log(line.join(' | '));
}

const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(`\n| model | tür isabeti | cins isabeti | medyan gecikme | medyan token | parse hatası |`);
console.log(`|---|---|---|---|---|---|`);
for (const m of MODELS) {
  const s = stats[m];
  const n = rows.length;
  console.log(
    `| ${m} | ${((s.hit / n) * 100).toFixed(1)}% | ${((s.genusHit / n) * 100).toFixed(1)}% | ${med(s.lat)}ms | ${med(s.tok)} | ${s.fail}/${n} |`,
  );
}
