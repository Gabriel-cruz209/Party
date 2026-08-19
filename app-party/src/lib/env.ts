export type PublicEnvKey =
  | 'EXPO_PUBLIC_APP_ENV'
  | 'EXPO_PUBLIC_SUPABASE_URL'
  | 'EXPO_PUBLIC_SUPABASE_ANON_KEY'
  | 'EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME'
  | 'EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET'
  | 'EXPO_PUBLIC_CLOUDINARY_UPLOAD_FOLDER'
  | 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'
  | 'EXPO_PUBLIC_GOOGLE_MAPS_GEOCODING_API_URL'
  | 'EXPO_PUBLIC_GOOGLE_MAPS_PLACES_API_URL'
  | 'EXPO_PUBLIC_GOOGLE_MAPS_DIRECTIONS_API_URL'
  | 'EXPO_PUBLIC_AZURE_TRANSLATOR_ENDPOINT'
  | 'EXPO_PUBLIC_AZURE_TRANSLATOR_KEY'
  | 'EXPO_PUBLIC_AZURE_TRANSLATOR_REGION'
  | 'EXPO_PUBLIC_AZURE_TRANSLATOR_DEFAULT_FROM'
  | 'EXPO_PUBLIC_AZURE_TRANSLATOR_DEFAULT_TO'
  | 'EXPO_PUBLIC_GROQ_API_KEY'
  | 'EXPO_PUBLIC_GROQ_BASE_URL'
  | 'EXPO_PUBLIC_GROQ_MODEL'
  | 'EXPO_PUBLIC_EAS_PROJECT_ID';

const defaultEnvValues: Partial<Record<PublicEnvKey, string>> = {
  EXPO_PUBLIC_APP_ENV: 'development',
  EXPO_PUBLIC_CLOUDINARY_UPLOAD_FOLDER: 'party',
  EXPO_PUBLIC_GOOGLE_MAPS_GEOCODING_API_URL: 'https://maps.googleapis.com/maps/api/geocode/json',
  EXPO_PUBLIC_GOOGLE_MAPS_PLACES_API_URL: 'https://maps.googleapis.com/maps/api/place',
  EXPO_PUBLIC_GOOGLE_MAPS_DIRECTIONS_API_URL: 'https://maps.googleapis.com/maps/api/directions/json',
  EXPO_PUBLIC_AZURE_TRANSLATOR_ENDPOINT: 'https://api.cognitive.microsofttranslator.com',
  EXPO_PUBLIC_AZURE_TRANSLATOR_DEFAULT_FROM: 'pt',
  EXPO_PUBLIC_AZURE_TRANSLATOR_DEFAULT_TO: 'en',
  EXPO_PUBLIC_GROQ_BASE_URL: 'https://api.groq.com',
  EXPO_PUBLIC_GROQ_MODEL: 'openai/gpt-oss-20b',
};

export function getOptionalEnv(key: PublicEnvKey): string | undefined {
  const value = process.env[key] ?? defaultEnvValues[key];
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

export function getRequiredEnv(key: PublicEnvKey): string {
  const value = getOptionalEnv(key);

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}
