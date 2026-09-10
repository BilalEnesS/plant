import { getDb } from '@/db/client';
import { generateId } from '@/lib/id';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  discoveryId: string;
  role: ChatRole;
  content: string;
  createdAt: number;
}

interface ChatMessageRow {
  id: string;
  discovery_id: string;
  role: string;
  content: string;
  created_at: number;
}

function rowToMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    discoveryId: row.discovery_id,
    role: row.role as ChatRole,
    content: row.content,
    createdAt: row.created_at,
  };
}

export const chatMessages = {
  /** Oldest first — the order both the UI and the model expect. */
  async listByDiscovery(discoveryId: string): Promise<ChatMessage[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<ChatMessageRow>(
      'SELECT * FROM chat_messages WHERE discovery_id = ? ORDER BY created_at ASC, id ASC',
      [discoveryId],
    );
    return rows.map(rowToMessage);
  },

  async append(discoveryId: string, role: ChatRole, content: string): Promise<ChatMessage> {
    const db = await getDb();
    const message: ChatMessage = {
      id: generateId(),
      discoveryId,
      role,
      content,
      createdAt: Date.now(),
    };
    await db.runAsync(
      'INSERT INTO chat_messages (id, discovery_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
      [message.id, message.discoveryId, message.role, message.content, message.createdAt],
    );
    return message;
  },

  async clearByDiscovery(discoveryId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM chat_messages WHERE discovery_id = ?', [discoveryId]);
  },
};
