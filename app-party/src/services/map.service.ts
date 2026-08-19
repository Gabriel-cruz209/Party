import { supabase } from '@/lib/supabase';
import { mapEvent, type PartyEvent, type TipoEvento } from '@/services/event.service';
import { getFriends, type PublicUser } from '@/services/social.service';
import type { Database } from '@/types/database.types';

export type LocationRow = Database['public']['Tables']['localizacoes_usuarios']['Row'];
export type MapDateFilter = 'todos' | 'hoje' | 'semana';
export type MapTypeFilter = 'todos' | TipoEvento;

export type MapFilters = {
  tipo: MapTypeFilter;
  data: MapDateFilter;
  categoria: string;
};

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type MapEventPin = PartyEvent & {
  distanceKm: number | null;
};

export type FriendLocationPin = {
  usuarioId: string;
  perfil: PublicUser | null;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  currentEvent: PartyEvent | null;
  updatedAt: string;
};

export type MapSnapshot = {
  events: MapEventPin[];
  friends: FriendLocationPin[];
  categories: string[];
};

const DEFAULT_NEARBY_RADIUS_KM = 50;
const FRIEND_EVENT_RADIUS_METERS = 260;
const FRIEND_LOCATION_FRESH_MINUTES = 120;

export const DEFAULT_MAP_FILTERS: MapFilters = {
  categoria: 'todas',
  data: 'todos',
  tipo: 'todos',
};

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function getDistanceMeters(from: MapCoordinate, to: MapCoordinate): number {
  const earthRadiusMeters = 6371000;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const originLatitude = toRadians(from.latitude);
  const destinationLatitude = toRadians(to.latitude);
  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

function getEventDistanceKm(event: PartyEvent, center?: MapCoordinate | null): number | null {
  if (!center || event.latitude === null || event.longitude === null) {
    return null;
  }

  return getDistanceMeters(center, {
    latitude: event.latitude,
    longitude: event.longitude,
  }) / 1000;
}

function isSameDay(date: Date, reference: Date): boolean {
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

function matchesDateFilter(event: PartyEvent, dateFilter: MapDateFilter): boolean {
  if (dateFilter === 'todos') {
    return true;
  }

  if (!event.dataInicio) {
    return false;
  }

  const eventDate = new Date(event.dataInicio);

  if (Number.isNaN(eventDate.getTime())) {
    return false;
  }

  const now = new Date();

  if (dateFilter === 'hoje') {
    return isSameDay(eventDate, now);
  }

  const weekLimit = new Date(now);
  weekLimit.setDate(now.getDate() + 7);

  return eventDate >= now && eventDate <= weekLimit;
}

export function applyMapFilters(events: MapEventPin[], filters: MapFilters): MapEventPin[] {
  return events.filter((event) => {
    const typeMatches = filters.tipo === 'todos' || event.tipo === filters.tipo;
    const categoryMatches =
      filters.categoria === 'todas' || event.categoria === filters.categoria;

    return typeMatches && categoryMatches && matchesDateFilter(event, filters.data);
  });
}

function getNearestEvent(
  coordinate: MapCoordinate,
  events: PartyEvent[],
  maxDistanceMeters: number,
): PartyEvent | null {
  let nearest: { event: PartyEvent; distance: number } | null = null;

  for (const event of events) {
    if (event.latitude === null || event.longitude === null) {
      continue;
    }

    const distance = getDistanceMeters(coordinate, {
      latitude: event.latitude,
      longitude: event.longitude,
    });

    if (distance <= maxDistanceMeters && (!nearest || distance < nearest.distance)) {
      nearest = { event, distance };
    }
  }

  return nearest?.event ?? null;
}

async function getVisibleEvents(center?: MapCoordinate | null): Promise<MapEventPin[]> {
  const { data, error } = await supabase
    .from('eventos')
    .select('*')
    .eq('status', 'ativo')
    .order('data_inicio', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map(mapEvent)
    .filter((event) => event.latitude !== null && event.longitude !== null)
    .map<MapEventPin>((event) => ({
      ...event,
      distanceKm: getEventDistanceKm(event, center),
    }))
    .filter((event) => event.distanceKm === null || event.distanceKm <= DEFAULT_NEARBY_RADIUS_KM)
    .sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) {
        return (a.dataInicio ?? '').localeCompare(b.dataInicio ?? '');
      }

      return (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER);
    });
}

async function getFriendLocationRows(currentUserId: string): Promise<LocationRow[]> {
  const freshnessLimit = new Date(Date.now() - FRIEND_LOCATION_FRESH_MINUTES * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('localizacoes_usuarios')
    .select('*')
    .eq('compartilhando', true)
    .neq('usuario_id', currentUserId)
    .gte('atualizado_em', freshnessLimit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function getFriendPins(currentUserId: string, events: PartyEvent[]): Promise<FriendLocationPin[]> {
  const [friendRows, friends] = await Promise.all([
    getFriendLocationRows(currentUserId),
    getFriends(currentUserId),
  ]);
  const friendMap = friends.reduce<Map<string, PublicUser>>((acc, friend) => {
    acc.set(friend.usuarioId, friend);
    return acc;
  }, new Map());
  const eventMap = events.reduce<Map<string, PartyEvent>>((acc, event) => {
    acc.set(event.id, event);
    return acc;
  }, new Map());

  return friendRows
    .map<FriendLocationPin>((row) => {
      const coordinate = {
        latitude: row.latitude,
        longitude: row.longitude,
      };
      const currentEvent =
        (row.evento_id ? eventMap.get(row.evento_id) : null) ??
        getNearestEvent(coordinate, events, FRIEND_EVENT_RADIUS_METERS);

      return {
        usuarioId: row.usuario_id,
        perfil: friendMap.get(row.usuario_id) ?? null,
        latitude: row.latitude,
        longitude: row.longitude,
        accuracyMeters: row.precisao_metros,
        currentEvent,
        updatedAt: row.atualizado_em,
      };
    })
    .filter((pin) => Boolean(pin.perfil));
}

export async function getMapSnapshot(
  currentUserId: string,
  center?: MapCoordinate | null,
): Promise<MapSnapshot> {
  const events = await getVisibleEvents(center);
  const friends = await getFriendPins(currentUserId, events);
  const categories = Array.from(new Set(events.map((event) => event.categoria))).sort();

  return { events, friends, categories };
}

export async function publishUserLocation({
  userId,
  coordinate,
  accuracyMeters,
  visibleEvents,
}: {
  userId: string;
  coordinate: MapCoordinate;
  accuracyMeters?: number | null;
  visibleEvents: PartyEvent[];
}): Promise<void> {
  const currentEvent = getNearestEvent(coordinate, visibleEvents, FRIEND_EVENT_RADIUS_METERS);
  const { error } = await supabase.from('localizacoes_usuarios').upsert({
    usuario_id: userId,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    precisao_metros: accuracyMeters ?? null,
    evento_id: currentEvent?.id ?? null,
    compartilhando: true,
    atualizado_em: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
}

export async function stopSharingUserLocation(userId: string): Promise<void> {
  const { error } = await supabase
    .from('localizacoes_usuarios')
    .update({
      compartilhando: false,
      evento_id: null,
      atualizado_em: new Date().toISOString(),
    })
    .eq('usuario_id', userId);

  if (error) {
    throw error;
  }
}

export function subscribeToFriendLocationChanges(onChange: () => void): () => void {
  const channel = supabase
    .channel(`party-friend-locations-${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'localizacoes_usuarios',
      },
      () => {
        onChange();
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
