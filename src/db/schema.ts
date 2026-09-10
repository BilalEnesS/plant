import { getDb } from '@/db/client';

const CURRENT_VERSION = 4;

const CREATE_TABLE_V1 = `
  CREATE TABLE IF NOT EXISTS discoveries (
    id                TEXT PRIMARY KEY,
    species_latin     TEXT NOT NULL,
    species_common_tr TEXT,
    confidence        REAL NOT NULL,
    confidence_band   TEXT NOT NULL,
    photo_uri         TEXT NOT NULL,
    sticker_uri       TEXT,
    sticker_status    TEXT NOT NULL,
    care_json         TEXT,
    toxic_to_pets     INTEGER,
    toxicity_note     TEXT,
    alternatives_json TEXT,
    sticker_traits    TEXT,
    via_vlm_fallback  INTEGER NOT NULL DEFAULT 0,
    lat               REAL,
    lng               REAL,
    created_at        INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_species ON discoveries(species_latin);
`;

/**
 * v2: sort_order column for manual drag-to-reorder. New rows start equal to
 * created_at (chronological order is preserved); when the user drags and
 * drops, discoveries.reorder() rewrites this column to match the new order.
 */
const MIGRATE_V2 = `
  ALTER TABLE discoveries ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
  UPDATE discoveries SET sort_order = created_at;
`;

/**
 * v3: general-purpose key-value settings table. First use is the language
 * preference (src/db/settings.ts, useLocaleStore) — not the "settings
 * screen" the spec forbids, just a store for one persisted preference.
 * Reuses the existing SQLite instead of adding a new dependency (AsyncStorage etc.).
 */
const MIGRATE_V3 = `
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

/**
 * v4: per-discovery chat history. Scoped by discovery_id rather than being a
 * single global thread — each conversation is grounded in one identified
 * plant, so it belongs to that record and is deleted with it.
 */
const MIGRATE_V4 = `
  CREATE TABLE IF NOT EXISTS chat_messages (
    id           TEXT PRIMARY KEY,
    discovery_id TEXT NOT NULL,
    role         TEXT NOT NULL,
    content      TEXT NOT NULL,
    created_at   INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_chat_discovery ON chat_messages(discovery_id, created_at);
`;

/** PRAGMA user_version based migration — called once at startup from app/_layout.tsx. */
export async function migrate(): Promise<void> {
  const db = await getDb();
  await db.execAsync('PRAGMA journal_mode = WAL;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(CREATE_TABLE_V1);
  }
  if (version < 2) {
    await db.execAsync(MIGRATE_V2);
  }
  if (version < 3) {
    await db.execAsync(MIGRATE_V3);
  }
  if (version < 4) {
    await db.execAsync(MIGRATE_V4);
  }
  if (version < CURRENT_VERSION) {
    // PRAGMA doesn't accept parameters; literal interpolation is safe (n is a fixed constant).
    await db.execAsync(`PRAGMA user_version = ${CURRENT_VERSION}`);
  }
}
