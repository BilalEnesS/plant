let counter = 0;

/** Time-ordered id — no uuid package needed, sorts the same direction as created_at. */
export function generateId(): string {
  counter = (counter + 1) % 1000;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
