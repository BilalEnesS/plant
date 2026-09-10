import { env } from '@/lib/env';
import { HttpNetworkError, HttpTimeoutError, retryOnce, xhrMultipartPost } from '@/lib/http';
import type { PreparedImage, Candidate } from '@/services/types';
import type { PlantNetResponse } from '@/api/plantnet/types';

const BASE_URL = 'https://my-api.plantnet.org/v2/identify';
// Docs say "images[]", live testing showed the real field name is "images" (2026-09-08).
const IMAGE_FIELD = 'images';
const ORGAN_FIELD = 'organs';

export class PlantNetNotAPlantError extends Error {}
export class PlantNetQuotaError extends Error {}
export class PlantNetServiceError extends Error {}

interface IdentifyArgs {
  images: PreparedImage[];
  project: string;
  nbResults?: number;
  signal?: AbortSignal;
}

export async function identifyWithPlantNet(
  args: IdentifyArgs,
): Promise<{ candidates: Candidate[]; remaining: number | null }> {
  const { images, project, nbResults = 5, signal } = args;

  const form = new FormData();
  for (const image of images) {
    // React Native FormData file part — the uri/name/type triple.
    form.append(IMAGE_FIELD, {
      uri: image.uri,
      name: `${image.organ}.jpg`,
      type: 'image/jpeg',
    } as unknown as Blob);
    form.append(ORGAN_FIELD, image.organ);
  }

  const url = `${BASE_URL}/${project}?api-key=${env.plantnetApiKey}&nb-results=${nbResults}&lang=tr`;

  const doRequest = async () => {
    let response: { status: number; body: string };
    try {
      // Don't set Content-Type manually — XHR derives the boundary'd
      // multipart/form-data from the FormData itself.
      response = await xhrMultipartPost({ url, formData: form, timeoutMs: 15_000, signal });
    } catch (err) {
      if (err instanceof HttpTimeoutError || err instanceof HttpNetworkError) throw err;
      throw new HttpNetworkError(err);
    }

    if (response.status === 404) throw new PlantNetNotAPlantError();
    if (response.status === 429) throw new PlantNetQuotaError();
    if (response.status >= 500) throw new PlantNetServiceError();
    if (response.status < 200 || response.status >= 300) throw new PlantNetServiceError();

    return JSON.parse(response.body) as PlantNetResponse;
  };

  const data = await retryOnce(doRequest, {
    shouldRetry: (err) => err instanceof HttpTimeoutError || err instanceof HttpNetworkError || err instanceof PlantNetServiceError,
  });

  const candidates: Candidate[] = data.results.map((r) => ({
    latin: r.species.scientificNameWithoutAuthor,
    commonNames: r.species.commonNames ?? [],
    score: r.score,
    gbifId: r.gbif?.id ?? null,
  }));

  return { candidates, remaining: data.remainingIdentificationRequests ?? null };
}
