import type { Session, Subscription, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { signInWithGoogleOAuth } from '@/lib/auth';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { supabase } from '@/lib/supabase';
import {
  getProfileByUserId,
  isProfileComplete,
  type PartyProfile,
  type ProfileMutationInput,
  saveProfile,
  touchUserProfileActivity,
} from '@/services/profile.service';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';
export type PartyHomeRoute = '/perfil-pessoal' | '/perfil-empresa';

type SignUpParams = {
  nome: string;
  email: string;
  password: string;
};

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: PartyProfile | null;
  status: AuthStatus;
  errorMessage: string | null;
  initialized: boolean;
  initialize: () => Promise<void>;
  refreshProfile: (userId?: string) => Promise<PartyProfile | null>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (params: SignUpParams) => Promise<{ needsEmailConfirmation: boolean }>;
  signInWithGoogle: () => Promise<void>;
  completeProfile: (input: ProfileMutationInput) => Promise<PartyProfile>;
  updateProfile: (input: ProfileMutationInput) => Promise<PartyProfile>;
  signOut: () => Promise<void>;
  getHomeRoute: () => PartyHomeRoute;
};

let authSubscription: Subscription | null = null;
let initializePromise: Promise<void> | null = null;

function getFriendlyAuthError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Nao foi possivel concluir a autenticacao.';
}

async function uploadProfilePhotoIfNeeded(input: ProfileMutationInput) {
  if (!input.fotoFile) {
    return input.fotoUrl ?? null;
  }

  const upload = await uploadToCloudinary(input.fotoFile, {
    folder: 'party/perfis',
    resourceType: 'image',
    tags: ['party', 'perfil', input.tipo],
  });

  return upload.secure_url;
}

export const useAuthStore = create<AuthState>((set, get) => {
  async function syncSession(nextSession: Session | null) {
    if (!nextSession) {
      set({
        session: null,
        user: null,
        profile: null,
        status: 'unauthenticated',
        initialized: true,
      });
      return;
    }

    set({
      session: nextSession,
      user: nextSession.user,
      status: 'loading',
      initialized: true,
    });

    try {
      const profile = await getProfileByUserId(nextSession.user.id);

      if (profile) {
        void touchUserProfileActivity(nextSession.user.id).catch(() => undefined);
      }

      set({
        session: nextSession,
        user: nextSession.user,
        profile,
        status: 'authenticated',
        errorMessage: null,
      });
    } catch (error) {
      set({
        session: nextSession,
        user: nextSession.user,
        profile: null,
        status: 'error',
        errorMessage: getFriendlyAuthError(error),
      });
    }
  }

  return {
    session: null,
    user: null,
    profile: null,
    status: 'idle',
    errorMessage: null,
    initialized: false,

    initialize: async () => {
      if (initializePromise) {
        return initializePromise;
      }

      initializePromise = (async () => {
        set({ status: 'loading', errorMessage: null });

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          set({
            status: 'error',
            errorMessage: getFriendlyAuthError(error),
            initialized: true,
          });
          return;
        }

        await syncSession(session);

        if (!authSubscription) {
          const {
            data: { subscription },
          } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            void syncSession(nextSession);
          });

          authSubscription = subscription;
        }
      })();

      return initializePromise;
    },

    refreshProfile: async (userId) => {
      const currentUserId = userId ?? get().session?.user.id;

      if (!currentUserId) {
        set({ profile: null });
        return null;
      }

      const profile = await getProfileByUserId(currentUserId);
      set({ profile });

      return profile;
    },

    signInWithEmail: async (email, password) => {
      set({ status: 'loading', errorMessage: null });

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (error) {
          throw error;
        }

        await syncSession(data.session);
      } catch (error) {
        const message = getFriendlyAuthError(error);

        set({ status: 'unauthenticated', errorMessage: message });
        throw new Error(message);
      }
    },

    signUpWithEmail: async ({ nome, email, password }) => {
      set({ status: 'loading', errorMessage: null });

      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              nome: nome.trim(),
              display_name: nome.trim(),
            },
          },
        });

        if (error) {
          throw error;
        }

        if (data.session) {
          await syncSession(data.session);
        } else {
          set({
            status: 'unauthenticated',
            initialized: true,
          });
        }

        return { needsEmailConfirmation: !data.session };
      } catch (error) {
        const message = getFriendlyAuthError(error);

        set({ status: 'unauthenticated', errorMessage: message });
        throw new Error(message);
      }
    },

    signInWithGoogle: async () => {
      set({ status: 'loading', errorMessage: null });

      try {
        const session = await signInWithGoogleOAuth();

        if (session) {
          await syncSession(session);
        } else {
          set({
            status: get().session ? 'authenticated' : 'unauthenticated',
          });
        }
      } catch (error) {
        const message = getFriendlyAuthError(error);

        set({
          status: get().session ? 'authenticated' : 'unauthenticated',
          errorMessage: message,
        });
        throw new Error(message);
      }
    },

    completeProfile: async (input) => {
      const user = get().user;

      if (!user) {
        throw new Error('Entre na sua conta antes de criar o perfil.');
      }

      set({ status: 'loading', errorMessage: null });

      try {
        const fotoUrl = await uploadProfilePhotoIfNeeded(input);
        const profile = await saveProfile(user, {
          ...input,
          fotoUrl,
          fotoFile: null,
        });

        await supabase.auth.updateUser({
          data: {
            display_name: profile.nome,
            avatar_url: profile.fotoUrl,
            tipo_perfil: profile.tipo,
            username: profile.username,
          },
        });

        set({
          profile,
          status: 'authenticated',
          errorMessage: null,
        });

        return profile;
      } catch (error) {
        const message = getFriendlyAuthError(error);

        set({ status: 'error', errorMessage: message });
        throw new Error(message);
      }
    },

    updateProfile: async (input) => {
      return get().completeProfile(input);
    },

    signOut: async () => {
      set({ status: 'loading', errorMessage: null });

      const { error } = await supabase.auth.signOut();

      if (error) {
        const message = getFriendlyAuthError(error);

        set({ status: 'error', errorMessage: message });
        throw new Error(message);
      }

      set({
        session: null,
        user: null,
        profile: null,
        status: 'unauthenticated',
        errorMessage: null,
        initialized: true,
      });
    },

    getHomeRoute: () => {
      const profile = get().profile;

      if (isProfileComplete(profile) && profile.tipo === 'empresa') {
        return '/perfil-empresa';
      }

      return '/perfil-pessoal';
    },
  };
});

export function selectIsSignedIn(state: AuthState) {
  return !!state.session;
}

export function selectNeedsProfile(state: AuthState) {
  return !!state.session && !isProfileComplete(state.profile);
}
