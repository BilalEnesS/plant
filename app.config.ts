import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Plantie',
  slug: 'plantie',
  scheme: 'plantie',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  // Filename deliberately 'plantie-icon' — Expo Go caches the icon by URL
  // and kept serving the old placeholder at the 'icon.png' path (verified
  // on-device 2026-09-09). The new name creates a URL the cache has never
  // seen, fixing it for good.
  icon: './assets/plantie-icon.png',
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
