import * as SQLite from 'expo-sqlite';

/**
 * Module-level singleton — SQLiteProvider/useSQLiteContext are NOT used
 * (see the plan): the sticker queue runs outside React and needs the same handle.
 */
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('plantie.db');
  }
  return dbPromise;
}
