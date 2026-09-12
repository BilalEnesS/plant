/**
 * The eval's API clients. Request shapes must stay IDENTICAL to the app's,
 * (src/api/plantnet/client.ts ve src/api/eachlabs/llm.ts) — aksi halde
 * otherwise the measurement does not represent the shipped behaviour.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.join(import.meta.dirname, '..', '..');

/** Read .env by hand — the eval is independent of the app and its expo config. */
export async function loadEnv() {
  const raw = await readFile(path.join(ROOT, '.env'), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].trim();
  }
  if (!env.PLANTNET_API_KEY || !env.EACHLABS_API_KEY) {
    throw new Error('.env must define PLANTNET_API_KEY and EACHLABS_API_KEY');
  }
  return env;
}

// The same models as the app (src/api/eachlabs/llm.ts).
export const TIER1_MODEL = 'gemini-2.5-flash';
export const TIER2_MODEL = 'gemini-3-flash-preview';

/** Identical to what the app sends the VLM: 768px long edge, JPEG q70, base64. */
export async function vlmImageBase64(filePath) {
  const buf = await sharp(filePath)
    .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer();
  return buf.toString('base64');
}

export async function callPlantNet(env, filePath, { project = 'all', nbResults = 5 } = {}) {
  const form = new FormData();
  const buf = await readFile(filePath);
  form.append('images', new Blob([buf], { type: 'image/jpeg' }), path.basename(filePath));
  form.append('organs', 'auto');

  const url =
    `https://my-api.plantnet.org/v2/identify/${project}` +
    `?api-key=${env.PLANTNET_API_KEY}&nb-results=${nbResults}&lang=tr`;

  const started = Date.now();
  const res = await fetch(url, { method: 'POST', body: form });
  const latencyMs = Date.now() - started;

  if (res.status === 404) return { candidates: [], latencyMs, notAPlant: true, remaining: null };
  if (!res.ok) throw new Error(`PlantNet ${res.status}`);

  const data = await res.json();
  return {
    latencyMs,
    notAPlant: false,
    remaining: data.remainingIdentificationRequests ?? null,
    candidates: (data.results ?? []).map((r) => ({
      latin: r.species.scientificNameWithoutAuthor,
      commonNames: r.species.commonNames ?? [],
      score: r.score,
    })),
  };
}

async function chatCompletion(env, { model, prompt, imageBase64, maxTokens = 900 }) {
  const started = Date.now();
  const res = await fetch('https://api.eachlabs.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.EACHLABS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a strict JSON API for plant identification cross-validation. ' +
            'Reply with only a single valid JSON object, no markdown fences, no commentary.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        },
      ],
    }),
  });
  const latencyMs = Date.now() - started;
  if (!res.ok) throw new Error(`EachLabs ${model} ${res.status}`);
  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    usage: data.usage ?? {},
    latencyMs,
  };
}

export { chatCompletion };

/** Defensive parse against fences/chatter from the model — same approach as the app. */
export function parseJsonLoose(raw) {
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return null;
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}
