import { supabase } from '@/lib/supabase';
import { mapEvent, type EventRow, type PartyEvent } from '@/services/event.service';
import { getDistanceMeters, type MapCoordinate } from '@/services/map.service';
import { getFriends } from '@/services/social.service';

export type FeedEvent = PartyEvent & {
  distanceKm: number | null;
  friendContext?: string | null;
};

export type MainFeed = {
  recommended: FeedEvent[];
  friends: FeedEvent[];
  nearby: FeedEvent[];
};

export type SearchDateFilter = 'todos' | 'hoje' | 'semana' | 'mes';

export type GlobalEventSearchInput = {
  query: string;
  categoria?: string;
  data?: SearchDateFilter;
  localizacao?: string;
  center?: MapCoordinate | null;
};

type ParticipatingEventRow = {
  usuario_id: string;
  eventos: EventRow | EventRow[] | null;
};

const NEARBY_RADIUS_KM = 50;

function normalizeSearchTerm(value: string) {
  return value.trim().toLowerCase();
}

function getDistanceKm(event: PartyEvent, center?: MapCoordinate | null): number | null {
  if (!center || event.latitude === null || event.longitude === null) {
    return null;
  }

  return (
    getDistanceMeters(center, {
      latitude: event.latitude,
      longitude: event.longitude,
    }) / 1000
  );
}

function isUpcoming(event: PartyEvent) {
  return event.status === 'ativo' && !!event.dataInicio && new Date(event.dataInicio).getTime() >= Date.now();
}

function isSameDay(date: Date, reference: Date) {
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

function matchesDate(event: PartyEvent, filter: SearchDateFilter = 'todos') {
  if (filter === 'todos') {
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

  if (filter === 'hoje') {
    return isSameDay(eventDate, now);
  }

  const limit = new Date(now);
  limit.setDate(now.getDate() + (filter === 'semana' ? 7 : 30));

  return eventDate >= now && eventDate <= limit;
}

function eventMatchesText(event: PartyEvent, query: string) {
  const cleanQuery = normalizeSearchTerm(query);

  if (!cleanQuery) {
    return true;
  }

  return [
    event.titulo,
    event.descricao,
    event.categoria,
    event.localNome,
    event.endereco,
  ].some((value) => normalizeSearchTerm(value ?? '').includes(cleanQuery));
}

function eventMatchesLocation(event: PartyEvent, location: string) {
  const cleanLocation = normalizeSearchTerm(location);

  if (!cleanLocation) {
    return true;
  }

  return [event.localNome, event.endereco].some((value) =>
    normalizeSearchTerm(value ?? '').includes(cleanLocation),
  );
}

function eventMatchesCategory(event: PartyEvent, category?: string) {
  const cleanCategory = normalizeSearchTerm(category ?? '');

  return !cleanCategory || cleanCategory === 'todas' || event.categoria === cleanCategory;
}

function uniqueEvents(events: FeedEvent[]) {
  const seen = new Set<string>();

  return events.filter((event) => {
    if (seen.has(event.id)) {
      return false;
    }

    seen.add(event.id);
    return true;
  });
}

async function getUpcomingVisibleEvents(center?: MapCoordinate | null, limit = 80): Promise<FeedEvent[]> {
  const { data, error } = await supabase
    .from('eventos')
    .select('*')
    .eq('status', 'ativo')
    .gte('data_inicio', new Date().toISOString())
    .order('data_inicio', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapEvent).map<FeedEvent>((event) => ({
    ...event,
    distanceKm: getDistanceKm(event, center),
  }));
}

async function getFriendEvents(currentUserId: string, center?: MapCoordinate | null): Promise<FeedEvent[]> {
  const friends = await getFriends(currentUserId);
  const friendIds = friends.map((friend) => friend.usuarioId);

  if (!friendIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from('participantes_evento')
    .select('usuario_id,eventos!inner(*)')
    .in('usuario_id', friendIds)
    .order('criado_em', { ascending: false })
    .limit(80);

  if (error) {
    throw error;
  }

  const friendMap = friends.reduce<Map<string, string>>((acc, friend) => {
    acc.set(friend.usuarioId, friend.nome);
    return acc;
  }, new Map());

  const mappedEvents = ((data ?? []) as unknown as ParticipatingEventRow[]).reduce<FeedEvent[]>((acc, row) => {
        const eventRow = Array.isArray(row.eventos) ? row.eventos[0] : row.eventos;

        if (!eventRow) {
      return acc;
        }

        const event = mapEvent(eventRow);

        if (!isUpcoming(event)) {
      return acc;
        }

    acc.push({
          ...event,
          distanceKm: getDistanceKm(event, center),
          friendContext: friendMap.get(row.usuario_id) ?? 'Um amigo',
    });

    return acc;
  }, []);

  return uniqueEvents(mappedEvents).sort((a, b) => (a.dataInicio ?? '').localeCompare(b.dataInicio ?? ''));
}

export async function getMainFeed(
  currentUserId: string,
  center?: MapCoordinate | null,
): Promise<MainFeed> {
  const [visibleEvents, friendEvents] = await Promise.all([
    getUpcomingVisibleEvents(center, 120),
    getFriendEvents(currentUserId, center),
  ]);
  const nearby = visibleEvents
    .filter((event) => event.distanceKm !== null && event.distanceKm <= NEARBY_RADIUS_KM)
    .sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER));
  const friendEventIds = new Set(friendEvents.map((event) => event.id));
  const recommended = visibleEvents
    .filter((event) => !friendEventIds.has(event.id))
    .sort((a, b) => {
      const scoreA = (a.tipo === 'publico' ? 1 : 0) + (a.capaUrl ? 1 : 0);
      const scoreB = (b.tipo === 'publico' ? 1 : 0) + (b.capaUrl ? 1 : 0);

      return scoreB - scoreA || (a.dataInicio ?? '').localeCompare(b.dataInicio ?? '');
    });

  return {
    friends: friendEvents.slice(0, 12),
    nearby: nearby.slice(0, 12),
    recommended: recommended.slice(0, 16),
  };
}

export async function searchGlobalEvents(input: GlobalEventSearchInput): Promise<FeedEvent[]> {
  const events = await getUpcomingVisibleEvents(input.center, 140);

  return events
    .filter((event) => eventMatchesText(event, input.query))
    .filter((event) => eventMatchesCategory(event, input.categoria))
    .filter((event) => matchesDate(event, input.data))
    .filter((event) => eventMatchesLocation(event, input.localizacao ?? ''))
    .sort((a, b) => {
      if (a.distanceKm !== null || b.distanceKm !== null) {
        return (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER);
      }

      return (a.dataInicio ?? '').localeCompare(b.dataInicio ?? '');
    })
    .slice(0, 60);
}
