import { getDb } from '@/db/client';

export const settings = {
  async get(key: string): Promise<string | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    return row?.value ?? null;
  },

  async set(key: string, value: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value],
    );
  },
};
