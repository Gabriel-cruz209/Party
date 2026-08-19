import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import {
  isUserOnline,
  mapProfile,
  normalizeUsername,
  type PartyProfile,
  type SocialLinks,
  type TipoPerfil,
} from '@/services/profile.service';
import type { Database } from '@/types/database.types';

export type FriendshipRow = Database['public']['Tables']['amizades']['Row'];
export type FriendshipStatus = Database['public']['Enums']['status_amizade'];
export type FriendshipDirection = 'incoming' | 'outgoing' | 'accepted' | 'none';
export type EventRow = Database['public']['Tables']['eventos']['Row'];

export type FriendshipSummary = {
  id: string;
  status: FriendshipStatus;
  direction: FriendshipDirection;
};

export type PublicUser = {
  perfilId: string;
  usuarioId: string;
  tipo: TipoPerfil;
  username: string;
  nome: string;
  bio: string;
  fotoUrl: string | null;
  linksSociais: SocialLinks;
  ultimaAtividadeEm: string | null;
  online: boolean;
  amizade: FriendshipSummary | null;
};

export type FriendRequest = {
  id: string;
  direction: Exclude<FriendshipDirection, 'accepted' | 'none'>;
  status: FriendshipStatus;
  user: PublicUser;
  criadoEm: string | null;
};

export type VisibleEvent = {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: Database['public']['Enums']['tipo_evento'];
  localNome: string | null;
  dataInicio: string | null;
  dataFim: string | null;
};

type ParticipatingEventRow = {
  eventos: EventRow | EventRow[] | null;
};

function mapPublicUser(profile: PartyProfile, amizade: FriendshipSummary | null = null): PublicUser {
  return {
    perfilId: profile.id,
    usuarioId: profile.usuarioId,
    tipo: profile.tipo,
    username: profile.username,
    nome: profile.nome,
    bio: profile.bio,
    fotoUrl: profile.fotoUrl,
    linksSociais: profile.linksSociais,
    ultimaAtividadeEm: profile.ultimaAtividadeEm,
    online: isUserOnline(profile.ultimaAtividadeEm),
    amizade,
  };
}

function mapFriendshipSummary(row: FriendshipRow, currentUserId: string): FriendshipSummary {
  const direction =
    row.status === 'aceita'
      ? 'accepted'
      : row.destinatario_id === currentUserId
        ? 'incoming'
        : 'outgoing';

  return {
    id: row.id,
    status: row.status,
    direction,
  };
}

function getOtherUserId(row: FriendshipRow, currentUserId: string): string {
  return row.solicitante_id === currentUserId ? row.destinatario_id : row.solicitante_id;
}

function normalizeSearchTerm(term: string): string {
  return term.trim().replace(/[%,]/g, '').slice(0, 80);
}

async function getProfilesByUserIds(userIds: string[]): Promise<Map<string, PublicUser>> {
  if (!userIds.length) {
    return new Map();
  }

  const { data, error } = await supabase.from('perfis').select('*').in('usuario_id', userIds);

  if (error) {
    throw error;
  }

  return (data ?? []).reduce<Map<string, PublicUser>>((acc, row) => {
    const profile = mapProfile(row);

    if (profile) {
      acc.set(profile.usuarioId, mapPublicUser(profile));
    }

    return acc;
  }, new Map());
}

export async function getPublicUserProfile(
  targetUserId: string,
  currentUserId?: string,
): Promise<PublicUser | null> {
  const { data, error } = await supabase
    .from('perfis')
    .select('*')
    .eq('usuario_id', targetUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const profile = mapProfile(data);

  if (!profile) {
    return null;
  }

  const friendship =
    currentUserId && currentUserId !== targetUserId
      ? await getFriendshipBetween(currentUserId, targetUserId)
      : null;

  return mapPublicUser(
    profile,
    friendship && currentUserId ? mapFriendshipSummary(friendship, currentUserId) : null,
  );
}

export async function getFriendshipBetween(
  currentUserId: string,
  otherUserId: string,
): Promise<FriendshipRow | null> {
  const { data, error } = await supabase
    .from('amizades')
    .select('*')
    .or(
      `and(solicitante_id.eq.${currentUserId},destinatario_id.eq.${otherUserId}),and(solicitante_id.eq.${otherUserId},destinatario_id.eq.${currentUserId})`,
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function searchUsers(
  currentUserId: string,
  rawQuery: string,
): Promise<PublicUser[]> {
  const query = normalizeSearchTerm(rawQuery);

  if (query.length < 2) {
    return [];
  }

  const isUsernameSearch = query.startsWith('@');
  const usernameTerm = normalizeUsername(query);
  const namePattern = `%${query}%`;
  const usernamePattern = `%${usernameTerm}%`;
  const builder = supabase
    .from('perfis')
    .select('*')
    .neq('usuario_id', currentUserId)
    .limit(25);

  const { data, error } = isUsernameSearch
    ? await builder.ilike('username', usernamePattern)
    : await builder.or(`nome.ilike.${namePattern},username.ilike.${usernamePattern}`);

  if (error) {
    throw error;
  }

  const profiles = (data ?? []).map(mapProfile).filter((profile): profile is PartyProfile =>
    Boolean(profile),
  );
  const friendshipMap = await getFriendshipMap(
    currentUserId,
    profiles.map((profile) => profile.usuarioId),
  );

  return profiles.map((profile) =>
    mapPublicUser(profile, friendshipMap.get(profile.usuarioId) ?? null),
  );
}

export async function getFriendshipMap(
  currentUserId: string,
  targetUserIds: string[],
): Promise<Map<string, FriendshipSummary>> {
  if (!targetUserIds.length) {
    return new Map();
  }

  const targetSet = new Set(targetUserIds);
  const { data, error } = await supabase
    .from('amizades')
    .select('*')
    .or(`solicitante_id.eq.${currentUserId},destinatario_id.eq.${currentUserId}`);

  if (error) {
    throw error;
  }

  return (data ?? []).reduce<Map<string, FriendshipSummary>>((acc, row) => {
    const otherUserId = getOtherUserId(row, currentUserId);

    if (targetSet.has(otherUserId)) {
      acc.set(otherUserId, mapFriendshipSummary(row, currentUserId));
    }

    return acc;
  }, new Map());
}

export async function sendFriendRequest(
  currentUserId: string,
  targetUserId: string,
): Promise<FriendshipSummary> {
  if (currentUserId === targetUserId) {
    throw new Error('Voce nao pode enviar solicitacao para si mesmo.');
  }

  const existing = await getFriendshipBetween(currentUserId, targetUserId);

  if (existing?.status === 'aceita') {
    return mapFriendshipSummary(existing, currentUserId);
  }

  if (existing?.status === 'pendente') {
    return mapFriendshipSummary(existing, currentUserId);
  }

  if (existing?.status === 'bloqueada') {
    throw new Error('Nao foi possivel enviar essa solicitacao.');
  }

  if (existing?.status === 'recusada' && existing.solicitante_id === currentUserId) {
    const { data, error } = await supabase
      .from('amizades')
      .update({ status: 'pendente' })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapFriendshipSummary(data, currentUserId);
  }

  const { data, error } = await supabase
    .from('amizades')
    .insert({
      solicitante_id: currentUserId,
      destinatario_id: targetUserId,
      status: 'pendente',
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapFriendshipSummary(data, currentUserId);
}

export async function respondToFriendRequest(
  requestId: string,
  status: Extract<FriendshipStatus, 'aceita' | 'recusada'>,
): Promise<FriendshipRow> {
  const { data, error } = await supabase
    .from('amizades')
    .update({ status })
    .eq('id', requestId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getFriends(currentUserId: string): Promise<PublicUser[]> {
  const { data, error } = await supabase
    .from('amizades')
    .select('*')
    .eq('status', 'aceita')
    .or(`solicitante_id.eq.${currentUserId},destinatario_id.eq.${currentUserId}`);

  if (error) {
    throw error;
  }

  const rows = data ?? [];
  const profiles = await getProfilesByUserIds(rows.map((row) => getOtherUserId(row, currentUserId)));

  const friends = rows.reduce<PublicUser[]>((acc, row) => {
    const user = profiles.get(getOtherUserId(row, currentUserId));

    if (user) {
      acc.push({
        ...user,
        amizade: mapFriendshipSummary(row, currentUserId),
      });
    }

    return acc;
  }, []);

  return friends.sort(
    (a, b) => Number(b.online) - Number(a.online) || a.nome.localeCompare(b.nome),
  );
}

export async function getFriendRequests(currentUserId: string): Promise<{
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}> {
  const { data, error } = await supabase
    .from('amizades')
    .select('*')
    .eq('status', 'pendente')
    .or(`solicitante_id.eq.${currentUserId},destinatario_id.eq.${currentUserId}`);

  if (error) {
    throw error;
  }

  const rows = data ?? [];
  const profiles = await getProfilesByUserIds(rows.map((row) => getOtherUserId(row, currentUserId)));
  const incoming: FriendRequest[] = [];
  const outgoing: FriendRequest[] = [];

  rows.forEach((row) => {
    const user = profiles.get(getOtherUserId(row, currentUserId));

    if (!user) {
      return;
    }

    const direction = row.destinatario_id === currentUserId ? 'incoming' : 'outgoing';
    const request: FriendRequest = {
      id: row.id,
      direction,
      status: row.status,
      user: {
        ...user,
        amizade: mapFriendshipSummary(row, currentUserId),
      },
      criadoEm: row.criado_em,
    };

    if (direction === 'incoming') {
      incoming.push(request);
    } else {
      outgoing.push(request);
    }
  });

  return { incoming, outgoing };
}

export async function getVisibleParticipatingEvents(
  currentUserId: string,
  targetUserId: string,
): Promise<VisibleEvent[]> {
  const friendship =
    currentUserId === targetUserId ? null : await getFriendshipBetween(currentUserId, targetUserId);
  const canSeeFriendPrivateEvents = currentUserId === targetUserId || friendship?.status === 'aceita';
  let query = supabase
    .from('participantes_evento')
    .select(
      'eventos!inner(id,organizador_id,titulo,descricao,tipo,local_nome,latitude,longitude,data_inicio,data_fim,criado_em)',
    )
    .eq('usuario_id', targetUserId);

  if (!canSeeFriendPrivateEvents) {
    query = query.eq('eventos.tipo', 'publico');
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as ParticipatingEventRow[])
    .map((row) => (Array.isArray(row.eventos) ? row.eventos[0] : row.eventos))
    .filter((event): event is EventRow => Boolean(event))
    .map((event) => ({
      id: event.id,
      titulo: event.titulo,
      descricao: event.descricao,
      tipo: event.tipo,
      localNome: event.local_nome,
      dataInicio: event.data_inicio,
      dataFim: event.data_fim,
    }));
}

export function isFriendRequestInsertPayload(
  payload: RealtimePostgresInsertPayload<Record<string, unknown>>,
): payload is RealtimePostgresInsertPayload<FriendshipRow> {
  return (
    typeof payload.new.id === 'string' &&
    typeof payload.new.solicitante_id === 'string' &&
    typeof payload.new.destinatario_id === 'string' &&
    payload.new.status === 'pendente'
  );
}
