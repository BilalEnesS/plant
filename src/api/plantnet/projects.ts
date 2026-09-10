import * as Location from 'expo-location';
import { env } from '@/lib/env';
import { fetchWithTimeout } from '@/lib/http';

interface PlantNetProject {
  id: string;
  title: string;
}

/**
 * Session-level cache. This call does a permission check + location read +
 * network request (up to 3s) and used to run before EVERY identification,
 * adding dead latency to each scan. The user doesn't move far enough between
 * scans to change regional flora, so caching the result once is correct —
 * perceived speed matters most in a consumer scanner app.
 */
let cachedProject: Promise<string> | null = null;

/**
 * Returns the regional flora project if location permission is granted
 * (verified live: GET /v2/projects?lat=&lon= ranks nearby floras by fit —
 * the first item is the best match). Returns 'all' on missing permission,
 * denial, or any error, and NEVER drops the identification. A denied user
 * is never asked again (see services/location.ts).
 */
export function resolveProject(): Promise<string> {
  if (!cachedProject) {
    cachedProject = computeProject();
  }
  return cachedProject;
}

async function computeProject(): Promise<string> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return 'all';

    const position = await Location.getLastKnownPositionAsync();
    if (!position) return 'all';

    const url = `https://my-api.plantnet.org/v2/projects?api-key=${env.plantnetApiKey}&lat=${position.coords.latitude}&lon=${position.coords.longitude}`;
    const response = await fetchWithTimeout(url, { method: 'GET', timeoutMs: 3_000 });
    if (!response.ok) return 'all';

    const projects = (await response.json()) as PlantNetProject[];
    if (!Array.isArray(projects) || projects.length === 0 || !projects[0]?.id) return 'all';

    return projects[0].id;
  } catch {
    return 'all';
  }
}
