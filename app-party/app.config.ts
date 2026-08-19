import type { ConfigContext, ExpoConfig } from 'expo/config';

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'app-party',
  slug: config.slug ?? 'app-party',
  ios: {
    ...config.ios,
    config: {
      ...config.ios?.config,
      googleMapsApiKey,
    },
  },
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        ...config.android?.config?.googleMaps,
        apiKey: googleMapsApiKey,
      },
    },
  },
  extra: {
    ...config.extra,
    appEnv: process.env.EXPO_PUBLIC_APP_ENV,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    cloudinaryCloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME,
    googleMapsApiKey,
    eas: easProjectId
      ? {
          ...((config.extra?.eas as Record<string, unknown> | undefined) ?? {}),
          projectId: easProjectId,
        }
      : config.extra?.eas,
  },
  plugins: [
    ...(config.plugins ?? []),
    [
      'expo-notifications',
      {
        color: '#ef4444',
        defaultChannel: 'party-alerts',
        enableBackgroundRemoteNotifications: false,
      },
    ],
    [
      'expo-barcode-scanner',
      {
        cameraPermission: 'Permita que o Party use a camera para validar ingressos.',
        microphonePermission: false,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'Permita que o Party use a camera para validar ingressos.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-location',
      {
        isAndroidBackgroundLocationEnabled: false,
        isIosBackgroundLocationEnabled: false,
        locationAlwaysAndWhenInUsePermission: false,
        locationWhenInUsePermission: 'Permita que o Party use sua localizacao para escolher locais de eventos.',
      },
    ],
  ],
});
