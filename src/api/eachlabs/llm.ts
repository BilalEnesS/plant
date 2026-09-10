import { eachlabsPost } from '@/api/eachlabs/http';
import {
  buildSecondOpinionPrompt,
  buildVlmUserPrompt,
  parseStrictJson,
  VLM_SYSTEM_PROMPT,
} from '@/services/prompt';
import type { Candidate, Enrichment } from '@/services/types';
import type { Locale } from '@/store/useLocaleStore';

/**
 * Two-tier model routing. Trigger logic lives in pipeline.ts
 * (escalationReason) — based on OBSERVABLE disagreement between Pl@ntNet and
 * the VLM, never the model's own self-reported confidence, which is poorly
 * calibrated.
 *
 * Tier 2 was picked by measurement, not by reputation. Open-ended species
 * identification over the full 36-image GBIF set
 * (eval/tier2-model-bakeoff.mjs, 2026-09-10):
 *
 *   model                    species   genus   median latency   tokens
 *   gemini-2.5-flash          22.2%    38.9%      1501ms          18
 *   gemini-3-flash-preview    44.4%    75.0%      1914ms          23
 *   gemini-2.5-pro            16.7%    16.7%     10978ms         845   (12-image subset)
 *
 * The obvious pick — the "pro" model — turned out to be the worst option on
 * every axis at once: no better at the task, ~6x slower, and ~37x the output
 * tokens because its reasoning counts toward completion_tokens. It also
 * truncated mid-JSON at the shared 900-token budget, which would have made
 * every escalation silently parse to null. gemini-3-flash-preview doubles
 * species accuracy over Tier 1 for +413ms and stays cheap to parse.
 */
const VLM_MODEL_TIER1 = 'gemini-2.5-flash';
const VLM_MODEL_TIER2 = 'gemini-3-flash-preview';

/**
 * Per-tier budgets. Tier 2 gets headroom because its schema has an extra
 * `observed_characters` field it must fill in before naming anything — not
 * because the model needs room to think: the measurement above showed no
 * reasoning-token overhead for it (23 tokens on the bake-off schema).
 */
const TIER1_MAX_TOKENS = 900;
const TIER2_MAX_TOKENS = 1200;

/** For the README's measurement section — counts how many identifications escalated. */
export const routerStats = { tier1Calls: 0, tier2Calls: 0 };

interface ChatCompletionResponse {
  choices: Array<{ message: { content: string } }>;
}

interface EnrichArgs {
  candidates: Candidate[];
  imageBase64: string;
  /** true: Pl@ntNet's score was very low, allow the VLM's own independent guess. */
  allowOwnGuess?: boolean;
  /** Language for care text / common name. Defaults to 'tr'. */
  locale?: Locale;
  signal?: AbortSignal;
}

async function callVlm(
  model: string,
  prompt: string,
  imageBase64: string,
  opts: { maxTokens: number; timeoutMs: number },
  signal?: AbortSignal,
): Promise<Enrichment | null> {
  const response = await eachlabsPost<ChatCompletionResponse>(
    '/chat/completions',
    {
      model,
      temperature: 0.2,
      max_tokens: opts.maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: VLM_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        },
      ],
    },
    { timeoutMs: opts.timeoutMs, signal },
  );

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    if (__DEV__) console.log(`[vlm:${model}] boş içerik`);
    return null;
  }

  const parsed = parseStrictJson(content);
  if (__DEV__ && !parsed) console.log(`[vlm:${model}] parse edilemedi, ham içerik:`, content);
  return parsed;
}

/**
 * Tier 1 — runs on every identification. Never throws; returns null for any
 * error or unparseable response. An enrichment failure NEVER drops the
 * identification; the caller keeps showing the result without care info.
 */
export async function enrich(args: EnrichArgs): Promise<Enrichment | null> {
  routerStats.tier1Calls++;
  try {
    return await callVlm(
      VLM_MODEL_TIER1,
      buildVlmUserPrompt(args.candidates, args.allowOwnGuess, args.locale ?? 'tr'),
      args.imageBase64,
      { maxTokens: TIER1_MAX_TOKENS, timeoutMs: 25_000 },
      args.signal,
    );
  } catch (err) {
    if (__DEV__) console.log('[enrich] tier1 çağrısı başarısız ->', err);
    return null;
  }
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatArgs {
  systemPrompt: string;
  /** Oldest first, ending with the user turn being answered. */
  history: ChatTurn[];
  signal?: AbortSignal;
}

/**
 * Per-plant chat completion. Uses Tier 1 only — deliberately NOT the
 * two-tier router.
 *
 * Escalation exists to adjudicate a disagreement between two independent
 * sources (classifier vs. VLM) about a species. A chat turn has no such
 * disagreement to resolve: there's one question and one answer, and no
 * observable signal that would tell us the strong model is needed. Routing
 * on the model's own "I'm not sure" would be exactly the poorly-calibrated
 * self-report the identification path already rejects, so chat stays on the
 * fast, cheap tier.
 *
 * Throws on failure — the caller maps it to an AppError.
 */
export async function chat(args: ChatArgs): Promise<string> {
  const response = await eachlabsPost<ChatCompletionResponse>(
    '/chat/completions',
    {
      model: VLM_MODEL_TIER1,
      temperature: 0.4, // higher than the identification path (0.2) — this is prose, not a JSON contract
      max_tokens: 400, // the prompt asks for 2-4 sentences; this caps a runaway answer
      messages: [{ role: 'system', content: args.systemPrompt }, ...args.history],
    },
    { timeoutMs: 25_000, signal: args.signal },
  );

  const content = response.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('empty chat response');
  return content;
}

/**
 * Tier 2 — runs only on structural disagreement, as an INDEPENDENT second
 * reading of the image. It is deliberately not given Tier 1's verdict: both
 * tiers now run the same model, so showing it would anchor the second pass
 * on the first and make their agreement measure the anchoring rather than
 * the plant (see buildSecondOpinionPrompt).
 *
 * Returns null on failure — the caller keeps using Tier 1's result, so an
 * escalation failure NEVER drops the identification.
 */
export async function secondOpinion(args: EnrichArgs): Promise<Enrichment | null> {
  routerStats.tier2Calls++;
  try {
    return await callVlm(
      VLM_MODEL_TIER2,
      buildSecondOpinionPrompt(args.candidates, args.allowOwnGuess, args.locale ?? 'tr'),
      args.imageBase64,
      { maxTokens: TIER2_MAX_TOKENS, timeoutMs: 25_000 },
      args.signal,
    );
  } catch (err) {
    if (__DEV__) console.log('[secondOpinion] tier2 çağrısı başarısız ->', err);
    return null;
  }
}
