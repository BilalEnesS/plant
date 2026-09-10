/**
 * Verified live (2026-09-09): no negative_prompt in the request schema, so
 * prompt.ts folds the negative into the positive prompt's tail. version
 * "0.0.1" goes in the body; output is a plain string URL at runtime (the
 * metadata says "array", but it isn't).
 */
export interface StickerModelAdapter {
  model: string;
  version?: string;
  buildInput(prompt: string): Record<string, unknown>;
  extractUrl(output: unknown): string | null;
}

export const stickerModel: StickerModelAdapter = {
  model: 'flux-2-klein-4b-base-text-to-image',
  version: '0.0.1',

  buildInput(prompt) {
    return {
      prompt,
      image_size: 'square_hd',
      num_images: 1,
      output_format: 'png',
    };
  },

  extractUrl(output) {
    if (typeof output === 'string') return output;
    if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
    if (output && typeof output === 'object') {
      const o = output as Record<string, unknown>;
      if (typeof o.url === 'string') return o.url;
      const image = o.image as Record<string, unknown> | undefined;
      if (image && typeof image.url === 'string') return image.url;
    }
    return null;
  },
};
