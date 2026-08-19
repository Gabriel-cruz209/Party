import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { CloudinaryUploadFile } from '@/lib/cloudinary';
import {
  createEventPost,
  deleteEventMessage,
  deleteEventPost,
  getEventSocialBundle,
  removeParticipantFromEventChat,
  sendEventMessage,
  setPostReaction,
  subscribeToEventSocial,
  translateEventChatMessage,
  type EventChatMessage,
  type EventChatParticipant,
  type EventPost,
  type EventReactionType,
  type EventSocialBundle,
} from '@/services/event-social.service';
import { useAuthStore } from '@/stores/auth.store';

type SocialTab = 'chat' | 'posts';

const translationCache = new Map<string, string | null>();

const REACTION_OPTIONS: { type: EventReactionType; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }[] = [
  { type: 'curtir', icon: 'thumb-up-outline', label: 'Curtir' },
  { type: 'amei', icon: 'heart-outline', label: 'Amei' },
  { type: 'fogo', icon: 'fire', label: 'Fogo' },
  { type: 'uau', icon: 'emoticon-excited-outline', label: 'Uau' },
];

export default function EventSocialScreen() {
  const { eventoId } = useLocalSearchParams<{ eventoId: string }>();
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const [bundle, setBundle] = useState<EventSocialBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SocialTab>('chat');
  const [message, setMessage] = useState('');
  const [postText, setPostText] = useState('');
  const [postImageUri, setPostImageUri] = useState('');
  const [postImageFile, setPostImageFile] = useState<CloudinaryUploadFile | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [publishingPost, setPublishingPost] = useState(false);

  const loadSocial = useCallback(async () => {
    if (!user?.id || !eventoId) {
      return;
    }

    setLoading(true);

    try {
      setBundle(await getEventSocialBundle(eventoId, user.id));
    } catch (error) {
      Alert.alert('Acesso ao evento', error instanceof Error ? error.message : String(error));
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [eventoId, user?.id]);

  useEffect(() => {
    void loadSocial();
  }, [loadSocial]);

  useEffect(() => {
    if (!eventoId || !user?.id) {
      return undefined;
    }

    return subscribeToEventSocial(eventoId, () => {
      void getEventSocialBundle(eventoId, user.id)
        .then(setBundle)
        .catch(() => undefined);
    });
  }, [eventoId, user?.id]);

  const visibleMessages = useMemo(() => bundle?.messages ?? [], [bundle?.messages]);
  const visiblePosts = useMemo(() => bundle?.posts ?? [], [bundle?.posts]);

  async function handleSendMessage() {
    if (!eventoId || !user?.id || sendingMessage) {
      return;
    }

    setSendingMessage(true);

    try {
      await sendEventMessage(eventoId, user.id, message);
      setMessage('');
      await loadSocial();
    } catch (error) {
      Alert.alert('Erro no chat', error instanceof Error ? error.message : String(error));
    } finally {
      setSendingMessage(false);
    }
  }

  async function pickPostImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permissao necessaria', 'Autorize o acesso as fotos para postar uma imagem.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      mediaTypes: ['images'],
      quality: 0.86,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];

    setPostImageUri(asset.uri);
    setPostImageFile({
      uri: asset.uri,
      name: asset.fileName ?? `post-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    });
  }

  async function handleCreatePost() {
    if (!eventoId || !user?.id || publishingPost) {
      return;
    }

    setPublishingPost(true);

    try {
      await createEventPost({
        content: postText,
        currentUserId: user.id,
        eventId: eventoId,
        imageFile: postImageFile,
      });
      setPostText('');
      setPostImageFile(null);
      setPostImageUri('');
      await loadSocial();
    } catch (error) {
      Alert.alert('Erro ao postar', error instanceof Error ? error.message : String(error));
    } finally {
      setPublishingPost(false);
    }
  }

  async function handleReaction(post: EventPost, reactionType: EventReactionType) {
    if (!eventoId || !user?.id) {
      return;
    }

    try {
      await setPostReaction({
        currentReaction: post.myReaction,
        currentUserId: user.id,
        eventId: eventoId,
        postId: post.row.id,
        reactionType,
      });
      await loadSocial();
    } catch (error) {
      Alert.alert('Erro na reacao', error instanceof Error ? error.message : String(error));
    }
  }

  function confirmDeleteMessage(messageId: string) {
    if (!eventoId || !user?.id) {
      return;
    }

    Alert.alert('Excluir mensagem', 'A mensagem sera removida do chat do evento.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          void deleteEventMessage({
            eventId: eventoId,
            messageId,
            moderatorUserId: user.id,
          }).then(loadSocial);
        },
      },
    ]);
  }

  function confirmDeletePost(postId: string) {
    if (!eventoId || !user?.id) {
      return;
    }

    Alert.alert('Excluir post', 'O post sera removido da comunidade do evento.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          void deleteEventPost({
            eventId: eventoId,
            moderatorUserId: user.id,
            postId,
          }).then(loadSocial);
        },
      },
    ]);
  }

  function confirmRemoveParticipant(participant: EventChatParticipant) {
    if (!eventoId || !user?.id || !participant.profile) {
      return;
    }

    Alert.alert(
      'Remover do chat',
      `${participant.profile.nome} nao podera mais enviar ou ler mensagens deste evento.`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => {
            void removeParticipantFromEventChat({
              eventId: eventoId,
              moderatorUserId: user.id,
              targetUserId: participant.profile?.usuarioId ?? participant.row.usuario_id,
            }).then(loadSocial);
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color="#ef4444" />
        <Text style={styles.loadingText}>Carregando comunidade...</Text>
      </SafeAreaView>
    );
  }

  if (!bundle) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chat indisponivel para sua conta.</Text>
        <Pressable style={styles.backHomeButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#ffffff" />
          <Text style={styles.backHomeButtonText}>Voltar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Comunidade</Text>
          <Text style={styles.subtitle}>{bundle.access.event.titulo}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <TabButton active={activeTab === 'chat'} label="Chat" onPress={() => setActiveTab('chat')} />
        <TabButton active={activeTab === 'posts'} label="Posts" onPress={() => setActiveTab('posts')} />
      </View>

      {activeTab === 'chat' ? (
        <View style={styles.body}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {bundle.access.isOrganizer ? (
              <ModerationStrip
                participants={bundle.participants}
                organizerUserId={bundle.access.organizer?.usuarioId}
                onRemove={confirmRemoveParticipant}
              />
            ) : null}

            {visibleMessages.length ? (
              visibleMessages.map((item) => (
                <MessageBubble
                  canModerate={bundle.access.isOrganizer && !item.row.excluido_em}
                  item={item}
                  key={item.row.id}
                  onDelete={() => confirmDeleteMessage(item.row.id)}
                  targetLanguage={profile?.idiomaPreferido ?? 'pt-BR'}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>Nenhuma mensagem ainda.</Text>
            )}
          </ScrollView>

          <View style={styles.composer}>
            <TextInput
              multiline
              onChangeText={setMessage}
              placeholder="Mensagem para participantes..."
              placeholderTextColor="#94a3b8"
              style={styles.messageInput}
              value={message}
            />
            <Pressable style={styles.sendButton} onPress={handleSendMessage} disabled={sendingMessage}>
              {sendingMessage ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <MaterialCommunityIcons name="send" size={20} color="#ffffff" />
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.postComposer}>
            <TextInput
              multiline
              onChangeText={setPostText}
              placeholder="Publique uma lembranca do evento..."
              placeholderTextColor="#94a3b8"
              style={styles.postInput}
              value={postText}
            />
            {postImageUri ? <Image source={{ uri: postImageUri }} style={styles.previewImage} /> : null}
            <View style={styles.postActions}>
              <Pressable style={styles.secondaryAction} onPress={pickPostImage}>
                <MaterialCommunityIcons name="image-plus" size={20} color="#0f172a" />
                <Text style={styles.secondaryActionText}>Imagem</Text>
              </Pressable>
              {postImageUri ? (
                <Pressable
                  style={styles.secondaryAction}
                  onPress={() => {
                    setPostImageFile(null);
                    setPostImageUri('');
                  }}
                >
                  <MaterialCommunityIcons name="close" size={20} color="#0f172a" />
                  <Text style={styles.secondaryActionText}>Remover</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.publishButton} onPress={handleCreatePost} disabled={publishingPost}>
                {publishingPost ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <MaterialCommunityIcons name="plus" size={20} color="#ffffff" />
                )}
                <Text style={styles.publishButtonText}>Postar</Text>
              </Pressable>
            </View>
          </View>

          {visiblePosts.length ? (
            visiblePosts.map((post) => (
              <PostCard
                canModerate={bundle.access.isOrganizer && !post.row.excluido_em}
                key={post.row.id}
                onDelete={() => confirmDeletePost(post.row.id)}
                onReact={(reaction) => handleReaction(post, reaction)}
                post={post}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>Nenhum post ainda.</Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ModerationStrip({
  participants,
  organizerUserId,
  onRemove,
}: {
  participants: EventChatParticipant[];
  organizerUserId?: string;
  onRemove: (participant: EventChatParticipant) => void;
}) {
  const removable = participants.filter((item) => item.row.usuario_id !== organizerUserId);

  if (!removable.length) {
    return null;
  }

  return (
    <View style={styles.moderationBox}>
      <Text style={styles.moderationTitle}>Moderar chat</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.participantRail}>
          {removable.map((participant) => (
            <Pressable
              key={participant.row.usuario_id}
              style={[styles.participantChip, participant.row.removido_chat_em && styles.participantChipMuted]}
              onPress={() => onRemove(participant)}
              disabled={Boolean(participant.row.removido_chat_em)}
            >
              <Text style={styles.participantChipText} numberOfLines={1}>
                {participant.profile?.nome ?? 'Participante'}
              </Text>
              <MaterialCommunityIcons
                name={participant.row.removido_chat_em ? 'minus-circle-outline' : 'account-cancel-outline'}
                size={17}
                color={participant.row.removido_chat_em ? '#64748b' : '#991b1b'}
              />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function MessageBubble({
  canModerate,
  item,
  onDelete,
  targetLanguage,
}: {
  canModerate: boolean;
  item: EventChatMessage;
  onDelete: () => void;
  targetLanguage: string;
}) {
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    let active = true;
    const cacheKey = `${item.row.id}:${targetLanguage}:${item.row.mensagem}`;

    setTranslatedText(null);

    if (item.row.excluido_em || targetLanguage.toLowerCase().startsWith('pt')) {
      return () => {
        active = false;
      };
    }

    if (translationCache.has(cacheKey)) {
      setTranslatedText(translationCache.get(cacheKey) ?? null);
      return () => {
        active = false;
      };
    }

    setTranslating(true);

    void translateEventChatMessage(item.row.mensagem, targetLanguage)
      .then((translation) => {
        translationCache.set(cacheKey, translation);

        if (active) {
          setTranslatedText(translation);
        }
      })
      .catch(() => {
        translationCache.set(cacheKey, null);
      })
      .finally(() => {
        if (active) {
          setTranslating(false);
        }
      });

    return () => {
      active = false;
    };
  }, [item.row.excluido_em, item.row.id, item.row.mensagem, targetLanguage]);

  return (
    <View style={[styles.messageBubble, item.row.excluido_em && styles.deletedBubble]}>
      <View style={styles.messageHeader}>
        <Text style={styles.authorName}>{item.author?.nome ?? 'Participante'}</Text>
        <Text style={styles.messageTime}>
          {item.row.criado_em
            ? new Date(item.row.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            : ''}
        </Text>
        {canModerate ? (
          <Pressable style={styles.deleteIconButton} onPress={onDelete}>
            <MaterialCommunityIcons name="trash-can-outline" size={18} color="#991b1b" />
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.messageText, item.row.excluido_em && styles.deletedText]}>
        {item.row.mensagem}
      </Text>
      {translating ? <Text style={styles.translationMeta}>Traduzindo...</Text> : null}
      {translatedText ? (
        <View style={styles.translationBox}>
          <Text style={styles.translationMeta}>Traducao automatica</Text>
          <Text style={styles.translationText}>{translatedText}</Text>
        </View>
      ) : null}
    </View>
  );
}

function PostCard({
  canModerate,
  onDelete,
  onReact,
  post,
}: {
  canModerate: boolean;
  onDelete: () => void;
  onReact: (reaction: EventReactionType) => void;
  post: EventPost;
}) {
  return (
    <View style={[styles.postCard, post.row.excluido_em && styles.deletedBubble]}>
      <View style={styles.postHeader}>
        <View style={styles.postAuthor}>
          {post.author?.fotoUrl ? (
            <Image source={{ uri: post.author.fotoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{(post.author?.nome ?? '?').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.postAuthorText}>
            <Text style={styles.authorName}>{post.author?.nome ?? 'Participante'}</Text>
            <Text style={styles.postMeta}>
              {post.row.criado_em ? new Date(post.row.criado_em).toLocaleString('pt-BR') : ''}
            </Text>
          </View>
        </View>
        {canModerate ? (
          <Pressable style={styles.deleteIconButton} onPress={onDelete}>
            <MaterialCommunityIcons name="trash-can-outline" size={19} color="#991b1b" />
          </Pressable>
        ) : null}
      </View>

      {post.row.excluido_em ? (
        <Text style={styles.deletedText}>Post removido pela organizacao.</Text>
      ) : (
        <>
          {post.row.conteudo ? <Text style={styles.postContent}>{post.row.conteudo}</Text> : null}
          {post.row.midia_url ? <Image source={{ uri: post.row.midia_url }} style={styles.postImage} /> : null}
          <View style={styles.reactionRail}>
            {REACTION_OPTIONS.map((reaction) => (
              <Pressable
                key={reaction.type}
                style={[styles.reactionButton, post.myReaction === reaction.type && styles.reactionButtonActive]}
                onPress={() => onReact(reaction.type)}
              >
                <MaterialCommunityIcons
                  name={reaction.icon}
                  size={18}
                  color={post.myReaction === reaction.type ? '#ffffff' : '#0f172a'}
                />
                <Text
                  style={[
                    styles.reactionText,
                    post.myReaction === reaction.type && styles.reactionTextActive,
                  ]}
                >
                  {post.reactionCounts[reaction.type]}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
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
    paddingHorizontal: 20,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  backHomeButton: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  backHomeButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
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
    gap: 3,
  },
  title: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '800',
  },
  tabs: {
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
    padding: 4,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#0f766e',
  },
  tabButtonText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '900',
  },
  tabButtonTextActive: {
    color: '#ffffff',
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 22,
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
  moderationBox: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  moderationTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  participantRail: {
    flexDirection: 'row',
    gap: 8,
  },
  participantChip: {
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    maxWidth: 170,
    minHeight: 38,
    paddingHorizontal: 10,
  },
  participantChipMuted: {
    backgroundColor: '#f1f5f9',
  },
  participantChipText: {
    color: '#0f172a',
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '900',
  },
  messageBubble: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    padding: 12,
  },
  deletedBubble: {
    backgroundColor: '#f1f5f9',
  },
  messageHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  authorName: {
    color: '#0f172a',
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  messageTime: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
  },
  deleteIconButton: {
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  messageText: {
    color: '#334155',
    fontSize: 16,
    lineHeight: 23,
  },
  deletedText: {
    color: '#64748b',
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  translationBox: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 10,
  },
  translationMeta: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '900',
  },
  translationText: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 21,
  },
  composer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 16,
    paddingTop: 8,
  },
  messageInput: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0f172a',
    flex: 1,
    fontSize: 15,
    maxHeight: 110,
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  postComposer: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  postInput: {
    color: '#0f172a',
    fontSize: 15,
    minHeight: 86,
    textAlignVertical: 'top',
  },
  previewImage: {
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    height: 180,
    width: '100%',
  },
  postActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  secondaryActionText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  publishButton: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  publishButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  postCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  postHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  postAuthor: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  avatar: {
    backgroundColor: '#e2e8f0',
    borderRadius: 20,
    height: 40,
    width: 40,
  },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  postAuthorText: {
    flex: 1,
    gap: 2,
  },
  postMeta: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
  },
  postContent: {
    color: '#334155',
    fontSize: 16,
    lineHeight: 23,
  },
  postImage: {
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    height: 230,
    width: '100%',
  },
  reactionRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reactionButton: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 9,
  },
  reactionButtonActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  reactionText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
  },
  reactionTextActive: {
    color: '#ffffff',
  },
});
