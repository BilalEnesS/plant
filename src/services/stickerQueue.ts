import { fs } from '@/lib/fs';
import { speciesSlug } from '@/lib/slug';
import { discoveries } from '@/db/discoveries';
import { stickerRelativeFilename } from '@/db/types';
import { generateSticker } from '@/api/eachlabs/image';
import { buildStickerPrompt } from '@/services/prompt';
import { useCollectionStore } from '@/store/useCollectionStore';

interface QueueItem {
  discoveryId: string;
  speciesLatin: string;
  stickerTraits: string;
}

/**
 * Module-level singleton — not tied to React, no component mounts/unmounts
 * it. Leaving `/result` unmounts a component, not this module. No background
 * task library needed (which would break Expo Go anyway).
 */
const queue: QueueItem[] = [];
let running = false;
const inFlightBySlug = new Map<string, Promise<string>>();
const runtimeStats = { generated: 0, cacheHits: 0 };

async function downloadOrGenerate(slug: string, prompt: string): Promise<string> {
  const cached = fs.stickerFileFor(slug);
  if (cached.exists) {
    runtimeStats.cacheHits++;
    // This is the on-device proof behind the README's "cache win" claim:
    // ZERO image-generation calls the second time a species is found.
    if (__DEV__) console.log('[sticker] CACHE HIT (no API call) ->', slug);
    return cached.uri;
  }

  let inFlight = inFlightBySlug.get(slug);
  if (!inFlight) {
    inFlight = generateSticker({ prompt }).then((url) => fs.downloadStickerTo(slug, url));
    inFlightBySlug.set(slug, inFlight);
  }

  try {
    const uri = await inFlight;
    runtimeStats.generated++;
    return uri;
  } finally {
    inFlightBySlug.delete(slug);
  }
}

async function processOne(item: QueueItem): Promise<void> {
  const slug = speciesSlug(item.speciesLatin);
  const store = useCollectionStore.getState();

  const startedAt = Date.now();
  if (__DEV__) console.log('[sticker] generation started ->', item.speciesLatin);

  try {
    const prompt = buildStickerPrompt(item.speciesLatin, item.stickerTraits);
    const uri = await downloadOrGenerate(slug, prompt);
    const relativeFilename = stickerRelativeFilename(item.speciesLatin);
    await discoveries.setSticker(item.discoveryId, relativeFilename, 'ready');
    store.markStickerReady(item.discoveryId, uri);
    if (__DEV__) {
      console.log(
        `[sticker] READY (${Date.now() - startedAt}ms) -> ${item.speciesLatin}`,
        '| stats:', runtimeStats,
      );
    }
  } catch (err) {
    // The discovery row is NEVER deleted — the slot shows a placeholder + "Retry".
    if (__DEV__) {
      const e = err as { name?: string; message?: string };
      console.log('[sticker] FAILED ->', item.speciesLatin, '|', e?.name, e?.message);
    }
    await discoveries.setSticker(item.discoveryId, null, 'failed');
    store.markStickerFailed(item.discoveryId);
  }
}

async function runQueue(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item) await processOne(item);
    }
  } finally {
    running = false;
  }
}

export const stickerQueue = {
  /** Fire-and-forget — pipeline.ts's identify() does NOT await this. */
  enqueue(item: QueueItem): void {
    queue.push(item);
    void runQueue();
  },

  retry(discoveryId: string, speciesLatin: string, stickerTraits: string): void {
    queue.push({ discoveryId, speciesLatin, stickerTraits });
    void runQueue();
  },

  /** Called ONCE at startup from app/_layout.tsx — self-heals even if the app was killed mid-generation. */
  async resumePending(): Promise<void> {
    const rows = await discoveries.pending();
    for (const row of rows) {
      queue.push({
        discoveryId: row.id,
        speciesLatin: row.speciesLatin,
        stickerTraits: row.stickerTraits ?? 'a typical specimen of this species, accurate leaf and growth habit',
      });
    }
    void runQueue();
  },

  stats() {
    return { ...runtimeStats };
  },
};
