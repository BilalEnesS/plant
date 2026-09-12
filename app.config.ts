import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Plantie',
  slug: 'plantie',
  scheme: 'plantie',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  // Filename bumped to '-v2' for the same reason 'plantie-icon' exists at
  // all — Expo Go caches the icon by URL, so fixing the artwork (it was
  // off-center in its own canvas: 102px left margin vs 18px right, verified
  // 2026-09-11) under the OLD filename would still serve the stale cached
  // image. A new URL is the only reliable way to bust it.
  icon: './assets/plantie-icon-v2.png',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.plantie.app',
    infoPlist: {
      NSCameraUsageDescription:
        'Bitki fotoğrafı çekmek için kameraya ihtiyacımız var.',
      NSPhotoLibraryUsageDescription:
        'Galeriden bitki fotoğrafı seçmek için kütüphaneye ihtiyacımız var.',
      NSLocationWhenInUseUsageDescription:
        'Bölgesel bitki türlerini önceliklendirmek için konumunu kullanabiliriz. İzin vermezsen tanımlama genel listeyle devam eder.',
    },
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-status-bar',
    [
      'expo-splash-screen',
      {
        image: './assets/plantie-splash.png',
        resizeMode: 'contain',
        backgroundColor: '#E9EDE4',
      },
    ],
    [
      'expo-font',
      {
        fonts: [
          './node_modules/@expo-google-fonts/fraunces/400Regular/Fraunces_400Regular.ttf',
          './node_modules/@expo-google-fonts/fraunces/400Regular_Italic/Fraunces_400Regular_Italic.ttf',
          './node_modules/@expo-google-fonts/fraunces/600SemiBold/Fraunces_600SemiBold.ttf',
          './node_modules/@expo-google-fonts/archivo/400Regular/Archivo_400Regular.ttf',
          './node_modules/@expo-google-fonts/archivo/500Medium/Archivo_500Medium.ttf',
        ],
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'Bitki fotoğrafı çekmek için kameraya ihtiyacımız var.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Galeriden bitki fotoğrafı seçmek için kütüphaneye ihtiyacımız var.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Bölgesel bitki türlerini önceliklendirmek için konumunu kullanabiliriz.',
      },
    ],
  ],
  extra: {
    plantnetApiKey: process.env.PLANTNET_API_KEY ?? '',
    eachlabsApiKey: process.env.EACHLABS_API_KEY ?? '',
  },
  experiments: {
    typedRoutes: true,
  },
};

export default config;
