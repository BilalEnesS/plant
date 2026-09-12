import { chat, type ChatTurn } from '@/api/eachlabs/llm';
import { EachlabsHttpError } from '@/api/eachlabs/http';
import { buildChatSystemPrompt, sanitizeUserMessage, type ChatGrounding } from '@/services/prompt';
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
  // sanitizeUserMessage, not a bare slice: it removes the structural
  // characters a message would need to fake a new prompt section or a new
  // turn (line breaks, delimiter lookalikes, zero-width/bidi tricks) and
  // applies the length cap. The WORDING is untouched — asking an odd
  // question is allowed, and declining it is the model's job, not a filter's.
  return chatMessages.append(discoveryId, 'user', sanitizeUserMessage(text));
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
  /**
   * Replayed history is sanitised too, both roles.
   *
   * A stored thread is the one part of this prompt that GROWS, and it is
   * replayed on every later turn — so anything structural that once got into
   * a row keeps firing for the life of the conversation instead of once.
   * Two sources: rows written before this sanitising existed, and assistant
   * turns, which are model output and were never filtered at all.
   *
   * Collapsing line breaks costs nothing here: the system prompt already
   * requires plain conversational answers with no markdown or lists.
   */
  const turns: ChatTurn[] = args.history
    .slice(-HISTORY_WINDOW)
    .map((m) => ({ role: m.role, content: sanitizeUserMessage(m.content) }))
    .filter((m) => m.content.length > 0);

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
