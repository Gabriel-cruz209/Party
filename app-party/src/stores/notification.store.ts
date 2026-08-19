import { create } from 'zustand';

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  presentLocalNotification,
  registerExpoPushToken,
  scheduleUpcomingEventStartPushes,
  subscribeToNotifications,
  syncUpcomingEventStartNotifications,
  type PartyNotification,
} from '@/services/notification.service';

type NotificationState = {
  notifications: PartyNotification[];
  unreadCount: number;
  latestNotification: PartyNotification | null;
  loading: boolean;
  subscribedUserId: string | null;
  loadNotifications: (userId: string) => Promise<void>;
  initializeNotifications: (userId: string) => Promise<void>;
  startNotificationSubscription: (userId: string) => void;
  stopNotificationSubscription: () => void;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: (userId: string) => Promise<void>;
  clearLatestNotification: () => void;
};

let unsubscribeNotifications: (() => void) | null = null;
let initializationByUser = new Set<string>();

function countUnread(notifications: PartyNotification[]) {
  return notifications.filter((notification) => !notification.lida).length;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  latestNotification: null,
  loading: false,
  subscribedUserId: null,

  loadNotifications: async (userId) => {
    set({ loading: true });

    try {
      const notifications = await getNotifications(userId);

      set({
        notifications,
        unreadCount: countUnread(notifications),
      });
    } finally {
      set({ loading: false });
    }
  },

  initializeNotifications: async (userId) => {
    if (initializationByUser.has(userId)) {
      return;
    }

    initializationByUser.add(userId);

    await Promise.allSettled([
      registerExpoPushToken(userId),
      syncUpcomingEventStartNotifications(userId),
      scheduleUpcomingEventStartPushes(userId),
    ]);

    await get().loadNotifications(userId);
  },

  startNotificationSubscription: (userId) => {
    if (get().subscribedUserId === userId && unsubscribeNotifications) {
      return;
    }

    get().stopNotificationSubscription();
    set({ subscribedUserId: userId });
    void get().loadNotifications(userId);

    unsubscribeNotifications = subscribeToNotifications(
      userId,
      () => {
        void get().loadNotifications(userId);
      },
      (notification) => {
        set((state) => ({
          latestNotification: notification,
          notifications: [notification, ...state.notifications.filter((item) => item.id !== notification.id)],
          unreadCount: state.unreadCount + (notification.lida ? 0 : 1),
        }));

        void presentLocalNotification(notification).catch(() => undefined);
      },
    );
  },

  stopNotificationSubscription: () => {
    unsubscribeNotifications?.();
    unsubscribeNotifications = null;
    set({
      latestNotification: null,
      notifications: [],
      subscribedUserId: null,
      unreadCount: 0,
    });
  },

  markRead: async (notificationId) => {
    await markNotificationRead(notificationId);
    set((state) => {
      const notifications = state.notifications.map((notification) =>
        notification.id === notificationId
          ? { ...notification, lida: true, lidaEm: new Date().toISOString() }
          : notification,
      );

      return {
        notifications,
        unreadCount: countUnread(notifications),
      };
    });
  },

  markAllRead: async (userId) => {
    await markAllNotificationsRead(userId);
    const now = new Date().toISOString();

    set((state) => ({
      notifications: state.notifications.map((notification) => ({
        ...notification,
        lida: true,
        lidaEm: notification.lidaEm ?? now,
      })),
      unreadCount: 0,
    }));
  },

  clearLatestNotification: () => {
    set({ latestNotification: null });
  },
}));

export function resetNotificationInitializationCache() {
  initializationByUser = new Set<string>();
}
