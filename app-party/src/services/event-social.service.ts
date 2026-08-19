import type { CloudinaryUploadFile } from '@/lib/cloudinary';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { supabase } from '@/lib/supabase';
import { normalizeTranslationLanguage, translateText } from '@/lib/azureTranslator';
import { mapEvent, type PartyEvent } from '@/services/event.service';
import { mapProfile, type PartyProfile } from '@/services/profile.service';
import type { Database } from '@/types/database.types';

export type EventMessageRow = Database['public']['Tables']['mensagens_evento']['Row'];
export type EventPostRow = Database['public']['Tables']['posts_evento']['Row'];
export type EventReactionRow = Database['public']['Tables']['reacoes_post_evento']['Row'];
export type EventParticipantRow = Database['public']['Tables']['participantes_evento']['Row'];
export type EventReactionType = 'curtir' | 'amei' | 'fogo' | 'uau';

export type EventSocialAccess = {
  event: PartyEvent;
  organizer: PartyProfile | null;
  isOrganizer: boolean;
};

export type EventChatMessage = {
  row: EventMessageRow;
  author: PartyProfile | null;
};

export type EventPost = {
  row: EventPostRow;
  author: PartyProfile | null;
  reactionCounts: Record<EventReactionType, number>;
  myReaction: EventReactionType | null;
};

export type EventChatParticipant = {
  row: EventParticipantRow;
  profile: PartyProfile | null;
};

export type EventSocialBundle = {
  access: EventSocialAccess;
  messages: EventChatMessage[];
  posts: EventPost[];
  participants: EventChatParticipant[];
};

export type OrganizerArchiveItem = {
  event: PartyEvent;
  posts: EventPost[];
  messages: EventChatMessage[];
};

const VALID_TICKET_STATUSES = ['pago', 'usado'] as const;
const REACTION_TYPES: EventReactionType[] = ['curtir', 'amei', 'fogo', 'uau'];

async function getProfileByProfileId(profileId: string): Promise<PartyProfile | null> {
  const { data, error } = await supabase.from('perfis').select('*').eq('id', profileId).maybeSingle();

  if (error) {
    throw error;
  }

  return mapProfile(data);
}

async function getProfileByUserId(userId: string): Promise<PartyProfile | null> {
  const { data, error } = await supabase.from('perfis').select('*').eq('usuario_id', userId).maybeSingle();

  if (error) {
    throw error;
  }

  return mapProfile(data);
}

async function getProfilesByUserIds(userIds: string[]): Promise<Map<string, PartyProfile>> {
  const uniqueUserIds = Array.from(new Set(userIds));

  if (!uniqueUserIds.length) {
    return new Map();
  }

  const { data, error } = await supabase.from('perfis').select('*').in('usuario_id', uniqueUserIds);

  if (error) {
    throw error;
  }

  return (data ?? []).reduce<Map<string, PartyProfile>>((acc, row) => {
    const profile = mapProfile(row);

    if (profile) {
      acc.set(profile.usuarioId, profile);
    }

    return acc;
  }, new Map());
}

async function getEventById(eventId: string): Promise<PartyEvent> {
  const { data, error } = await supabase.from('eventos').select('*').eq('id', eventId).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Evento nao encontrado ou sem permissao.');
  }

  return mapEvent(data);
}

export async function ensureEventSocialAccess(
  eventId: string,
  currentUserId: string,
): Promise<EventSocialAccess> {
  const event = await getEventById(eventId);
  const organizer = await getProfileByProfileId(event.organizadorId);
  const isOrganizer = organizer?.usuarioId === currentUserId;

  if (isOrganizer) {
    return { event, organizer, isOrganizer };
  }

  const { data: participant, error: participantError } = await supabase
    .from('participantes_evento')
    .select('*')
    .eq('evento_id', eventId)
    .eq('usuario_id', currentUserId)
    .maybeSingle();

  if (participantError) {
    throw participantError;
  }

  if (!participant) {
    throw new Error('Apenas participantes do evento podem acessar o chat.');
  }

  if (participant.removido_chat_em) {
    throw new Error('Seu acesso ao chat deste evento foi removido pela organizacao.');
  }

  const { data: ticket, error: ticketError } = await supabase
    .from('ingressos')
    .select('id,status')
    .eq('evento_id', eventId)
    .eq('comprador_id', currentUserId)
    .in('status', VALID_TICKET_STATUSES)
    .maybeSingle();

  if (ticketError) {
    throw ticketError;
  }

  if (!ticket) {
    throw new Error('Voce precisa de um ingresso valido para acessar o chat.');
  }

  return { event, organizer, isOrganizer };
}

async function getEventParticipants(eventId: string): Promise<EventChatParticipant[]> {
  const { data, error } = await supabase
    .from('participantes_evento')
    .select('*')
    .eq('evento_id', eventId)
    .order('criado_em', { ascending: true });

  if (error) {
    throw error;
  }

  const rows = data ?? [];
  const profiles = await getProfilesByUserIds(rows.map((row) => row.usuario_id));

  return rows.map((row) => ({
    row,
    profile: profiles.get(row.usuario_id) ?? null,
  }));
}

async function getEventMessages(eventId: string): Promise<EventChatMessage[]> {
  const { data, error } = await supabase
    .from('mensagens_evento')
    .select('*')
    .eq('evento_id', eventId)
    .order('criado_em', { ascending: true })
    .limit(160);

  if (error) {
    throw error;
  }

  const rows = data ?? [];
  const profiles = await getProfilesByUserIds(rows.map((row) => row.autor_id));

  return rows.map((row) => ({
    row,
    author: profiles.get(row.autor_id) ?? null,
  }));
}

function emptyReactionCounts(): Record<EventReactionType, number> {
  return REACTION_TYPES.reduce<Record<EventReactionType, number>>((acc, type) => {
    acc[type] = 0;
    return acc;
  }, {} as Record<EventReactionType, number>);
}

function isReactionType(value: string): value is EventReactionType {
  return REACTION_TYPES.includes(value as EventReactionType);
}

async function getEventPosts(eventId: string, currentUserId: string): Promise<EventPost[]> {
  const [{ data: postRows, error: postError }, { data: reactionRows, error: reactionError }] =
    await Promise.all([
      supabase
        .from('posts_evento')
        .select('*')
        .eq('evento_id', eventId)
        .order('criado_em', { ascending: false })
        .limit(80),
      supabase.from('reacoes_post_evento').select('*').eq('evento_id', eventId),
    ]);

  if (postError) {
    throw postError;
  }

  if (reactionError) {
    throw reactionError;
  }

  const posts = postRows ?? [];
  const reactions = reactionRows ?? [];
  const profiles = await getProfilesByUserIds(posts.map((row) => row.autor_id));
  const reactionMap = reactions.reduce<Map<string, EventReactionRow[]>>((acc, reaction) => {
    const current = acc.get(reaction.post_id) ?? [];
    current.push(reaction);
    acc.set(reaction.post_id, current);
    return acc;
  }, new Map());

  return posts.map((row) => {
    const counts = emptyReactionCounts();
    let myReaction: EventReactionType | null = null;

    (reactionMap.get(row.id) ?? []).forEach((reaction) => {
      if (isReactionType(reaction.tipo)) {
        counts[reaction.tipo] += 1;

        if (reaction.usuario_id === currentUserId) {
          myReaction = reaction.tipo;
        }
      }
    });

    return {
      row,
      author: profiles.get(row.autor_id) ?? null,
      reactionCounts: counts,
      myReaction,
    };
  });
}

export async function getEventSocialBundle(
  eventId: string,
  currentUserId: string,
): Promise<EventSocialBundle> {
  const access = await ensureEventSocialAccess(eventId, currentUserId);
  const [messages, posts, participants] = await Promise.all([
    getEventMessages(eventId),
    getEventPosts(eventId, currentUserId),
    access.isOrganizer ? getEventParticipants(eventId) : Promise.resolve([]),
  ]);

  return { access, messages, posts, participants };
}

export async function sendEventMessage(
  eventId: string,
  currentUserId: string,
  rawMessage: string,
): Promise<EventMessageRow> {
  await ensureEventSocialAccess(eventId, currentUserId);

  const message = rawMessage.trim();

  if (message.length < 1 || message.length > 500) {
    throw new Error('A mensagem precisa ter entre 1 e 500 caracteres.');
  }

  const { data, error } = await supabase
    .from('mensagens_evento')
    .insert({
      autor_id: currentUserId,
      evento_id: eventId,
      mensagem: message,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

type TranslationResponseItem = {
  translations?: {
    text?: string;
  }[];
};

export async function translateEventChatMessage(
  message: string,
  targetLanguage: string,
): Promise<string | null> {
  const target = normalizeTranslationLanguage(targetLanguage);

  if (!message.trim() || target === 'pt') {
    return null;
  }

  const response = (await translateText({
    text: message,
    to: [target],
  })) as TranslationResponseItem[];

  return response[0]?.translations?.[0]?.text?.trim() || null;
}

async function uploadPostImageIfNeeded(eventId: string, file?: CloudinaryUploadFile | null) {
  if (!file) {
    return null;
  }

  const upload = await uploadToCloudinary(file, {
    folder: 'party/posts',
    resourceType: 'image',
    tags: ['party', 'post-evento', eventId],
  });

  return upload.secure_url;
}

export async function createEventPost({
  eventId,
  currentUserId,
  content,
  imageFile,
}: {
  eventId: string;
  currentUserId: string;
  content: string;
  imageFile?: CloudinaryUploadFile | null;
}): Promise<EventPostRow> {
  await ensureEventSocialAccess(eventId, currentUserId);

  const cleanContent = content.trim();

  if (!cleanContent && !imageFile) {
    throw new Error('Escreva um texto ou selecione uma imagem.');
  }

  if (cleanContent.length > 1200) {
    throw new Error('O post pode ter no maximo 1200 caracteres.');
  }

  const mediaUrl = await uploadPostImageIfNeeded(eventId, imageFile);
  const { data, error } = await supabase
    .from('posts_evento')
    .insert({
      autor_id: currentUserId,
      conteudo: cleanContent || null,
      evento_id: eventId,
      midia_url: mediaUrl,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function setPostReaction({
  eventId,
  postId,
  currentUserId,
  reactionType,
  currentReaction,
}: {
  eventId: string;
  postId: string;
  currentUserId: string;
  reactionType: EventReactionType;
  currentReaction: EventReactionType | null;
}): Promise<void> {
  await ensureEventSocialAccess(eventId, currentUserId);

  if (currentReaction === reactionType) {
    const { error } = await supabase
      .from('reacoes_post_evento')
      .delete()
      .eq('post_id', postId)
      .eq('usuario_id', currentUserId);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase.from('reacoes_post_evento').upsert(
    {
      evento_id: eventId,
      post_id: postId,
      tipo: reactionType,
      usuario_id: currentUserId,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'post_id,usuario_id' },
  );

  if (error) {
    throw error;
  }
}

export async function deleteEventMessage({
  eventId,
  messageId,
  moderatorUserId,
}: {
  eventId: string;
  messageId: string;
  moderatorUserId: string;
}): Promise<void> {
  const access = await ensureEventSocialAccess(eventId, moderatorUserId);

  if (!access.isOrganizer) {
    throw new Error('Apenas o organizador pode excluir mensagens.');
  }

  const { error } = await supabase
    .from('mensagens_evento')
    .update({
      excluido_em: new Date().toISOString(),
      excluido_por: moderatorUserId,
      mensagem: 'Mensagem removida pela organizacao.',
    })
    .eq('id', messageId)
    .eq('evento_id', eventId);

  if (error) {
    throw error;
  }
}

export async function deleteEventPost({
  eventId,
  postId,
  moderatorUserId,
}: {
  eventId: string;
  postId: string;
  moderatorUserId: string;
}): Promise<void> {
  const access = await ensureEventSocialAccess(eventId, moderatorUserId);

  if (!access.isOrganizer) {
    throw new Error('Apenas o organizador pode excluir posts.');
  }

  const { error } = await supabase
    .from('posts_evento')
    .update({
      conteudo: null,
      excluido_em: new Date().toISOString(),
      excluido_por: moderatorUserId,
      midia_url: null,
    })
    .eq('id', postId)
    .eq('evento_id', eventId);

  if (error) {
    throw error;
  }
}

export async function removeParticipantFromEventChat({
  eventId,
  moderatorUserId,
  targetUserId,
}: {
  eventId: string;
  moderatorUserId: string;
  targetUserId: string;
}): Promise<void> {
  const access = await ensureEventSocialAccess(eventId, moderatorUserId);

  if (!access.isOrganizer) {
    throw new Error('Apenas o organizador pode remover participantes do chat.');
  }

  if (targetUserId === moderatorUserId || targetUserId === access.organizer?.usuarioId) {
    throw new Error('Nao e possivel remover o organizador do chat.');
  }

  const { error } = await supabase
    .from('participantes_evento')
    .update({
      removido_chat_em: new Date().toISOString(),
      removido_chat_por: moderatorUserId,
    })
    .eq('evento_id', eventId)
    .eq('usuario_id', targetUserId);

  if (error) {
    throw error;
  }
}

export function subscribeToEventSocial(eventId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`party-event-social-${eventId}`)
    .on(
      'postgres_changes',
      { event: '*', filter: `evento_id=eq.${eventId}`, schema: 'public', table: 'mensagens_evento' },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', filter: `evento_id=eq.${eventId}`, schema: 'public', table: 'posts_evento' },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', filter: `evento_id=eq.${eventId}`, schema: 'public', table: 'reacoes_post_evento' },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', filter: `evento_id=eq.${eventId}`, schema: 'public', table: 'participantes_evento' },
      onChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function getOrganizerEventArchive(
  organizerUserId: string,
  currentUserId: string,
): Promise<OrganizerArchiveItem[]> {
  const organizer = await getProfileByUserId(organizerUserId);

  if (!organizer) {
    return [];
  }

  const { data: eventRows, error: eventError } = await supabase
    .from('eventos')
    .select('*')
    .eq('organizador_id', organizer.id)
    .lt('data_inicio', new Date().toISOString())
    .order('data_inicio', { ascending: false })
    .limit(8);

  if (eventError) {
    throw eventError;
  }

  const events = (eventRows ?? []).map(mapEvent);

  if (!events.length) {
    return [];
  }

  const items = await Promise.all(
    events.map(async (event) => {
      const [posts, messages] = await Promise.all([
        getEventPosts(event.id, currentUserId),
        getEventMessages(event.id),
      ]);

      return {
        event,
        posts: posts.filter((post) => !post.row.excluido_em).slice(0, 3),
        messages: messages.filter((message) => !message.row.excluido_em).slice(-3),
      };
    }),
  );

  return items.filter((item) => item.posts.length || item.messages.length);
}
