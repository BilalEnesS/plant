/** 'Pelargonium zonale' → 'pelargonium-zonale' — sticker filename / cache key. */
export function speciesSlug(latin: string): string {
  return latin
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents (combining marks left after NFD)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
