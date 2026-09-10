import { chat, type ChatTurn } from '@/api/eachlabs/llm';
import { EachlabsHttpError } from '@/api/eachlabs/http';
import { buildChatSystemPrompt, type ChatGrounding } from '@/services/prompt';
import { chatMessages, type ChatMessage } from '@/db/chat';
import { HttpNetworkError, HttpTimeoutError } from '@/lib/http';
import type { AppError } from '@/errors/AppError';
import type { Discovery } from '@/db/types';
import type { Locale } from '@/store/useLocaleStore';

/**
 * How many past messages get resent with each turn. The grounding facts live
 * in the system prompt and are resent every time regardless, so old turns
 * carry much less weight than in a general-purpose assistant — 12 (about six
 * exchanges) keeps the thread coherent without the request growing
 * unbounded as the conversation goes on.
 */
const HISTORY_WINDOW = 12;

/** Hard cap on one user message. The UI enforces this too; this is the backstop. */
export const MAX_MESSAGE_LENGTH = 500;

export type ChatOutcome =
  | { kind: 'reply'; message: ChatMessage }
  | { kind: 'error'; error: AppError };

function groundingFor(discovery: Discovery): ChatGrounding {
  return {
    speciesLatin: discovery.speciesLatin,
    speciesCommon: discovery.speciesCommonTr,
    confidenceBand: discovery.confidenceBand,
    viaVlmFallback: discovery.viaVlmFallback,
    care: discovery.care,
    toxicToPets: discovery.toxicToPets,
    toxicityNote: discovery.toxicityNote,
  };
}

/**
 * Persists the user's message. Split from requestReply() on purpose: if the
 * model call fails, the typed message is already saved, so "retry" re-asks
 * the model instead of making the user retype — and never double-inserts.
 */
export async function appendUserMessage(discoveryId: string, text: string): Promise<ChatMessage> {
  return chatMessages.append(discoveryId, 'user', text.trim().slice(0, MAX_MESSAGE_LENGTH));
}

/**
 * Asks the model for a reply to the conversation so far and persists it.
 * Never throws — every failure path is an AppError value, matching how
 * identify() reports errors.
 */
export async function requestReply(args: {
  discovery: Discovery;
  history: ChatMessage[];
  locale: Locale;
  signal?: AbortSignal;
}): Promise<ChatOutcome> {
  const turns: ChatTurn[] = args.history
    .slice(-HISTORY_WINDOW)
    .map((m) => ({ role: m.role, content: m.content }));

  if (turns.length === 0) {
    return { kind: 'error', error: { kind: 'service' } };
  }

  try {
    const text = await chat({
      systemPrompt: buildChatSystemPrompt(groundingFor(args.discovery), args.locale),
      history: turns,
      signal: args.signal,
    });
    const message = await chatMessages.append(args.discovery.id, 'assistant', text);
    return { kind: 'reply', message };
  } catch (err) {
    if (__DEV__) {
      const e = err as { name?: string; message?: string };
      console.log('[chat] reply failed ->', e?.name, e?.message);
    }
    if (err instanceof EachlabsHttpError && (err.status === 429 || err.status === 402)) {
      return { kind: 'error', error: { kind: 'quota' } };
    }
    // Timeout means the connection worked but the service was slow — that's
    // a service problem, not "you have no internet" (same split as pipeline.ts).
    if (err instanceof HttpTimeoutError) return { kind: 'error', error: { kind: 'service' } };
    if (err instanceof HttpNetworkError) return { kind: 'error', error: { kind: 'network' } };
    return { kind: 'error', error: { kind: 'service' } };
  }
}
