import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from '@expo-google-fonts/fraunces';
import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces';
import { Archivo_400Regular, Archivo_500Medium } from '@expo-google-fonts/archivo';
import { colors } from '@/theme/colors';
import { LoadingScreen } from '@/ui/LoadingScreen';
import { fs } from '@/lib/fs';
import { migrate } from '@/db/schema';
import { useCollectionStore } from '@/store/useCollectionStore';
import { useLocaleStore } from '@/store/useLocaleStore';
import { stickerQueue } from '@/services/stickerQueue';
import { ensureLocationPermissionRequestedOnce } from '@/services/location';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore if it's already hidden.
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_600SemiBold,
    Archivo_400Regular,
    Archivo_500Medium,
  });

  const [startupDone, setStartupDone] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [ready, setReady] = useState(false);

  // In parallel with fonts: DB migration, directories, collection hydrate,
  // resuming pending sticker queue work, requesting location permission ONCE.
  useEffect(() => {
    (async () => {
      fs.ensureDirs();
      await migrate();
      // The settings table only exists after migrate(), so the locale
      // preference is read right after — it could run parallel to the
      // collection hydrate, but both are fast and sequential is simpler.
      await useLocaleStore.getState().hydrate();
      await useCollectionStore.getState().hydrate();
      await stickerQueue.resumePending();
      await ensureLocationPermissionRequestedOnce();
      setStartupDone(true);
    })();
  }, []);

  /**
   * Minimum display time for the branded loading screen. Setup usually
   * takes ~100ms; without this, LoadingScreen would flash for one frame and
   * disappear, making the user think "the animation isn't even running."
   * 1400ms is enough to see one cycle of the logo's breathing animation
   * plus one tagline transition.
   */
  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), 1400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if ((!fontsLoaded && !fontError) || !startupDone || !minTimeElapsed) return;
    setReady(true);
  }, [fontsLoaded, fontError, startupDone, minTimeElapsed]);

  // Hide the native splash the instant JS mounts, so our own branded/
  // animated LoadingScreen takes over. Waiting for `ready` would keep the
  // native splash static, and the user would feel like "something old is still showing."
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (!ready) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <LoadingScreen />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.paper },
        }}
      >
        <Stack.Screen name="sticker/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="chat/[id]" options={{ presentation: 'modal' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
