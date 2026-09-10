import { eachlabsGet, eachlabsPost } from '@/api/eachlabs/http';
import { stickerModel } from '@/api/eachlabs/models';

interface CreatePredictionResponse {
  status: string;
  predictionID: string;
}

interface PollPredictionResponse {
  status: 'starting' | 'processing' | 'success' | 'failed' | 'cancelled';
  output?: unknown;
}

export class StickerGenerationError extends Error {}

interface GenerateStickerArgs {
  prompt: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Async create + poll (verified live: create ~200ms, usually already
 * 'success' on the first poll). Throws on error/timeout — stickerQueue
 * catches it, the discovery row is never deleted.
 */
export async function generateSticker(args: GenerateStickerArgs): Promise<string> {
  const timeoutMs = args.timeoutMs ?? 60_000;
  const deadline = Date.now() + timeoutMs;

  const created = await eachlabsPost<CreatePredictionResponse>(
    '/prediction/',
    {
      model: stickerModel.model,
      version: stickerModel.version,
      input: stickerModel.buildInput(args.prompt),
    },
    { timeoutMs: 15_000, signal: args.signal },
  );

  if (created.status !== 'success' || !created.predictionID) {
    throw new StickerGenerationError('prediction oluşturulamadı');
  }

  while (Date.now() < deadline) {
    if (args.signal?.aborted) throw new StickerGenerationError('iptal edildi');
    await new Promise((resolve) => setTimeout(resolve, 3_000));

    const poll = await eachlabsGet<PollPredictionResponse>(`/prediction/${created.predictionID}`, {
      timeoutMs: 10_000,
    });

    if (poll.status === 'success') {
      const url = stickerModel.extractUrl(poll.output);
      if (!url) throw new StickerGenerationError('output URL çıkarılamadı');
      return url;
    }
    if (poll.status === 'failed' || poll.status === 'cancelled') {
      throw new StickerGenerationError(`prediction ${poll.status}`);
    }
    // starting/processing — keep polling
  }

  throw new StickerGenerationError('timeout');
}
