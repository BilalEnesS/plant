import Constants from 'expo-constants';

interface Env {
  plantnetApiKey: string;
  eachlabsApiKey: string;
}

/**
 * Typed access to app.config.ts's `extra` block. Throws a clear, friendly
 * error at startup if a key is missing rather than letting every API call
 * fail later with an opaque 401. Never log the values themselves.
 */
function readEnv(): Env {
  const extra = Constants.expoConfig?.extra as Partial<Env> | undefined;

  const plantnetApiKey = extra?.plantnetApiKey ?? '';
  const eachlabsApiKey = extra?.eachlabsApiKey ?? '';

  if (__DEV__) {
    if (!plantnetApiKey) {
      console.warn('[env] PLANTNET_API_KEY is not set — check your .env file.');
    }
    if (!eachlabsApiKey) {
      console.warn('[env] EACHLABS_API_KEY is not set — check your .env file.');
    }
  }

  return { plantnetApiKey, eachlabsApiKey };
}

export const env = readEnv();
