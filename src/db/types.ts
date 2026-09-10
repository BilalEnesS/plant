import { fs } from '@/lib/fs';
import { speciesSlug } from '@/lib/slug';
import type { Candidate, Care, ConfidenceBand } from '@/services/types';

export type StickerStatus = 'pending' | 'ready' | 'failed';

export interface DiscoveryRow {
  id: string;
  species_latin: string;
  species_common_tr: string | null;
  confidence: number;
  confidence_band: string;
  photo_uri: string;
  sticker_uri: string | null;
  sticker_status: string;
  care_json: string | null;
  toxic_to_pets: number | null;
  toxicity_note: string | null;
  alternatives_json: string | null;
  sticker_traits: string | null;
  via_vlm_fallback: number;
  lat: number | null;
  lng: number | null;
  created_at: number;
  sort_order: number;
}

export interface Discovery {
  id: string;
  speciesLatin: string;
  speciesCommonTr: string | null;
  confidence: number;
  confidenceBand: ConfidenceBand;
  photoUri: string;
  /** Absolute file:// path — resolved from the DB's relative filename via fs.resolveStickerUri. */
  stickerUri: string | null;
  stickerStatus: StickerStatus;
  care: Care | null;
  toxicToPets: boolean | null;
  toxicityNote: string | null;
  alternatives: Candidate[];
  /** So stickerQueue.resumePending() can rebuild the prompt from the row. */
  stickerTraits: string | null;
  viaVlmFallback: boolean;
  lat: number | null;
  lng: number | null;
  createdAt: number;
  /** Drag-and-drop order — higher shows first (list() sorts DESC). */
  sortOrder: number;
}

/** The ONLY place JSON columns get parsed — no other file touches care_json/alternatives_json directly. */
export function rowToDiscovery(row: DiscoveryRow): Discovery {
  return {
    id: row.id,
    speciesLatin: row.species_latin,
    speciesCommonTr: row.species_common_tr,
    confidence: row.confidence,
    confidenceBand: row.confidence_band as ConfidenceBand,
    photoUri: row.photo_uri,
    stickerUri: row.sticker_uri ? fs.resolveStickerUri(row.sticker_uri) : null,
    stickerStatus: row.sticker_status as StickerStatus,
    care: row.care_json ? (JSON.parse(row.care_json) as Care) : null,
    toxicToPets: row.toxic_to_pets === null ? null : row.toxic_to_pets === 1,
    toxicityNote: row.toxicity_note,
    alternatives: row.alternatives_json ? (JSON.parse(row.alternatives_json) as Candidate[]) : [],
    stickerTraits: row.sticker_traits,
    viaVlmFallback: row.via_vlm_fallback === 1,
    lat: row.lat,
    lng: row.lng,
    createdAt: row.created_at,
    sortOrder: row.sort_order,
  };
}

export function stickerRelativeFilename(speciesLatin: string): string {
  return `${speciesSlug(speciesLatin)}.png`;
}
