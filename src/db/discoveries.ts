import { getDb } from '@/db/client';
import { chatMessages } from '@/db/chat';
import { fs } from '@/lib/fs';
import { rowToDiscovery, type Discovery, type DiscoveryRow, type StickerStatus } from '@/db/types';
import type { Candidate, Care, ConfidenceBand } from '@/services/types';

export interface NewDiscovery {
  id: string;
  speciesLatin: string;
  speciesCommonTr: string | null;
  confidence: number;
  confidenceBand: ConfidenceBand;
  photoUri: string;
  care: Care | null;
  toxicToPets: boolean | null;
  toxicityNote: string | null;
  alternatives: Candidate[];
  stickerTraits: string | null;
  viaVlmFallback: boolean;
  lat: number | null;
  lng: number | null;
  createdAt: number;
}

export const discoveries = {
  async insert(d: NewDiscovery): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO discoveries (
        id, species_latin, species_common_tr, confidence, confidence_band,
        photo_uri, sticker_uri, sticker_status, care_json, toxic_to_pets,
        toxicity_note, alternatives_json, sticker_traits, via_vlm_fallback, lat, lng, created_at, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.id,
        d.speciesLatin,
        d.speciesCommonTr,
        d.confidence,
        d.confidenceBand,
        d.photoUri,
        d.care ? JSON.stringify(d.care) : null,
        d.toxicToPets === null ? null : d.toxicToPets ? 1 : 0,
        d.toxicityNote,
        JSON.stringify(d.alternatives),
        d.stickerTraits,
        d.viaVlmFallback ? 1 : 0,
        d.lat,
        d.lng,
        d.createdAt,
        // A new row starts in chronological order — reorder() rewrites this
        // value once the user drags and drops.
        d.createdAt,
      ],
    );
  },

  async list(): Promise<Discovery[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<DiscoveryRow>(
      'SELECT * FROM discoveries ORDER BY sort_order DESC, created_at DESC',
    );
    return rows.map(rowToDiscovery);
  },

  /**
   * Called after a drag-and-drop: rewrites sort_order so `orderedIds[0]`
   * appears first (a higher value is shown earlier).
   */
  async reorder(orderedIds: string[]): Promise<void> {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      const total = orderedIds.length;
      for (let i = 0; i < total; i++) {
        await db.runAsync('UPDATE discoveries SET sort_order = ? WHERE id = ?', [total - i, orderedIds[i]]);
      }
    });
  },

  async getById(id: string): Promise<Discovery | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<DiscoveryRow>('SELECT * FROM discoveries WHERE id = ?', [id]);
    return row ? rowToDiscovery(row) : null;
  },

  async distinctSpeciesCount(): Promise<number> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(DISTINCT species_latin) as n FROM discoveries',
    );
    return row?.n ?? 0;
  },

  async countBySpecies(latin: string): Promise<number> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) as n FROM discoveries WHERE species_latin = ?',
      [latin],
    );
    return row?.n ?? 0;
  },

  async pending(): Promise<Discovery[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<DiscoveryRow>(
      "SELECT * FROM discoveries WHERE sticker_status = 'pending'",
    );
    return rows.map(rowToDiscovery);
  },

  async setSticker(id: string, relativeFilename: string | null, status: StickerStatus): Promise<void> {
    const db = await getDb();
    await db.runAsync('UPDATE discoveries SET sticker_uri = ?, sticker_status = ? WHERE id = ?', [
      relativeFilename,
      status,
      id,
    ]);
  },

  /** Deletes the photo and the row. The sticker file is DELIBERATELY kept — it's a shared cache. */
  async remove(id: string): Promise<void> {
    const db = await getDb();
    const row = await db.getFirstAsync<DiscoveryRow>('SELECT * FROM discoveries WHERE id = ?', [id]);
    if (!row) return;
    fs.deletePhoto(row.photo_uri);
    // The chat thread is grounded in this record and is meaningless without
    // it — unlike the sticker (a shared cache), it goes when the record goes.
    await chatMessages.clearByDiscovery(id);
    await db.runAsync('DELETE FROM discoveries WHERE id = ?', [id]);
  },
};
