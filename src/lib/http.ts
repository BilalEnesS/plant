export class HttpTimeoutError extends Error {
  constructor() {
    super('timeout');
    this.name = 'HttpTimeoutError';
  }
}

export class HttpNetworkError extends Error {
  constructor(cause?: unknown) {
    super('network');
    this.name = 'HttpNetworkError';
    this.cause = cause;
  }
}

interface FetchWithTimeoutInit extends RequestInit {
  timeoutMs: number;
}

/** fetch + hard timeout. Converts network errors to HttpNetworkError, timeouts to HttpTimeoutError. */
export async function fetchWithTimeout(url: string, init: FetchWithTimeoutInit): Promise<Response> {
  const { timeoutMs, signal: externalSignal, ...rest } = init;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', () => controller.abort());
  }

  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } catch (err) {
    if (__DEV__) {
      // console.log, not console.error — this is usually a handled case
      // (timeout → single retry, 4xx/5xx → a defined error state).
      // console.error triggers a full-screen LogBox overlay in React
      // Native; we don't want that here, the app isn't actually crashing.
      console.log('[http] fetch failed for', url, '->', err);
    }
    if (controller.signal.aborted && !externalSignal?.aborted) {
      throw new HttpTimeoutError();
    }
    throw new HttpNetworkError(err);
  } finally {
    clearTimeout(timeout);
  }
}

interface XhrMultipartPostArgs {
  url: string;
  formData: FormData;
  timeoutMs: number;
  signal?: AbortSignal;
}

/**
 * Not fetch() — Expo/React Native's New Architecture fetch polyfill doesn't
 * support FormData file parts ("Unsupported FormDataPart implementation",
 * see github.com/expo/expo/issues/33134, verified on a real device
 * 2026-09-08). This is the ONLY place that uploads multipart files —
 * XMLHttpRequest still works. No manual Content-Type header; XHR derives
 * the boundary from FormData itself, same as fetch would.
 */
export function xhrMultipartPost(args: XhrMultipartPostArgs): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.timeout = args.timeoutMs;
    xhr.open('POST', args.url);

    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () => reject(new HttpNetworkError(new Error('xhr network error')));
    xhr.ontimeout = () => reject(new HttpTimeoutError());
    xhr.onabort = () => reject(new HttpNetworkError(new Error('xhr aborted')));

    if (args.signal) {
      if (args.signal.aborted) {
        xhr.abort();
        return;
      }
      args.signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.send(args.formData);
  });
}

/** Single retry with a fixed backoff. No retry on 4xx — only network/timeout/5xx. */
export async function retryOnce<T>(
  fn: () => Promise<T>,
  opts: { shouldRetry: (err: unknown) => boolean; backoffMs?: number },
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!opts.shouldRetry(err)) throw err;
    await new Promise((resolve) => setTimeout(resolve, opts.backoffMs ?? 800));
    return fn();
  }
}
