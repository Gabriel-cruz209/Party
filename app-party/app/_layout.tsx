import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { FriendRequestToast } from '@/components/FriendRequestToast';
import { isProfileComplete } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationStore } from '@/stores/notification.store';
import { useSocialStore } from '@/stores/social.store';

export default function RootLayout() {
  const initialize = useAuthStore((state) => state.initialize);
  const initialized = useAuthStore((state) => state.initialized);
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const status = useAuthStore((state) => state.status);
  const startFriendRequestSubscription = useSocialStore(
    (state) => state.startFriendRequestSubscription,
  );
  const stopFriendRequestSubscription = useSocialStore(
    (state) => state.stopFriendRequestSubscription,
  );
  const initializeNotifications = useNotificationStore((state) => state.initializeNotifications);
  const startNotificationSubscription = useNotificationStore(
    (state) => state.startNotificationSubscription,
  );
  const stopNotificationSubscription = useNotificationStore(
    (state) => state.stopNotificationSubscription,
  );

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    function redirect(notification: Notifications.Notification) {
      const url = notification.request.content.data?.url;

      if (typeof url === 'string') {
        router.push(url as never);
      }
    }

    const response = Notifications.getLastNotificationResponse();

    if (response?.notification) {
      redirect(response.notification);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((nextResponse) => {
      redirect(nextResponse.notification);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const isSignedIn = !!session;
  const profileReady = isProfileComplete(profile);
  const isBooting = !initialized || status === 'idle';
  const isCheckingProfile = initialized && isSignedIn && status === 'loading' && !profile;

  useEffect(() => {
    if (initialized && isSignedIn && profileReady && session?.user.id) {
      startFriendRequestSubscription(session.user.id);
      startNotificationSubscription(session.user.id);
      void initializeNotifications(session.user.id);

      return () => {
        stopFriendRequestSubscription();
        stopNotificationSubscription();
      };
    }

    stopFriendRequestSubscription();
    stopNotificationSubscription();
  }, [
    initializeNotifications,
    initialized,
    isSignedIn,
    profileReady,
    session?.user.id,
    startFriendRequestSubscription,
    startNotificationSubscription,
    stopFriendRequestSubscription,
    stopNotificationSubscription,
  ]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />

        <Stack.Protected guard={initialized && !isSignedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={initialized && isSignedIn && !profileReady && !isCheckingProfile}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>

        <Stack.Protected guard={initialized && isSignedIn && profileReady}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
      {isBooting || isCheckingProfile ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#ef4444" />
          <Text style={styles.loadingText}>Preparando o Party...</Text>
        </View>
      ) : null}
      <FriendRequestToast />
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    gap: 12,
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  loadingText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '700',
  },
});
