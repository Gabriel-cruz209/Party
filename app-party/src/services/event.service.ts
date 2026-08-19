import type { CloudinaryUploadFile } from '@/lib/cloudinary';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { supabase } from '@/lib/supabase';
import { mapProfile, type PartyProfile } from '@/services/profile.service';
import type { Database } from '@/types/database.types';

export type TipoEvento = Database['public']['Enums']['tipo_evento'];
export type StatusEvento = Database['public']['Enums']['status_evento'];
export type StatusIngresso = Database['public']['Enums']['status_ingresso'];
export type EventRow = Database['public']['Tables']['eventos']['Row'];
export type TicketRow = Database['public']['Tables']['ingressos']['Row'];
export type PaymentMethod = 'mock_pix' | 'mock_card' | 'stripe';

export type EventLocation = {
  nome: string;
  endereco?: string;
  latitude: number;
  longitude: number;
};

export type EventFormInput = {
  titulo: string;
  descricao: string;
  tipo: TipoEvento;
  categoria: string;
  dataInicio: string;
  dataFim?: string | null;
  local: EventLocation;
  capacidade: number;
  classificacaoEtaria: number;
  precoIngresso: number;
  capaUrl?: string | null;
  capaFile?: CloudinaryUploadFile | null;
};

export type PartyEvent = {
  id: string;
  organizadorId: string;
  titulo: string;
  descricao: string;
  tipo: TipoEvento;
  status: StatusEvento;
  categoria: string;
  localNome: string;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  dataInicio: string | null;
  dataFim: string | null;
  capacidade: number | null;
  classificacaoEtaria: number;
  capaUrl: string | null;
  precoIngresso: number;
  criadoEm: string | null;
  atualizadoEm: string | null;
};

export type EventParticipant = {
  usuarioId: string;
  perfil: PartyProfile | null;
  ingresso: TicketRow | null;
};

export type EventDetail = {
  event: PartyEvent;
  organizer: PartyProfile | null;
  participants: EventParticipant[];
  participantCount: number;
  currentTicket: TicketRow | null;
  isOrganizer: boolean;
  canBuyTicket: boolean;
  ageGateMessage: string | null;
};

export type TicketCheckoutInput = {
  acceptedTerms: boolean;
  paymentMethod: PaymentMethod;
};

export type TicketWithEvent = {
  ticket: TicketRow;
  event: PartyEvent | null;
};

const AGE_RATINGS = new Set([0, 10, 12, 14, 16, 18]);
const TICKET_QR_PREFIX = 'PARTY:TICKET';
const ALPHANUMERIC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CATEGORY_PATTERN = /^[a-z0-9_-]{3,40}$/;

export function calculateAge(dataNascimento: string | null): number | null {
  if (!dataNascimento) {
    return null;
  }

  const birthDate = new Date(`${dataNascimento}T00:00:00`);

  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

export function isAgeAllowed(profile: PartyProfile | null, rating: number): boolean {
  if (rating <= 0) {
    return true;
  }

  const age = calculateAge(profile?.dataNascimento ?? null);

  return age !== null && age >= rating;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    style: 'currency',
  }).format(value);
}

export function formatBackupCode(code: string): string {
  return normalizeBackupCode(code).replace(/(.{3})(?=.)/g, '$1-');
}

export function getTicketQrValue(ticket: TicketRow): string {
  return ticket.qr_code_url || ticket.codigo;
}

export function getTicketStatusLabel(status: StatusIngresso): string {
  const labels: Record<StatusIngresso, string> = {
    cancelado: 'Cancelado',
    pago: 'Ativo',
    reservado: 'Reservado',
    usado: 'Usado',
  };

  return labels[status];
}

export function normalizeBackupCode(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toUpperCase();
}

export function mapEvent(row: EventRow): PartyEvent {
  return {
    id: row.id,
    organizadorId: row.organizador_id,
    titulo: row.titulo,
    descricao: row.descricao ?? '',
    tipo: row.tipo,
    status: row.status,
    categoria: row.categoria ?? 'festa',
    localNome: row.local_nome ?? '',
    endereco: row.endereco ?? '',
    latitude: row.latitude,
    longitude: row.longitude,
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    capacidade: row.capacidade,
    classificacaoEtaria: row.classificacao_etaria,
    capaUrl: row.capa_url,
    precoIngresso: Number(row.preco_ingresso ?? 0),
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

function assertValidEventInput(input: EventFormInput, organizerProfile: PartyProfile | null) {
  const title = input.titulo.trim();
  const description = input.descricao.trim();
  const category = input.categoria.trim().toLowerCase();
  const startDate = new Date(input.dataInicio);
  const endDate = input.dataFim ? new Date(input.dataFim) : null;

  if (!organizerProfile) {
    throw new Error('Complete seu perfil antes de criar eventos.');
  }

  if (title.length < 4 || title.length > 90) {
    throw new Error('O titulo precisa ter entre 4 e 90 caracteres.');
  }

  if (description.length < 20 || description.length > 2000) {
    throw new Error('A descricao precisa ter entre 20 e 2000 caracteres.');
  }

  if (!CATEGORY_PATTERN.test(category)) {
    throw new Error('Categoria invalida para o evento.');
  }

  if (Number.isNaN(startDate.getTime()) || startDate.getTime() <= Date.now() + 30 * 60 * 1000) {
    throw new Error('A data do evento precisa estar pelo menos 30 minutos no futuro.');
  }

  if (endDate && endDate.getTime() <= startDate.getTime()) {
    throw new Error('A data final precisa ser posterior ao inicio do evento.');
  }

  if (!input.local.nome.trim() || !input.local.endereco?.trim()) {
    throw new Error('Informe o nome e endereco do local.');
  }

  if (
    !Number.isFinite(input.local.latitude) ||
    !Number.isFinite(input.local.longitude) ||
    Math.abs(input.local.latitude) > 90 ||
    Math.abs(input.local.longitude) > 180
  ) {
    throw new Error('Selecione uma localizacao valida no mapa.');
  }

  if (!Number.isInteger(input.capacidade) || input.capacidade < 1 || input.capacidade > 100000) {
    throw new Error('A capacidade precisa ficar entre 1 e 100000 pessoas.');
  }

  if (!AGE_RATINGS.has(input.classificacaoEtaria)) {
    throw new Error('Classificacao etaria invalida.');
  }

  if (!Number.isFinite(input.precoIngresso) || input.precoIngresso < 0 || input.precoIngresso > 100000) {
    throw new Error('Preco do ingresso invalido.');
  }
}

async function uploadCoverIfNeeded(input: EventFormInput) {
  if (!input.capaFile) {
    return input.capaUrl ?? null;
  }

  const upload = await uploadToCloudinary(input.capaFile, {
    folder: 'party/eventos',
    resourceType: 'image',
    tags: ['party', 'evento', input.tipo],
  });

  return upload.secure_url;
}

export async function createEvent(
  organizerProfile: PartyProfile | null,
  input: EventFormInput,
): Promise<PartyEvent> {
  assertValidEventInput(input, organizerProfile);

  if (!organizerProfile) {
    throw new Error('Perfil de organizador ausente.');
  }

  const capaUrl = await uploadCoverIfNeeded(input);
  const { data, error } = await supabase
    .from('eventos')
    .insert({
      organizador_id: organizerProfile.id,
      titulo: input.titulo.trim(),
      descricao: input.descricao.trim(),
      tipo: input.tipo,
      status: 'ativo',
      categoria: input.categoria.trim().toLowerCase(),
      local_nome: input.local.nome.trim(),
      endereco: input.local.endereco?.trim() ?? null,
      latitude: input.local.latitude,
      longitude: input.local.longitude,
      data_inicio: input.dataInicio,
      data_fim: input.dataFim ?? null,
      capacidade: input.capacidade,
      classificacao_etaria: input.classificacaoEtaria,
      capa_url: capaUrl,
      preco_ingresso: input.precoIngresso,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapEvent(data);
}

export async function updateEvent(
  eventId: string,
  organizerProfile: PartyProfile | null,
  input: EventFormInput,
): Promise<PartyEvent> {
  assertValidEventInput(input, organizerProfile);

  const capaUrl = await uploadCoverIfNeeded(input);
  const { data, error } = await supabase
    .from('eventos')
    .update({
      titulo: input.titulo.trim(),
      descricao: input.descricao.trim(),
      tipo: input.tipo,
      categoria: input.categoria.trim().toLowerCase(),
      local_nome: input.local.nome.trim(),
      endereco: input.local.endereco?.trim() ?? null,
      latitude: input.local.latitude,
      longitude: input.local.longitude,
      data_inicio: input.dataInicio,
      data_fim: input.dataFim ?? null,
      capacidade: input.capacidade,
      classificacao_etaria: input.classificacaoEtaria,
      capa_url: capaUrl,
      preco_ingresso: input.precoIngresso,
    })
    .eq('id', eventId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapEvent(data);
}

export async function cancelEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('eventos').update({ status: 'cancelado' }).eq('id', eventId);

  if (error) {
    throw error;
  }
}

async function getProfileByProfileId(profileId: string): Promise<PartyProfile | null> {
  const { data, error } = await supabase.from('perfis').select('*').eq('id', profileId).maybeSingle();

  if (error) {
    throw error;
  }

  return mapProfile(data);
}

async function getProfilesByUserIds(userIds: string[]): Promise<Map<string, PartyProfile>> {
  if (!userIds.length) {
    return new Map();
  }

  const { data, error } = await supabase.from('perfis').select('*').in('usuario_id', userIds);

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

async function getTicketsByEvent(eventId: string): Promise<TicketRow[]> {
  const { data, error } = await supabase.from('ingressos').select('*').eq('evento_id', eventId);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getEventDetail(
  eventId: string,
  currentUserId: string,
  currentProfile: PartyProfile | null,
): Promise<EventDetail> {
  const { data: eventRow, error } = await supabase
    .from('eventos')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!eventRow) {
    throw new Error('Evento nao encontrado ou sem permissao de acesso.');
  }

  const event = mapEvent(eventRow);
  const organizer = await getProfileByProfileId(event.organizadorId);
  const isOrganizer = organizer?.usuarioId === currentUserId;
  const [{ data: participantRows, error: participantError }, tickets] = await Promise.all([
    supabase.from('participantes_evento').select('*').eq('evento_id', eventId),
    getTicketsByEvent(eventId),
  ]);

  if (participantError) {
    throw participantError;
  }

  const userIds = (participantRows ?? []).map((row) => row.usuario_id);
  const profiles = await getProfilesByUserIds(userIds);
  const ticketMap = tickets.reduce<Map<string, TicketRow>>((acc, ticket) => {
    acc.set(ticket.comprador_id, ticket);
    return acc;
  }, new Map());
  const participants = (participantRows ?? []).map<EventParticipant>((row) => ({
    usuarioId: row.usuario_id,
    perfil: profiles.get(row.usuario_id) ?? null,
    ingresso: ticketMap.get(row.usuario_id) ?? null,
  }));
  const currentTicket = tickets.find((ticket) => ticket.comprador_id === currentUserId) ?? null;
  const ageAllowed = isAgeAllowed(currentProfile, event.classificacaoEtaria);
  const ageGateMessage = ageAllowed
    ? null
    : currentProfile?.dataNascimento
      ? `Este evento e ${event.classificacaoEtaria}+.`
      : 'Informe sua data de nascimento no perfil para comprar ingresso.';
  const isFull = event.capacidade !== null && participants.length >= event.capacidade;

  return {
    event,
    organizer,
    participants,
    participantCount: participants.length,
    currentTicket,
    isOrganizer,
    canBuyTicket:
      !isOrganizer &&
      !currentTicket &&
      event.status === 'ativo' &&
      !isFull &&
      ageAllowed &&
      !!event.dataInicio &&
      new Date(event.dataInicio).getTime() > Date.now(),
    ageGateMessage,
  };
}

export async function getOrganizerEventDetail(
  eventId: string,
  currentUserId: string,
  currentProfile: PartyProfile | null,
): Promise<EventDetail> {
  const detail = await getEventDetail(eventId, currentUserId, currentProfile);

  if (!detail.isOrganizer) {
    throw new Error('Apenas o organizador pode gerenciar este evento.');
  }

  return detail;
}

function randomAlphaNumeric(length: number): string {
  return Array.from({ length }, () => {
    const index = Math.floor(Math.random() * ALPHANUMERIC.length);

    return ALPHANUMERIC[index];
  }).join('');
}

function createBackupCode(): string {
  return `PTY${randomAlphaNumeric(9)}`;
}

function createTicketQrPayload(eventId: string, userId: string, backupCode: string): string {
  return `${TICKET_QR_PREFIX}:${eventId}:${userId}:${backupCode}:${Date.now()}:${randomAlphaNumeric(8)}`;
}

async function ensureParticipant(eventId: string, userId: string): Promise<void> {
  const { data: participant, error: participantLookupError } = await supabase
    .from('participantes_evento')
    .select('id')
    .eq('evento_id', eventId)
    .eq('usuario_id', userId)
    .maybeSingle();

  if (participantLookupError) {
    throw participantLookupError;
  }

  if (participant) {
    return;
  }

  const { error: participantError } = await supabase.from('participantes_evento').insert({
    evento_id: eventId,
    usuario_id: userId,
  });

  if (participantError) {
    throw participantError;
  }
}

export async function purchaseTicket(
  eventId: string,
  currentUserId: string,
  currentProfile: PartyProfile | null,
  checkout: TicketCheckoutInput,
): Promise<TicketRow> {
  if (!checkout.acceptedTerms) {
    throw new Error('Confirme os dados da compra antes de pagar.');
  }

  if (checkout.paymentMethod === 'stripe') {
    throw new Error('Stripe ainda nao esta configurado. Use pagamento mock por enquanto.');
  }

  const detail = await getEventDetail(eventId, currentUserId, currentProfile);

  if (!detail.canBuyTicket) {
    throw new Error(detail.ageGateMessage ?? 'Nao foi possivel comprar este ingresso.');
  }

  let ticket: TicketRow | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const backupCode = createBackupCode();
    const { data, error: ticketError } = await supabase
      .from('ingressos')
      .insert({
        evento_id: eventId,
        comprador_id: currentUserId,
        codigo: backupCode,
        qr_code_url: createTicketQrPayload(eventId, currentUserId, backupCode),
        status: 'pago',
        valor_pago: detail.event.precoIngresso,
        comprado_em: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (!ticketError) {
      ticket = data;
      break;
    }

    if (ticketError.code !== '23505' || attempt === 2) {
      throw ticketError;
    }
  }

  if (!ticket) {
    throw new Error('Nao foi possivel gerar um codigo unico para o ingresso.');
  }

  await ensureParticipant(eventId, currentUserId);

  return ticket;
}

export async function buyTicket(
  eventId: string,
  currentUserId: string,
  currentProfile: PartyProfile | null,
): Promise<TicketRow> {
  return purchaseTicket(eventId, currentUserId, currentProfile, {
    acceptedTerms: true,
    paymentMethod: 'mock_pix',
  });
}

async function findTicketForValidation(eventId: string, scannedCode: string): Promise<TicketRow | null> {
  const rawCode = scannedCode.trim();

  if (!rawCode) {
    return null;
  }

  const { data: qrTicket, error: qrError } = await supabase
    .from('ingressos')
    .select('*')
    .eq('evento_id', eventId)
    .eq('qr_code_url', rawCode)
    .maybeSingle();

  if (qrError) {
    throw qrError;
  }

  if (qrTicket) {
    return qrTicket;
  }

  const backupCode = normalizeBackupCode(rawCode);
  const { data: backupTicket, error: backupError } = await supabase
    .from('ingressos')
    .select('*')
    .eq('evento_id', eventId)
    .eq('codigo', backupCode || rawCode)
    .maybeSingle();

  if (backupError) {
    throw backupError;
  }

  return backupTicket;
}

export async function validateTicketCode(
  eventId: string,
  scannedCode: string,
): Promise<TicketRow> {
  const ticket = await findTicketForValidation(eventId, scannedCode);

  if (!ticket) {
    throw new Error('Ingresso nao encontrado para este evento.');
  }

  if (ticket.status === 'usado') {
    throw new Error('Este ingresso ja foi usado.');
  }

  if (ticket.status !== 'pago') {
    throw new Error('Este ingresso nao esta pago/ativo.');
  }

  const { data, error: updateError } = await supabase
    .from('ingressos')
    .update({
      status: 'usado',
      validado_em: new Date().toISOString(),
    })
    .eq('id', ticket.id)
    .select('*')
    .single();

  if (updateError) {
    throw updateError;
  }

  return data;
}

export async function getMyTickets(currentUserId: string): Promise<TicketWithEvent[]> {
  const { data: ticketRows, error: ticketError } = await supabase
    .from('ingressos')
    .select('*')
    .eq('comprador_id', currentUserId)
    .order('comprado_em', { ascending: false });

  if (ticketError) {
    throw ticketError;
  }

  const tickets = ticketRows ?? [];
  const eventIds = Array.from(new Set(tickets.map((ticket) => ticket.evento_id)));

  if (!eventIds.length) {
    return [];
  }

  const { data: eventRows, error: eventError } = await supabase
    .from('eventos')
    .select('*')
    .in('id', eventIds);

  if (eventError) {
    throw eventError;
  }

  const eventMap = (eventRows ?? []).reduce<Map<string, PartyEvent>>((acc, row) => {
    acc.set(row.id, mapEvent(row));
    return acc;
  }, new Map());

  return tickets.map((ticket) => ({
    ticket,
    event: eventMap.get(ticket.evento_id) ?? null,
  }));
}
