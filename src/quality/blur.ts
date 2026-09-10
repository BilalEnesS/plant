import { decode } from 'jpeg-js';
import { QUALITY } from '@/quality/constants';

/**
 * 4-neighbor Laplacian [0 1 0; 1 -4 1; 0 1 0] over a 96x96 grayscale image,
 * returns the population variance. Only run on a small thumbnail — on a
 * 1280px image it blocks the JS thread for 100-300ms.
 *
 * Never throws for undecodable input (a leaked HEIC, a corrupt file) —
 * returns null instead, which the caller treats as "assume sharp, let the API decide."
 */
export function laplacianVariance(jpegBytes: Uint8Array): number | null {
  let width: number;
  let height: number;
  let data: Uint8Array;

  try {
    const decoded = decode(jpegBytes, { useTArray: true });
    width = decoded.width;
    height = decoded.height;
    data = decoded.data;
  } catch {
    return null;
  }

  if (width < 3 || height < 3) return null;

  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }

  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const v = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += v;
      sumSq += v * v;
      n++;
    }
  }

  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** null (undecodable image) is treated as sharp — let the API decide. */
export function isBlurry(variance: number | null): boolean {
  if (variance === null) return false;
  return variance < QUALITY.blurThreshold;
}
