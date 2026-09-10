import * as Location from 'expo-location';

/**
 * Requests location permission once. If denied (now or previously), NEVER
 * asks again — the spec's "don't re-prompt the user" rule. `resolveProject()`
 * also checks this permission state itself; this function is called at most
 * once at app startup (see app/_layout.tsx, Phase 4).
 */
export async function ensureLocationPermissionRequestedOnce(): Promise<void> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === 'undetermined') {
    await Location.requestForegroundPermissionsAsync();
  }
  // If 'granted' or 'denied', do nothing — never ask again.
}
