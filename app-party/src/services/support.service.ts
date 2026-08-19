import AsyncStorage from '@react-native-async-storage/async-storage';

import { createSupportCompletion, type GroqMessage } from '@/lib/groq';
import { createInAppNotification } from '@/services/notification.service';
import type { PartyProfile } from '@/services/profile.service';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type SupportTicketRow = Database['public']['Tables']['tickets_suporte']['Row'];
export type SupportMessageRole = 'user' | 'assistant';

export type SupportMessage = {
  id: string;
  role: SupportMessageRole;
  content: string;
  createdAt: string;
};

const SUPPORT_HISTORY_PREFIX = 'party:support-history';
const MAX_HISTORY_MESSAGES = 40;

const SUPPORT_SYSTEM_PROMPT = `
Voce e o suporte oficial do app PARTY. Responda de forma curta, clara e gentil.
Ajude com duvidas sobre login, cadastro, perfil, eventos, ingressos, QR Code, mapa, amigos, chat do evento, posts, notificacoes e privacidade.
Nunca peca senha, token, chave de API ou dados de cartao. Quando for pagamento real, diga que o app esta em modo mock/Stripe configuravel.
Se o usuario relatar bug, cobranca indevida, conta bloqueada, risco de seguranca ou denuncia de abuso, oriente abrir ticket humano.
Responda no idioma preferido do usuario quando informado.
`.trim();

function getHistoryKey(userId: string) {
  return `${SUPPORT_HISTORY_PREFIX}:${userId}`;
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createFallbackAnswer(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes('ingresso') || normalized.includes('qr')) {
    return 'Voce encontra seus ingressos em Meus ingressos. O QR Code e o codigo de backup aparecem no ingresso ativo.';
  }

  if (normalized.includes('evento')) {
    return 'Para criar ou gerenciar eventos, entre pelo perfil e toque em Evento. Organizadores tambem acessam scanner, participantes e comunidade.';
  }

  if (normalized.includes('amigo') || normalized.includes('amizade')) {
    return 'Use Buscar para encontrar pessoas por nome ou @username. As solicitacoes aparecem em Amigos e nas notificacoes.';
  }

  return 'Posso ajudar com conta, perfil, eventos, ingressos, mapa, amigos e comunidade. Se for algo urgente ou especifico da sua conta, abra um ticket humano.';
}

export async function loadSupportConversation(userId: string): Promise<SupportMessage[]> {
  const rawValue = await AsyncStorage.getItem(getHistoryKey(userId));

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is SupportMessage => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const candidate = item as SupportMessage;

      return (
        typeof candidate.id === 'string' &&
        (candidate.role === 'user' || candidate.role === 'assistant') &&
        typeof candidate.content === 'string' &&
        typeof candidate.createdAt === 'string'
      );
    });
  } catch {
    return [];
  }
}

async function saveSupportConversation(userId: string, messages: SupportMessage[]) {
  await AsyncStorage.setItem(
    getHistoryKey(userId),
    JSON.stringify(messages.slice(-MAX_HISTORY_MESSAGES)),
  );
}

function toGroqMessages(
  messages: SupportMessage[],
  profile: PartyProfile | null,
): GroqMessage[] {
  const language = profile?.idiomaPreferido || 'pt-BR';
  const systemContent = `${SUPPORT_SYSTEM_PROMPT}\nIdioma preferido do usuario: ${language}.`;

  return [
    { role: 'system', content: systemContent },
    ...messages.slice(-12).map<GroqMessage>((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
}

export async function sendSupportBotMessage({
  message,
  profile,
  userId,
}: {
  message: string;
  profile: PartyProfile | null;
  userId: string;
}): Promise<SupportMessage[]> {
  const cleanMessage = message.trim();

  if (cleanMessage.length < 2 || cleanMessage.length > 1000) {
    throw new Error('Envie uma mensagem entre 2 e 1000 caracteres.');
  }

  const history = await loadSupportConversation(userId);
  const userMessage: SupportMessage = {
    id: createId(),
    content: cleanMessage,
    createdAt: new Date().toISOString(),
    role: 'user',
  };
  const withUserMessage = [...history, userMessage];
  let assistantContent = '';

  try {
    const completion = await createSupportCompletion(toGroqMessages(withUserMessage, profile));
    assistantContent = completion.choices[0]?.message?.content?.trim() ?? '';
  } catch {
    assistantContent = createFallbackAnswer(cleanMessage);
  }

  const assistantMessage: SupportMessage = {
    id: createId(),
    content: assistantContent || createFallbackAnswer(cleanMessage),
    createdAt: new Date().toISOString(),
    role: 'assistant',
  };
  const nextHistory = [...withUserMessage, assistantMessage].slice(-MAX_HISTORY_MESSAGES);

  await saveSupportConversation(userId, nextHistory);

  return nextHistory;
}

export async function clearSupportConversation(userId: string): Promise<void> {
  await AsyncStorage.removeItem(getHistoryKey(userId));
}

export async function openHumanSupportTicket({
  message,
  subject,
  userId,
}: {
  message: string;
  subject: string;
  userId: string;
}): Promise<SupportTicketRow> {
  const cleanSubject = subject.trim();
  const cleanMessage = message.trim();

  if (cleanSubject.length < 4 || cleanSubject.length > 120) {
    throw new Error('O assunto precisa ter entre 4 e 120 caracteres.');
  }

  if (cleanMessage.length < 10 || cleanMessage.length > 3000) {
    throw new Error('Descreva o problema em 10 a 3000 caracteres.');
  }

  const { data, error } = await supabase
    .from('tickets_suporte')
    .insert({
      assunto: cleanSubject,
      mensagem: cleanMessage,
      usuario_id: userId,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  await createInAppNotification({
    dados: { ticketId: data.id },
    dedupe_key: `suporte:${data.id}:aberto`,
    link_href: '/suporte',
    mensagem: 'Seu ticket foi registrado para atendimento humano.',
    tipo: 'suporte',
    titulo: 'Ticket humano aberto',
    usuario_id: userId,
  });

  return data;
}
