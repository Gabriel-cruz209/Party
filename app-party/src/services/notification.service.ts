import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { getMyTickets } from '@/services/event.service';
import type { Database, Json } from '@/types/database.types';

export type NotificationRow = Database['public']['Tables']['notificacoes']['Row'];
export type NotificationInsert = Database['public']['Tables']['notificacoes']['Insert'];
export type PartyNotificationType =
  | 'sistema'
  | 'amizade'
  | 'evento_amigo'
  | 'ingresso_confirmado'
  | 'evento_comecando'
  | 'suporte';

export type PartyNotificationData = {
  amizadeId?: string;
  eventoId?: string;
  ingressoId?: string;
  usuarioId?: string;
  ticketId?: string;
  url?: string;
};

export type PartyNotification = {
  id: string;
  usuarioId: string;
  tipo: PartyNotificationType;
  titulo: string;
  mensagem: string;
  dados: PartyNotificationData;
  linkHref: string | null;
  lida: boolean;
  lidaEm: string | null;
  criadoEm: string | null;
};

const NOTIFICATION_CHANNEL_ID = 'party-alerts';
const SCHEDULED_EVENT_KEYS = 'party:scheduled-event-notifications';
const EVENT_START_WINDOW_MS = 2 * 60 * 60 * 1000;
const EVENT_START_LOOKAHEAD_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function isNotificationType(value: string): value is PartyNotificationType {
  return ['sistema', 'amizade', 'evento_amigo', 'ingresso_confirmado', 'evento_comecando', 'suporte'].includes(
    value,
  );
}

function isRecord(value: Json | null): value is Record<string, Json | undefined> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: Json | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function normalizeNotificationData(value: Json | null): PartyNotificationData {
  if (!isRecord(value)) {
    return {};
  }

  return {
    amizadeId: readString(value.amizadeId),
    eventoId: readString(value.eventoId),
    ingressoId: readString(value.ingressoId),
    ticketId: readString(value.ticketId),
    url: readString(value.url),
    usuarioId: readString(value.usuarioId),
  };
}

export function mapNotification(row: NotificationRow): PartyNotification {
  return {
    id: row.id,
    usuarioId: row.usuario_id,
    tipo: isNotificationType(row.tipo) ? row.tipo : 'sistema',
    titulo: row.titulo,
    mensagem: row.mensagem,
    dados: normalizeNotificationData(row.dados),
    linkHref: row.link_href,
    lida: row.lida,
    lidaEm: row.lida_em,
    criadoEm: row.criado_em,
  };
}

export function getNotificationRoute(notification: PartyNotification) {
  if (notification.tipo === 'amizade') {
    return '/amizades';
  }

  if (notification.tipo === 'ingresso_confirmado') {
    return '/ingressos/index';
  }

  if (notification.tipo === 'suporte') {
    return '/suporte';
  }

  if (
    (notification.tipo === 'evento_amigo' || notification.tipo === 'evento_comecando') &&
    notification.dados.eventoId
  ) {
    return {
      pathname: '/eventos/[eventoId]/index',
      params: { eventoId: notification.dados.eventoId },
    } as const;
  }

  return notification.linkHref ?? '/notificacoes';
}

export function getNotificationUrl(notification: PartyNotification): string {
  const route = getNotificationRoute(notification);

  if (typeof route === 'string') {
    return route;
  }

  return `/eventos/${route.params.eventoId}/index`;
}

export function isNotificationInsertPayload(
  payload: RealtimePostgresInsertPayload<Record<string, unknown>>,
): payload is RealtimePostgresInsertPayload<NotificationRow> {
  return (
    typeof payload.new.id === 'string' &&
    typeof payload.new.usuario_id === 'string' &&
    typeof payload.new.titulo === 'string' &&
    typeof payload.new.mensagem === 'string'
  );
}

async function configureAndroidNotificationChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    importance: Notifications.AndroidImportance.MAX,
    lightColor: '#ef4444',
    name: 'Alertas Party',
    vibrationPattern: [0, 180, 120, 180],
  });
}

async function canPresentPush(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('perfis')
    .select('push_notificacoes_ativas')
    .eq('usuario_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.push_notificacoes_ativas !== false;
}

function getProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;

  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

export async function registerExpoPushToken(userId: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  await configureAndroidNotificationChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    await supabase
      .from('perfis')
      .update({ push_notificacoes_ativas: false })
      .eq('usuario_id', userId);
    return null;
  }

  const projectId = getProjectId();

  if (!projectId) {
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'native';
  const [{ error: deviceError }, { error: profileError }] = await Promise.all([
    supabase.from('dispositivos_push').upsert(
      {
        ativo: true,
        atualizado_em: new Date().toISOString(),
        expo_push_token: token,
        plataforma: platform,
        usuario_id: userId,
      },
      {
        onConflict: 'expo_push_token',
      },
    ),
    supabase
      .from('perfis')
      .update({
        push_notificacoes_ativas: true,
      })
      .eq('usuario_id', userId),
  ]);

  if (deviceError) {
    throw deviceError;
  }

  if (profileError) {
    throw profileError;
  }

  return token;
}

export async function presentLocalNotification(notification: PartyNotification): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  if (!(await canPresentPush(notification.usuarioId))) {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      body: notification.mensagem,
      data: {
        notificationId: notification.id,
        tipo: notification.tipo,
        url: getNotificationUrl(notification),
      },
      title: notification.titulo,
    },
    trigger: null,
  });
}

export async function getNotifications(userId: string): Promise<PartyNotification[]> {
  const { data, error } = await supabase
    .from('notificacoes')
    .select('*')
    .eq('usuario_id', userId)
    .order('criado_em', { ascending: false })
    .limit(80);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapNotification);
}

export async function createInAppNotification(input: NotificationInsert): Promise<PartyNotification | null> {
  const { data, error } = await supabase.from('notificacoes').insert(input).select('*').maybeSingle();

  if (error) {
    if (error.code === '23505') {
      return null;
    }

    throw error;
  }

  return data ? mapNotification(data) : null;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notificacoes')
    .update({
      lida: true,
      lida_em: new Date().toISOString(),
    })
    .eq('id', notificationId);

  if (error) {
    throw error;
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notificacoes')
    .update({
      lida: true,
      lida_em: new Date().toISOString(),
    })
    .eq('usuario_id', userId)
    .eq('lida', false);

  if (error) {
    throw error;
  }
}

async function readScheduledEventKeys(): Promise<Set<string>> {
  const rawValue = await AsyncStorage.getItem(SCHEDULED_EVENT_KEYS);

  if (!rawValue) {
    return new Set();
  }

  try {
    const keys = JSON.parse(rawValue) as unknown;

    return Array.isArray(keys) ? new Set(keys.filter((key): key is string => typeof key === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

async function saveScheduledEventKeys(keys: Set<string>): Promise<void> {
  await AsyncStorage.setItem(SCHEDULED_EVENT_KEYS, JSON.stringify(Array.from(keys)));
}

export async function syncUpcomingEventStartNotifications(userId: string): Promise<void> {
  const tickets = await getMyTickets(userId);
  const now = Date.now();

  await Promise.all(
    tickets.map(async ({ event, ticket }) => {
      if (!event?.dataInicio || ticket.status !== 'pago' || event.status !== 'ativo') {
        return;
      }

      const startTime = new Date(event.dataInicio).getTime();
      const delta = startTime - now;

      if (delta <= 0 || delta > EVENT_START_WINDOW_MS) {
        return;
      }

      await createInAppNotification({
        dados: { eventoId: event.id },
        dedupe_key: `evento-comecando:${event.id}:${userId}`,
        link_href: `/eventos/${event.id}/index`,
        mensagem: `${event.titulo} comeca em breve.`,
        tipo: 'evento_comecando',
        titulo: 'Evento comecando',
        usuario_id: userId,
      });
    }),
  );
}

export async function scheduleUpcomingEventStartPushes(userId: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  if (!(await canPresentPush(userId))) {
    return;
  }

  await configureAndroidNotificationChannel();

  const tickets = await getMyTickets(userId);
  const now = Date.now();
  const scheduledKeys = await readScheduledEventKeys();
  let changed = false;

  for (const { event, ticket } of tickets) {
    if (!event?.dataInicio || ticket.status !== 'pago' || event.status !== 'ativo') {
      continue;
    }

    const startTime = new Date(event.dataInicio).getTime();
    const delta = startTime - now;

    if (delta <= 0 || delta > EVENT_START_LOOKAHEAD_MS) {
      continue;
    }

    const key = `${userId}:${event.id}:${event.dataInicio}`;

    if (scheduledKeys.has(key)) {
      continue;
    }

    const notificationTime = Math.max(now + 1000, startTime - ONE_HOUR_MS);
    const seconds = Math.max(1, Math.round((notificationTime - now) / 1000));

    await Notifications.scheduleNotificationAsync({
      content: {
        body: `${event.titulo} comeca ${seconds <= 60 ? 'agora' : 'em breve'}.`,
        data: {
          eventId: event.id,
          tipo: 'evento_comecando',
          url: `/eventos/${event.id}/index`,
        },
        title: 'Evento comecando',
      },
      trigger: {
        seconds,
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      },
    });

    scheduledKeys.add(key);
    changed = true;
  }

  if (changed) {
    await saveScheduledEventKeys(scheduledKeys);
  }
}

export function subscribeToNotifications(
  userId: string,
  onReload: () => void,
  onInsert: (notification: PartyNotification) => void,
) {
  const channel = supabase
    .channel(`party-notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        filter: `usuario_id=eq.${userId}`,
        schema: 'public',
        table: 'notificacoes',
      },
      (payload) => {
        if (payload.eventType === 'INSERT' && isNotificationInsertPayload(payload)) {
          onInsert(mapNotification(payload.new));
        }

        onReload();
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
