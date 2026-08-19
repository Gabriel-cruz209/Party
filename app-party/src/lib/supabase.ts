import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/types/database.types';
import { getRequiredEnv } from './env';

const isWebServer = Platform.OS === 'web' && typeof window === 'undefined';

const expoAuthStorage = {
  getItem: (key: string) => {
    if (isWebServer) {
      return null;
    }

    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (isWebServer) {
      return;
    }

    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (isWebServer) {
      return;
    }

    return AsyncStorage.removeItem(key);
  },
};

export const supabaseConfig = {
  url: getRequiredEnv('EXPO_PUBLIC_SUPABASE_URL'),
  anonKey: getRequiredEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
};

export const supabase = createClient<Database>(supabaseConfig.url, supabaseConfig.anonKey, {
  auth: {
    storage: expoAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
  global: {
    headers: {
      'X-Client-Info': 'party-expo',
    },
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

export type SupabaseClient = typeof supabase;
