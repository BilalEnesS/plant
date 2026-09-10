import { env } from '@/lib/env';
import { fetchWithTimeout } from '@/lib/http';

const BASE_URL = 'https://api.eachlabs.ai/v1';

/**
 * Carries the HTTP status so callers can tell a quota/rate limit (429) apart
 * from a generic upstream failure. enrich()/adjudicate() swallow every error
 * and return null, so this only matters to the chat path, which surfaces a
 * specific message to the user.
 */
export class EachlabsHttpError extends Error {
  constructor(public readonly status: number, path: string) {
    super(`eachlabs ${path} -> ${status}`);
    this.name = 'EachlabsHttpError';
  }
}

/** Bearer auth verified live (2026-09-08) — no need for an X-API-Key hedge. */
export async function eachlabsPost<T>(
  path: string,
  body: unknown,
  opts?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<T> {
  const response = await fetchWithTimeout(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.eachlabsApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    timeoutMs: opts?.timeoutMs ?? 20_000,
    signal: opts?.signal,
  });

  if (!response.ok) {
    throw new EachlabsHttpError(response.status, path);
  }

  return (await response.json()) as T;
}

export async function eachlabsGet<T>(path: string, opts?: { timeoutMs?: number }): Promise<T> {
  const response = await fetchWithTimeout(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${env.eachlabsApiKey}` },
    timeoutMs: opts?.timeoutMs ?? 20_000,
  });

  if (!response.ok) {
    throw new EachlabsHttpError(response.status, path);
  }

  return (await response.json()) as T;
}
