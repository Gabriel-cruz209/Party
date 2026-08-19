import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export const authRedirectTo = makeRedirectUri({
  scheme: 'appparty',
  path: 'auth/callback',
});

export async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    throw new Error(errorCode);
  }

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(String(params.code));

    if (error) {
      throw error;
    }

    return data.session;
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;

  if (!accessToken) {
    return null;
  }

  if (!refreshToken) {
    throw new Error('Refresh token ausente no retorno do OAuth.');
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw error;
  }

  return data.session;
}

export async function signInWithGoogleOAuth() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: authRedirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    throw error;
  }

  if (!data.url) {
    throw new Error('Supabase nao retornou a URL de autenticacao do Google.');
  }

  const response = await WebBrowser.openAuthSessionAsync(data.url, authRedirectTo);

  if (response.type !== 'success') {
    return null;
  }

  return createSessionFromUrl(response.url);
}
