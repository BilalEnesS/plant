export const QUALITY = {
  longEdge: 1280,
  jpegQuality: 0.8,
  vlmLongEdge: 768,
  vlmQuality: 0.7,

  /**
   * 256px, not 96px — determined by measurement (2026-09-09, 4 CC0 plant
   * photos, each with sharp + gaussian r=8 + gaussian r=15 variants):
   *
   *   thumb=96px   sharp-min / blurry-max = 0.43x  → distributions OVERLAP
   *   thumb=160px                          0.53x  → still overlapping
   *   thumb=256px                          1.11x  → separated
   *
   * At 96px, the aggressive downscale destroyed exactly the high-frequency
   * signal we're trying to measure; no global threshold could separate sharp
   * from blurry (with the old threshold of 90, the gate essentially never
   * fired — even a photo blurred beyond recognition at gaussian r=20 still scored 427).
   */
  thumbSize: 256,

  /**
   * Laplacian variance over a 256px grayscale image; below this is "blurry"
   * and NEVER reaches the API. Measured range: sharp 245–4153, blurry 5–221.
   *
   * The threshold is deliberately BELOW the separation point (198→200): a
   * false positive (blocking a good photo, making the app feel broken) is
   * more expensive than a false negative (one wasted API call). So the gate
   * only catches catastrophic blur and lets borderline cases through.
   *
   * KNOWN LIMITATION: Laplacian variance depends on image content (texture
   * density), not just focus — a single smooth leaf against a flat sky can
   * score low despite being sharp. Even at 256px the separation margin is
   * thin (1.11x). A single global threshold is structurally fragile; a more
   * robust fix would be a content-normalized metric (see the README's
   * "with two more weeks" section).
   */
  blurThreshold: 200,
} as const;
