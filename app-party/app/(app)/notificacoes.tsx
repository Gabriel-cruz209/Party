import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getNotificationRoute,
  type PartyNotification,
} from '@/services/notification.service';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationStore } from '@/stores/notification.store';

const TYPE_ICON: Record<
  PartyNotification['tipo'],
  keyof typeof MaterialCommunityIcons.glyphMap
> = {
  amizade: 'account-plus-outline',
  evento_amigo: 'calendar-star',
  evento_comecando: 'clock-alert-outline',
  ingresso_confirmado: 'ticket-confirmation-outline',
  sistema: 'bell-outline',
  suporte: 'lifebuoy',
};

export default function NotificationsCenterScreen() {
  const user = useAuthStore((state) => state.user);
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const loading = useNotificationStore((state) => state.loading);
  const loadNotifications = useNotificationStore((state) => state.loadNotifications);
  const markRead = useNotificationStore((state) => state.markRead);
  const markAllRead = useNotificationStore((state) => state.markAllRead);

  useEffect(() => {
    if (user?.id) {
      void loadNotifications(user.id);
    }
  }, [loadNotifications, user?.id]);

  async function openNotification(notification: PartyNotification) {
    if (!notification.lida) {
      await markRead(notification.id);
    }

    router.push(getNotificationRoute(notification) as never);
  }

  async function handleMarkAllRead() {
    if (!user?.id || !unreadCount) {
      return;
    }

    await markAllRead(user.id);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
        </Pressable>
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Notificacoes</Text>
            {unreadCount ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.subtitle}>Convites, ingressos e alertas dos seus eventos.</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.markAllButton, !unreadCount && styles.disabledButton]}
          onPress={handleMarkAllRead}
          disabled={!unreadCount}
        >
          <MaterialCommunityIcons name="check-all" size={19} color={unreadCount ? '#0f172a' : '#94a3b8'} />
          <Text style={[styles.markAllText, !unreadCount && styles.disabledText]}>Marcar lidas</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              if (user?.id) {
                void loadNotifications(user.id);
              }
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading && !notifications.length ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#ef4444" />
            <Text style={styles.loadingText}>Carregando notificacoes...</Text>
          </View>
        ) : null}

        {notifications.length ? (
          notifications.map((notification) => (
            <Pressable
              key={notification.id}
              style={[styles.notificationRow, !notification.lida && styles.notificationRowUnread]}
              onPress={() => {
                void openNotification(notification);
              }}
            >
              <View style={[styles.iconBox, !notification.lida && styles.iconBoxUnread]}>
                <MaterialCommunityIcons
                  name={TYPE_ICON[notification.tipo]}
                  size={22}
                  color={!notification.lida ? '#ffffff' : '#ef4444'}
                />
              </View>
              <View style={styles.notificationText}>
                <Text style={styles.notificationTitle}>{notification.titulo}</Text>
                <Text style={styles.notificationMessage}>{notification.mensagem}</Text>
                <Text style={styles.notificationMeta}>
                  {notification.criadoEm ? new Date(notification.criadoEm).toLocaleString('pt-BR') : 'Agora'}
                </Text>
              </View>
              {!notification.lida ? <View style={styles.unreadDot} /> : null}
            </Pressable>
          ))
        ) : (
          <Text style={styles.emptyText}>Nenhuma notificacao por enquanto.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 14,
    paddingTop: 18,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  title: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  badge: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 11,
    minWidth: 22,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  actionRow: {
    alignItems: 'flex-end',
    paddingBottom: 10,
  },
  markAllButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  markAllText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.65,
  },
  disabledText: {
    color: '#94a3b8',
  },
  content: {
    gap: 12,
    paddingBottom: 34,
  },
  loadingBox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 32,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '700',
  },
  notificationRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 88,
    padding: 12,
  },
  notificationRowUnread: {
    borderColor: '#fecaca',
  },
  iconBox: {
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  iconBoxUnread: {
    backgroundColor: '#ef4444',
  },
  notificationText: {
    flex: 1,
    gap: 4,
  },
  notificationTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  notificationMessage: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  notificationMeta: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '800',
  },
  unreadDot: {
    backgroundColor: '#ef4444',
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  emptyText: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    color: '#64748b',
    fontSize: 15,
    lineHeight: 22,
    padding: 16,
  },
});
