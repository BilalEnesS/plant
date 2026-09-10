import { create } from 'zustand';
import { discoveries } from '@/db/discoveries';
import type { Discovery } from '@/db/types';

interface CollectionState {
  items: Discovery[];
  distinctSpeciesCount: number;
  /** Sticker ids that already played their reveal — this is what guarantees "plays once, never again". */
  revealedIds: Set<string>;
  hydrated: boolean;

  /** ONCE at app startup: seeds revealedIds with every currently-'ready' id (old news, no animation). */
  hydrate: () => Promise<void>;
  /** Every time the screen focuses: refreshes the list, does NOT touch revealedIds (newly-ready ones still animate). */
  refresh: () => Promise<void>;
  addOptimistic: (d: Discovery) => void;
  /** Called from outside React by stickerQueue, via getState(). */
  markStickerReady: (id: string, uri: string) => void;
  markStickerFailed: (id: string) => void;
  markRevealed: (id: string) => void;
  remove: (id: string) => Promise<void>;
  /** After a drag-and-drop: applies the new order to the screen immediately, persists in the background. */
  reorder: (newItems: Discovery[]) => void;
}

export const useCollectionStore = create<CollectionState>((set) => ({
  items: [],
  distinctSpeciesCount: 0,
  revealedIds: new Set(),
  hydrated: false,

  async hydrate() {
    const [items, distinctSpeciesCount] = await Promise.all([
      discoveries.list(),
      discoveries.distinctSpeciesCount(),
    ]);
    const revealedIds = new Set(items.filter((i) => i.stickerStatus === 'ready').map((i) => i.id));
    set({ items, distinctSpeciesCount, revealedIds, hydrated: true });
  },

  async refresh() {
    const [items, distinctSpeciesCount] = await Promise.all([
      discoveries.list(),
      discoveries.distinctSpeciesCount(),
    ]);
    set({ items, distinctSpeciesCount });
  },

  addOptimistic(d) {
    set((s) => {
      const isNewSpecies = !s.items.some((i) => i.speciesLatin === d.speciesLatin);
      return {
        items: [d, ...s.items],
        distinctSpeciesCount: s.distinctSpeciesCount + (isNewSpecies ? 1 : 0),
      };
    });
  },

  markStickerReady(id, uri) {
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, stickerUri: uri, stickerStatus: 'ready' as const } : i)),
    }));
  },

  markStickerFailed(id) {
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, stickerStatus: 'failed' as const } : i)),
    }));
  },

  markRevealed(id) {
    set((s) => {
      const next = new Set(s.revealedIds);
      next.add(id);
      return { revealedIds: next };
    });
  },

  async remove(id) {
    await discoveries.remove(id);
    const distinctSpeciesCount = await discoveries.distinctSpeciesCount();
    set((s) => ({ items: s.items.filter((i) => i.id !== id), distinctSpeciesCount }));
  },

  reorder(newItems) {
    // Optimistic: the screen updates immediately, the DB write finishes in the background.
    set({ items: newItems });
    discoveries.reorder(newItems.map((i) => i.id)).catch(() => {
      // Even if persisting fails, the screen stays consistent; the next
      // refresh() brings back the old (still valid) order — no data loss.
    });
  },
}));
