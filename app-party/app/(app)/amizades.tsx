import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getFriendRequests,
  getFriends,
  respondToFriendRequest,
  type FriendRequest,
  type PublicUser,
} from '@/services/social.service';
import { useAuthStore } from '@/stores/auth.store';
import { useSocialStore } from '@/stores/social.store';

export default function AmizadesScreen() {
  const currentUser = useAuthStore((state) => state.user);
  const unreadCount = useSocialStore((state) => state.unreadFriendRequestCount);
  const clearNotifications = useSocialStore((state) => state.clearFriendRequestNotification);
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentUser?.id) {
      return;
    }

    setLoading(true);

    try {
      const [nextFriends, requests] = await Promise.all([
        getFriends(currentUser.id),
        getFriendRequests(currentUser.id),
      ]);

      setFriends(nextFriends);
      setIncoming(requests.incoming);
      setOutgoing(requests.outgoing);
    } catch (error) {
      Alert.alert('Erro ao carregar amizades', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData, unreadCount]);

  async function respond(requestId: string, status: 'aceita' | 'recusada') {
    setRespondingTo(requestId);

    try {
      await respondToFriendRequest(requestId, status);
      clearNotifications();
      await loadData();
    } catch (error) {
      Alert.alert('Erro na solicitacao', error instanceof Error ? error.message : String(error));
    } finally {
      setRespondingTo(null);
    }
  }

  function openProfile(userId: string) {
    router.push({
      pathname: '/usuarios/[usuarioId]',
      params: { usuarioId: userId },
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Amigos</Text>
          <Text style={styles.subtitle}>Solicitacoes, respostas e presenca online.</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#ef4444" />
          <Text style={styles.loadingText}>Carregando amizades...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Solicitacoes recebidas</Text>
            {incoming.length ? (
              incoming.map((request) => (
                <View style={styles.requestRow} key={request.id}>
                  <UserAvatar user={request.user} />
                  <View style={styles.requestText}>
                    <Text style={styles.name}>{request.user.nome}</Text>
                    <Text style={styles.username}>@{request.user.username || 'semusername'}</Text>
                  </View>
                  <View style={styles.requestActions}>
                    <Pressable
                      style={styles.acceptButton}
                      onPress={() => respond(request.id, 'aceita')}
                      disabled={respondingTo === request.id}
                    >
                      <MaterialCommunityIcons name="check" size={18} color="#ffffff" />
                    </Pressable>
                    <Pressable
                      style={styles.rejectButton}
                      onPress={() => respond(request.id, 'recusada')}
                      disabled={respondingTo === request.id}
                    >
                      <MaterialCommunityIcons name="close" size={18} color="#0f172a" />
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Nenhuma solicitacao pendente.</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amigos</Text>
            {friends.length ? (
              friends.map((friend) => (
                <Pressable
                  style={styles.friendRow}
                  key={friend.usuarioId}
                  onPress={() => openProfile(friend.usuarioId)}
                >
                  <UserAvatar user={friend} />
                  <View style={styles.friendText}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>
                        {friend.nome}
                      </Text>
                      <View style={[styles.onlineDot, friend.online ? styles.online : styles.offline]} />
                    </View>
                    <Text style={styles.username} numberOfLines={1}>
                      {friend.online ? 'Online agora' : 'Offline'}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color="#94a3b8" />
                </Pressable>
              ))
            ) : (
              <Text style={styles.emptyText}>Voce ainda nao tem amigos adicionados.</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Enviadas</Text>
            {outgoing.length ? (
              outgoing.map((request) => (
                <Pressable
                  style={styles.friendRow}
                  key={request.id}
                  onPress={() => openProfile(request.user.usuarioId)}
                >
                  <UserAvatar user={request.user} />
                  <View style={styles.friendText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {request.user.nome}
                    </Text>
                    <Text style={styles.username} numberOfLines={1}>
                      Pendente para @{request.user.username || 'semusername'}
                    </Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <Text style={styles.emptyText}>Nenhuma solicitacao enviada.</Text>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function UserAvatar({ user }: { user: PublicUser }) {
  if (user.fotoUrl) {
    return <Image source={{ uri: user.fotoUrl }} style={styles.avatar} />;
  }

  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarInitial}>{user.nome.charAt(0).toUpperCase()}</Text>
    </View>
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
    paddingBottom: 18,
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
  title: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 15,
  },
  loadingBox: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  loadingText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '700',
  },
  content: {
    gap: 24,
    paddingBottom: 34,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '900',
  },
  requestRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 76,
    padding: 12,
  },
  friendRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 76,
    padding: 12,
  },
  avatar: {
    backgroundColor: '#e2e8f0',
    borderRadius: 24,
    height: 48,
    width: 48,
  },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  requestText: {
    flex: 1,
    gap: 3,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 42,
  },
  rejectButton: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 42,
  },
  friendText: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  name: {
    color: '#0f172a',
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  username: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  onlineDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  online: {
    backgroundColor: '#22c55e',
  },
  offline: {
    backgroundColor: '#cbd5e1',
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
