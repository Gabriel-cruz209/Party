import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSocialStore } from '@/stores/social.store';

export function FriendRequestToast() {
  const notification = useSocialStore((state) => state.friendRequestNotifications[0]);
  const clearNotification = useSocialStore((state) => state.clearFriendRequestNotification);

  if (!notification) {
    return null;
  }

  const displayName = notification.fromUser?.nome || 'Alguem';

  function openRequests() {
    clearNotification(notification.id);
    router.push('/amizades');
  }

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Pressable style={styles.toast} onPress={openRequests}>
        {notification.fromUser?.fotoUrl ? (
          <Image source={{ uri: notification.fromUser.fotoUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <MaterialCommunityIcons name="account-plus-outline" size={22} color="#ffffff" />
          </View>
        )}

        <View style={styles.textGroup}>
          <Text style={styles.title}>Nova solicitacao</Text>
          <Text style={styles.message} numberOfLines={1}>
            {displayName} quer ser seu amigo no Party.
          </Text>
        </View>

        <Pressable
          hitSlop={10}
          onPress={(event) => {
            event.stopPropagation();
            clearNotification(notification.id);
          }}
        >
          <MaterialCommunityIcons name="close" size={20} color="#64748b" />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    left: 16,
    position: 'absolute',
    right: 16,
    top: 54,
    zIndex: 30,
  },
  toast: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    padding: 12,
  },
  avatar: {
    backgroundColor: '#e2e8f0',
    borderRadius: 22,
    height: 44,
    width: 44,
  },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  textGroup: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  message: {
    color: '#475569',
    fontSize: 14,
  },
});
