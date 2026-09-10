import { Directory, File, Paths } from 'expo-file-system';

/**
 * ONLY this file imports `expo-file-system`. No screen, service, or repo
 * touches it directly — if the SDK's file API changes (see the plan's
 * "legacy" note), the fix stays in one file.
 *
 * exists/create/delete are SYNC; copy/move/base64 are ASYNC (verified live
 * against expo-file-system@57 types).
 */

const photosDir = new Directory(Paths.document, 'photos');
const stickersDir = new Directory(Paths.document, 'stickers');

function ensureDir(dir: Directory) {
  if (!dir.exists) dir.create({ intermediates: true });
}

export const fs = {
  /** Called once at startup, from app/_layout.tsx. */
  ensureDirs() {
    ensureDir(photosDir);
    ensureDir(stickersDir);
  },

  /** Copies prepare()'s cached 1280px JPEG into the permanent photos/ dir. */
  async persistPhoto(sourceUri: string, id: string): Promise<string> {
    ensureDir(photosDir);
    const source = new File(sourceUri);
    const dest = new File(photosDir, `${id}.jpg`);
    await source.copy(dest);
    return dest.uri;
  },

  /** Deletes the photo when a discovery is removed (the sticker is a shared cache, so it stays). */
  deletePhoto(uri: string) {
    const file = new File(uri);
    if (file.exists) file.delete();
  },

  /** Per-species sticker cache file — check existence via `.exists`. */
  stickerFileFor(slug: string): File {
    ensureDir(stickersDir);
    return new File(stickersDir, `${slug}.png`);
  },

  /**
   * The DB stores sticker_uri as a RELATIVE filename (e.g. "pelargonium-zonale.png"),
   * not an absolute file:// URI — iOS changes the container UUID across
   * installs, so absolute paths go stale. Always resolve through this function.
   */
  resolveStickerUri(relativeFilename: string): string {
    return new File(stickersDir, relativeFilename).uri;
  },

  /** Downloads a remote sticker URL and moves it to exactly stickers/{slug}.png. */
  async downloadStickerTo(slug: string, url: string): Promise<string> {
    ensureDir(stickersDir);
    // downloadFileAsync derives the filename from the response, so download
    // to cache first, then move it to the exact name we want.
    const downloaded = await File.downloadFileAsync(url, Paths.cache, { idempotent: true });
    const dest = new File(stickersDir, `${slug}.png`);
    if (dest.exists) dest.delete();
    await downloaded.move(dest);
    return dest.uri;
  },
};
