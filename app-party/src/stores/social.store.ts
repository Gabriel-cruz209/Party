import type { RealtimeChannel } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import {
  getPublicUserProfile,
  isFriendRequestInsertPayload,
  type PublicUser,
} from '@/services/social.service';

export type FriendRequestNotification = {
  id: string;
  amizadeId: string;
  fromUser: PublicUser | null;
  createdAt: string;
};

type SocialState = {
  friendRequestNotifications: FriendRequestNotification[];
  unreadFriendRequestCount: number;
  startFriendRequestSubscription: (currentUserId: string) => void;
  stopFriendRequestSubscription: () => void;
  clearFriendRequestNotification: (id?: string) => void;
};

let friendRequestChannel: RealtimeChannel | null = null;
let subscribedUserId: string | null = null;

export const useSocialStore = create<SocialState>((set, get) => ({
  friendRequestNotifications: [],
  unreadFriendRequestCount: 0,

  startFriendRequestSubscription: (currentUserId) => {
    if (friendRequestChannel && subscribedUserId === currentUserId) {
      return;
    }

    get().stopFriendRequestSubscription();
    subscribedUserId = currentUserId;

    friendRequestChannel = supabase
      .channel(`party-friend-requests:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'amizades',
          filter: `destinatario_id=eq.${currentUserId}`,
        },
        async (payload) => {
          if (!isFriendRequestInsertPayload(payload)) {
            return;
          }

          const fromUser = await getPublicUserProfile(payload.new.solicitante_id, currentUserId);
          const notification: FriendRequestNotification = {
            id: `${payload.new.id}:${Date.now()}`,
            amizadeId: payload.new.id,
            fromUser,
            createdAt: new Date().toISOString(),
          };

          set((state) => ({
            friendRequestNotifications: [notification, ...state.friendRequestNotifications].slice(
              0,
              5,
            ),
            unreadFriendRequestCount: state.unreadFriendRequestCount + 1,
          }));
        },
      )
      .subscribe();
  },

  stopFriendRequestSubscription: () => {
    if (friendRequestChannel) {
      void supabase.removeChannel(friendRequestChannel);
    }

    friendRequestChannel = null;
    subscribedUserId = null;
  },

  clearFriendRequestNotification: (id) => {
    if (!id) {
      set({
        friendRequestNotifications: [],
        unreadFriendRequestCount: 0,
      });
      return;
    }

    set((state) => ({
      friendRequestNotifications: state.friendRequestNotifications.filter(
        (notification) => notification.id !== id,
      ),
      unreadFriendRequestCount: Math.max(0, state.unreadFriendRequestCount - 1),
    }));
  },
}));
