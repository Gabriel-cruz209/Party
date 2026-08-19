import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  clearSupportConversation,
  loadSupportConversation,
  openHumanSupportTicket,
  sendSupportBotMessage,
  type SupportMessage,
} from '@/services/support.service';
import { useAuthStore } from '@/stores/auth.store';

export default function SupportScreen() {
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState('');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [openingTicket, setOpeningTicket] = useState(false);

  const loadConversation = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    setLoading(true);

    try {
      const history = await loadSupportConversation(user.id);

      setMessages(
        history.length
          ? history
          : [
              {
                id: 'welcome',
                content: 'Oi, eu sou o suporte do Party. Posso ajudar com conta, eventos, ingressos, mapa e comunidade.',
                createdAt: new Date().toISOString(),
                role: 'assistant',
              },
            ],
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  async function handleSend() {
    if (!user?.id || sending) {
      return;
    }

    setSending(true);

    try {
      const nextMessages = await sendSupportBotMessage({
        message: input,
        profile,
        userId: user.id,
      });

      setMessages(nextMessages);
      setInput('');
    } catch (error) {
      Alert.alert('Erro no suporte', error instanceof Error ? error.message : String(error));
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    if (!user?.id) {
      return;
    }

    await clearSupportConversation(user.id);
    await loadConversation();
  }

  async function handleOpenTicket() {
    if (!user?.id || openingTicket) {
      return;
    }

    setOpeningTicket(true);

    try {
      await openHumanSupportTicket({
        message: ticketMessage || input,
        subject: ticketSubject || 'Atendimento Party',
        userId: user.id,
      });

      setTicketSubject('');
      setTicketMessage('');
      Alert.alert('Ticket aberto', 'Seu chamado humano foi registrado.');
    } catch (error) {
      Alert.alert('Erro ao abrir ticket', error instanceof Error ? error.message : String(error));
    } finally {
      setOpeningTicket(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Suporte</Text>
            <Text style={styles.subtitle}>Chatbot Groq e ticket humano.</Text>
          </View>
          <Pressable style={styles.clearButton} onPress={handleClear}>
            <MaterialCommunityIcons name="broom" size={20} color="#0f172a" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#ef4444" />
              <Text style={styles.loadingText}>Carregando conversa...</Text>
            </View>
          ) : (
            messages.map((message) => <SupportBubble key={message.id} message={message} />)
          )}

          <View style={styles.ticketBox}>
            <View style={styles.ticketHeader}>
              <MaterialCommunityIcons name="account-wrench-outline" size={20} color="#0f766e" />
              <Text style={styles.ticketTitle}>Ticket humano</Text>
            </View>
            <TextInput
              onChangeText={setTicketSubject}
              placeholder="Assunto"
              placeholderTextColor="#94a3b8"
              style={styles.ticketInput}
              value={ticketSubject}
            />
            <TextInput
              multiline
              onChangeText={setTicketMessage}
              placeholder="Descreva o problema"
              placeholderTextColor="#94a3b8"
              style={[styles.ticketInput, styles.ticketTextArea]}
              textAlignVertical="top"
              value={ticketMessage}
            />
            <Pressable style={styles.ticketButton} onPress={handleOpenTicket} disabled={openingTicket}>
              {openingTicket ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <MaterialCommunityIcons name="send-check-outline" size={20} color="#ffffff" />
              )}
              <Text style={styles.ticketButtonText}>Abrir ticket</Text>
            </Pressable>
          </View>
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            multiline
            onChangeText={setInput}
            placeholder="Digite sua duvida..."
            placeholderTextColor="#94a3b8"
            style={styles.messageInput}
            value={input}
          />
          <Pressable style={styles.sendButton} onPress={handleSend} disabled={sending}>
            {sending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <MaterialCommunityIcons name="send" size={20} color="#ffffff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SupportBubble({ message }: { message: SupportMessage }) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
      <Text style={[styles.bubbleAuthor, isUser && styles.userBubbleAuthor]}>
        {isUser ? 'Voce' : 'Party Bot'}
      </Text>
      <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>{message.content}</Text>
      <Text style={[styles.bubbleTime, isUser && styles.userBubbleTime]}>
        {new Date(message.createdAt).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    flex: 1,
    paddingHorizontal: 20,
  },
  keyboard: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 12,
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
    fontSize: 14,
    fontWeight: '700',
  },
  clearButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  content: {
    gap: 12,
    paddingBottom: 16,
  },
  loadingBox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '700',
  },
  bubble: {
    borderRadius: 8,
    gap: 6,
    maxWidth: '92%',
    padding: 12,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#0f766e',
  },
  bubbleAuthor: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
  },
  userBubbleAuthor: {
    color: '#ccfbf1',
  },
  bubbleText: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 22,
  },
  userBubbleText: {
    color: '#ffffff',
  },
  bubbleTime: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
  },
  userBubbleTime: {
    color: '#ccfbf1',
  },
  ticketBox: {
    backgroundColor: '#ffffff',
    borderColor: '#ccfbf1',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  ticketHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ticketTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  ticketInput: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  ticketTextArea: {
    minHeight: 92,
    paddingTop: 10,
  },
  ticketButton: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
  },
  ticketButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
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
    maxHeight: 112,
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
});
