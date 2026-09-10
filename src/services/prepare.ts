import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { QUALITY } from '@/quality/constants';
import { isBlurry, laplacianVariance } from '@/quality/blur';
import { base64ToUint8Array } from '@/lib/base64';
import type { Organ, PrepareOutcome } from '@/services/types';

interface PrepareInput {
  uri: string;
  width: number;
  height: number;
  organ?: Organ;
  /**
   * When true, blur is still measured and logged but not used as a gate —
   * always returns 'ready'. For the second-photo loop's follow-up close-up:
   * the user is already committed to the API call, so use that image rather
   * than rejecting it. The gate only ever applies to the FIRST image.
   */
  skipBlurGate?: boolean;
}

/** Shrinks the long edge to `longEdge`, preserving aspect ratio (the API computes it when given one dimension). */
function longEdgeResize(ctx: ReturnType<typeof ImageManipulator.manipulate>, longEdge: number, width: number, height: number) {
  return width >= height ? ctx.resize({ width: longEdge }) : ctx.resize({ height: longEdge });
}

/**
 * Makes a raw camera/gallery URI safe for the pipeline: converts HEIC to JPEG
 * (the manipulator reads either and writes JPEG), applies the blur gate, and
 * if it passes, produces the main (1280) + VLM (768) renders.
 *
 * Blur check runs first deliberately: the thumbnail is the cheapest step, so
 * a blurry image never generates the 1280/768 renders — no wasted CPU, no network call.
 */
export async function prepare(input: PrepareInput): Promise<PrepareOutcome> {
  const { uri, width, height, organ = 'auto', skipBlurGate = false } = input;

  const thumbCtx = ImageManipulator.manipulate(uri);
  longEdgeResize(thumbCtx, QUALITY.thumbSize, width, height);
  const thumbRendered = await thumbCtx.renderAsync();
  const thumbSaved = await thumbRendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.9, // heavy compression destroys the high-frequency energy we're trying to measure
    base64: true,
  });

  const variance = thumbSaved.base64
    ? laplacianVariance(base64ToUint8Array(thumbSaved.base64))
    : null;

  if (__DEV__) {
    console.log('[blur] variance =', variance, 'threshold =', QUALITY.blurThreshold);
  }

  if (!skipBlurGate && isBlurry(variance)) {
    return { kind: 'blurry', variance: variance ?? 0, threshold: QUALITY.blurThreshold };
  }

  const mainCtx = ImageManipulator.manipulate(uri);
  longEdgeResize(mainCtx, QUALITY.longEdge, width, height);
  const mainRendered = await mainCtx.renderAsync();
  const mainSaved = await mainRendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: QUALITY.jpegQuality,
  });

  const vlmCtx = ImageManipulator.manipulate(uri);
  longEdgeResize(vlmCtx, QUALITY.vlmLongEdge, width, height);
  const vlmRendered = await vlmCtx.renderAsync();
  const vlmSaved = await vlmRendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: QUALITY.vlmQuality,
    base64: true,
  });

  return {
    kind: 'ready',
    image: {
      uri: mainSaved.uri,
      vlmBase64: vlmSaved.base64 ?? '',
      organ,
      width: mainRendered.width,
      height: mainRendered.height,
    },
  };
}
