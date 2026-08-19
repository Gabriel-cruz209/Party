import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { SocialLinkKey } from '@/services/profile.service';
import {
  getPublicUserProfile,
  getVisibleParticipatingEvents,
  respondToFriendRequest,
  sendFriendRequest,
  type PublicUser,
  type VisibleEvent,
} from '@/services/social.service';
import {
  getOrganizerEventArchive,
  type OrganizerArchiveItem,
} from '@/services/event-social.service';
import { useAuthStore } from '@/stores/auth.store';

const LINK_LABELS: Record<SocialLinkKey, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X',
  linkedin: 'LinkedIn',
  site: 'Site',
};

export default function PublicUserProfileScreen() {
  const { usuarioId } = useLocalSearchParams<{ usuarioId: string }>();
  const currentUser = useAuthStore((state) => state.user);
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [events, setEvents] = useState<VisibleEvent[]>([]);
  const [archive, setArchive] = useState<OrganizerArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!currentUser?.id || !usuarioId) {
      return;
    }

    setLoading(true);

    try {
      const [nextProfile, nextEvents, nextArchive] = await Promise.all([
        getPublicUserProfile(usuarioId, currentUser.id),
        getVisibleParticipatingEvents(currentUser.id, usuarioId),
        getOrganizerEventArchive(usuarioId, currentUser.id),
      ]);

      setProfile(nextProfile);
      setEvents(nextEvents);
      setArchive(nextArchive);
    } catch (error) {
      Alert.alert('Erro ao carregar perfil', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, usuarioId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function handleFriendAction(status?: 'aceita' | 'recusada') {
    if (!currentUser?.id || !profile) {
      return;
    }

    setActionLoading(true);

    try {
      if (profile.amizade?.direction === 'incoming' && profile.amizade.id && status) {
        await respondToFriendRequest(profile.amizade.id, status);
      } else if (!profile.amizade || profile.amizade.status === 'recusada') {
        await sendFriendRequest(currentUser.id, profile.usuarioId);
      }

      await loadProfile();
    } catch (error) {
      Alert.alert('Erro na amizade', error instanceof Error ? error.message : String(error));
    } finally {
      setActionLoading(false);
    }
  }

  const socialEntries = Object.entries(profile?.linksSociais ?? {}).filter(([, value]) =>
    Boolean(value),
  ) as [SocialLinkKey, string][];

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color="#ef4444" />
        <Text style={styles.loadingText}>Carregando perfil...</Text>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Perfil nao encontrado.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
          </Pressable>
        </View>

        <View style={styles.header}>
          {profile.fotoUrl ? (
            <Image source={{ uri: profile.fotoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{profile.nome.charAt(0).toUpperCase()}</Text>
            </View>
          )}

          <View style={styles.identity}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{profile.nome}</Text>
              <View style={[styles.onlineDot, profile.online ? styles.online : styles.offline]} />
            </View>
            <Text style={styles.username}>@{profile.username || 'semusername'}</Text>
            <Text style={styles.bio}>
              {profile.bio || 'Perfil Party pronto para viver novas experiencias.'}
            </Text>
          </View>
        </View>

        {profile.amizade?.direction === 'incoming' ? (
          <View style={styles.dualActions}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => handleFriendAction('aceita')}
              disabled={actionLoading}
            >
              <MaterialCommunityIcons name="check" size={20} color="#ffffff" />
              <Text style={styles.primaryButtonText}>Aceitar</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => handleFriendAction('recusada')}
              disabled={actionLoading}
            >
              <MaterialCommunityIcons name="close" size={20} color="#0f172a" />
              <Text style={styles.secondaryButtonText}>Recusar</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[
              styles.primaryButton,
              profile.amizade?.status === 'aceita' && styles.mutedButton,
              profile.amizade?.status === 'pendente' && styles.mutedButton,
            ]}
            onPress={() => handleFriendAction()}
            disabled={actionLoading || profile.amizade?.status === 'aceita' || profile.amizade?.status === 'pendente'}
          >
            {actionLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <MaterialCommunityIcons
                name={profile.amizade?.status === 'aceita' ? 'account-check-outline' : 'account-plus-outline'}
                size={20}
                color={profile.amizade ? '#475569' : '#ffffff'}
              />
            )}
            <Text style={[styles.primaryButtonText, profile.amizade && styles.mutedButtonText]}>
              {profile.amizade?.status === 'aceita'
                ? 'Amigos'
                : profile.amizade?.status === 'pendente'
                  ? 'Solicitacao enviada'
                  : 'Adicionar amigo'}
            </Text>
          </Pressable>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Redes sociais</Text>
          {socialEntries.length ? (
            socialEntries.map(([key, value]) => (
              <Pressable
                key={key}
                style={styles.linkRow}
                onPress={() => {
                  void Linking.openURL(value);
                }}
              >
                <MaterialCommunityIcons name="link-variant" size={20} color="#ef4444" />
                <View style={styles.linkText}>
                  <Text style={styles.linkLabel}>{LINK_LABELS[key]}</Text>
                  <Text style={styles.linkValue} numberOfLines={1}>
                    {value}
                  </Text>
                </View>
                <MaterialCommunityIcons name="open-in-new" size={18} color="#64748b" />
              </Pressable>
            ))
          ) : (
            <Text style={styles.emptyText}>Nenhuma rede social publica.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Eventos visiveis</Text>
          {events.length ? (
            events.map((event) => (
              <View style={styles.eventRow} key={event.id}>
                <View style={styles.eventIcon}>
                  <MaterialCommunityIcons
                    name={event.tipo === 'privado' ? 'lock-outline' : 'party-popper'}
                    size={20}
                    color="#ef4444"
                  />
                </View>
                <View style={styles.eventText}>
                  <Text style={styles.eventTitle}>{event.titulo}</Text>
                  <Text style={styles.eventMeta} numberOfLines={1}>
                    {event.localNome || 'Local a definir'}
                  </Text>
                  <Text style={styles.eventMeta}>{event.tipo === 'privado' ? 'Privado' : 'Publico'}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Nenhum evento publico ou liberado por amizade.</Text>
          )}
        </View>

        {archive.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Arquivo do organizador</Text>
            {archive.map((item) => (
              <View style={styles.archiveCard} key={item.event.id}>
                <View style={styles.archiveHeader}>
                  <View style={styles.archiveIcon}>
                    <MaterialCommunityIcons name="calendar-check-outline" size={20} color="#0f766e" />
                  </View>
                  <View style={styles.archiveTitleBlock}>
                    <Text style={styles.archiveTitle}>{item.event.titulo}</Text>
                    <Text style={styles.archiveMeta}>
                      {item.event.dataInicio
                        ? new Date(item.event.dataInicio).toLocaleDateString('pt-BR')
                        : 'Evento encerrado'}
                    </Text>
                  </View>
                </View>

                {item.posts.map((post) => (
                  <View style={styles.archiveSnippet} key={post.row.id}>
                    <MaterialCommunityIcons name="post-outline" size={18} color="#ef4444" />
                    <View style={styles.archiveSnippetText}>
                      <Text style={styles.archiveAuthor}>{post.author?.nome ?? 'Participante'}</Text>
                      <Text style={styles.archiveBody} numberOfLines={3}>
                        {post.row.conteudo || 'Imagem publicada no evento.'}
                      </Text>
                      {post.row.midia_url ? (
                        <Image source={{ uri: post.row.midia_url }} style={styles.archiveImage} />
                      ) : null}
                    </View>
                  </View>
                ))}

                {item.messages.map((message) => (
                  <View style={styles.archiveSnippet} key={message.row.id}>
                    <MaterialCommunityIcons name="message-text-outline" size={18} color="#0f766e" />
                    <View style={styles.archiveSnippetText}>
                      <Text style={styles.archiveAuthor}>{message.author?.nome ?? 'Participante'}</Text>
                      <Text style={styles.archiveBody} numberOfLines={2}>
                        {message.row.mensagem}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}
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
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
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
    gap: 22,
    paddingBottom: 34,
    paddingTop: 18,
  },
  topBar: {
    flexDirection: 'row',
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
  header: {
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    backgroundColor: '#e2e8f0',
    borderColor: '#ffffff',
    borderRadius: 64,
    borderWidth: 4,
    height: 128,
    width: 128,
  },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderColor: '#ffffff',
    borderRadius: 64,
    borderWidth: 4,
    height: 128,
    justifyContent: 'center',
    width: 128,
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 48,
    fontWeight: '900',
  },
  identity: {
    alignItems: 'center',
    gap: 7,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  name: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
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
  username: {
    color: '#0f766e',
    fontSize: 15,
    fontWeight: '900',
  },
  bio: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 23,
    maxWidth: 330,
    textAlign: 'center',
  },
  dualActions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  mutedButton: {
    backgroundColor: '#f1f5f9',
  },
  mutedButtonText: {
    color: '#475569',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '900',
  },
  linkRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    padding: 12,
  },
  linkText: {
    flex: 1,
    gap: 2,
  },
  linkLabel: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  linkValue: {
    color: '#64748b',
    fontSize: 13,
  },
  eventRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 78,
    padding: 12,
  },
  eventIcon: {
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  eventText: {
    flex: 1,
    gap: 3,
  },
  eventTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  eventMeta: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  archiveCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  archiveHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  archiveIcon: {
    alignItems: 'center',
    backgroundColor: '#ccfbf1',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  archiveTitleBlock: {
    flex: 1,
    gap: 3,
  },
  archiveTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  archiveMeta: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '800',
  },
  archiveSnippet: {
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
  },
  archiveSnippetText: {
    flex: 1,
    gap: 4,
  },
  archiveAuthor: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
  },
  archiveBody: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  archiveImage: {
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    height: 132,
    marginTop: 4,
    width: '100%',
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
