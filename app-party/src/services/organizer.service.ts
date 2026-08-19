import { supabase } from '@/lib/supabase';
import { formatCurrency, mapEvent, type PartyEvent, type TicketRow } from '@/services/event.service';
import type { PartyProfile } from '@/services/profile.service';
import type { Database } from '@/types/database.types';

export type CompanyRow = Database['public']['Tables']['empresas']['Row'];
export type CompanyType = 'bar' | 'clube' | 'casa_de_show' | 'casa_de_eventos' | 'outro';

export type CompanyProfile = {
  id: string;
  perfilId: string;
  nomeFantasia: string;
  cnpj: string;
  descricao: string;
  endereco: string;
  telefone: string;
  site: string;
  tipoLocal: CompanyType;
  verificada: boolean;
};

export type CompanyMutationInput = {
  nomeFantasia: string;
  cnpj?: string;
  descricao?: string;
  endereco?: string;
  telefone?: string;
  site?: string;
  tipoLocal: CompanyType;
};

export type OrganizerEventSummary = {
  event: PartyEvent;
  ticketsSold: number;
  revenue: number;
  participants: number;
  posts: number;
};

export type OrganizerDashboard = {
  company: CompanyProfile | null;
  events: OrganizerEventSummary[];
  completedEvents: OrganizerEventSummary[];
  upcomingEvents: OrganizerEventSummary[];
  totalTicketsSold: number;
  totalRevenue: number;
  totalParticipants: number;
  totalPosts: number;
  formattedRevenue: string;
};

const COMPANY_TYPES = new Set<CompanyType>(['bar', 'clube', 'casa_de_show', 'casa_de_eventos', 'outro']);

export function mapCompany(row: CompanyRow | null): CompanyProfile | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    perfilId: row.perfil_id,
    nomeFantasia: row.nome_fantasia?.trim() ?? '',
    cnpj: row.cnpj?.trim() ?? '',
    descricao: row.descricao?.trim() ?? '',
    endereco: row.endereco?.trim() ?? '',
    telefone: row.telefone?.trim() ?? '',
    site: row.site?.trim() ?? '',
    tipoLocal: COMPANY_TYPES.has(row.tipo_local as CompanyType) ? (row.tipo_local as CompanyType) : 'outro',
    verificada: row.verificada,
  };
}

function cleanOptional(value?: string) {
  const cleanValue = value?.trim();

  return cleanValue || null;
}

function assertValidCompanyInput(input: CompanyMutationInput) {
  if (input.nomeFantasia.trim().length < 2 || input.nomeFantasia.trim().length > 120) {
    throw new Error('O nome fantasia precisa ter entre 2 e 120 caracteres.');
  }

  if (input.descricao && input.descricao.trim().length > 1200) {
    throw new Error('A descricao da empresa pode ter no maximo 1200 caracteres.');
  }

  if (input.endereco && input.endereco.trim().length > 240) {
    throw new Error('O endereco pode ter no maximo 240 caracteres.');
  }

  if (!COMPANY_TYPES.has(input.tipoLocal)) {
    throw new Error('Tipo de local invalido.');
  }
}

export async function getCompanyByProfileId(profileId: string): Promise<CompanyProfile | null> {
  const { data, error } = await supabase
    .from('empresas')
    .select('*')
    .eq('perfil_id', profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapCompany(data);
}

export async function saveCompanyProfile(
  profile: PartyProfile,
  input: CompanyMutationInput,
): Promise<CompanyProfile> {
  if (profile.tipo !== 'empresa') {
    throw new Error('Apenas perfis empresa podem salvar dados comerciais.');
  }

  assertValidCompanyInput(input);

  const { data, error } = await supabase
    .from('empresas')
    .upsert(
      {
        atualizado_em: new Date().toISOString(),
        cnpj: cleanOptional(input.cnpj),
        descricao: cleanOptional(input.descricao),
        endereco: cleanOptional(input.endereco),
        nome_fantasia: input.nomeFantasia.trim(),
        perfil_id: profile.id,
        site: cleanOptional(input.site),
        telefone: cleanOptional(input.telefone),
        tipo_local: input.tipoLocal,
      },
      {
        onConflict: 'perfil_id',
      },
    )
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  const company = mapCompany(data);

  if (!company) {
    throw new Error('Nao foi possivel salvar os dados da empresa.');
  }

  return company;
}

async function getOrganizerEvents(profileId: string): Promise<PartyEvent[]> {
  const { data, error } = await supabase
    .from('eventos')
    .select('*')
    .eq('organizador_id', profileId)
    .order('data_inicio', { ascending: false })
    .limit(80);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapEvent);
}

async function getTicketsForEvents(eventIds: string[]): Promise<TicketRow[]> {
  if (!eventIds.length) {
    return [];
  }

  const { data, error } = await supabase.from('ingressos').select('*').in('evento_id', eventIds);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function getParticipantCounts(eventIds: string[]): Promise<Map<string, number>> {
  if (!eventIds.length) {
    return new Map();
  }

  const { data, error } = await supabase.from('participantes_evento').select('evento_id').in('evento_id', eventIds);

  if (error) {
    throw error;
  }

  return (data ?? []).reduce<Map<string, number>>((acc, row) => {
    acc.set(row.evento_id, (acc.get(row.evento_id) ?? 0) + 1);
    return acc;
  }, new Map());
}

async function getPostCounts(eventIds: string[]): Promise<Map<string, number>> {
  if (!eventIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('posts_evento')
    .select('evento_id')
    .in('evento_id', eventIds)
    .is('excluido_em', null);

  if (error) {
    throw error;
  }

  return (data ?? []).reduce<Map<string, number>>((acc, row) => {
    acc.set(row.evento_id, (acc.get(row.evento_id) ?? 0) + 1);
    return acc;
  }, new Map());
}

export async function getOrganizerDashboard(profile: PartyProfile): Promise<OrganizerDashboard> {
  const [company, events] = await Promise.all([
    getCompanyByProfileId(profile.id),
    getOrganizerEvents(profile.id),
  ]);
  const eventIds = events.map((event) => event.id);
  const [tickets, participantCounts, postCounts] = await Promise.all([
    getTicketsForEvents(eventIds),
    getParticipantCounts(eventIds),
    getPostCounts(eventIds),
  ]);
  const ticketsByEvent = tickets.reduce<Map<string, TicketRow[]>>((acc, ticket) => {
    const current = acc.get(ticket.evento_id) ?? [];
    current.push(ticket);
    acc.set(ticket.evento_id, current);
    return acc;
  }, new Map());
  const now = Date.now();
  const summaries = events.map<OrganizerEventSummary>((event) => {
    const paidTickets = (ticketsByEvent.get(event.id) ?? []).filter((ticket) =>
      ticket.status === 'pago' || ticket.status === 'usado'
    );
    const revenue = paidTickets.reduce((total, ticket) => total + Number(ticket.valor_pago ?? 0), 0);

    return {
      event,
      participants: participantCounts.get(event.id) ?? 0,
      posts: postCounts.get(event.id) ?? 0,
      revenue,
      ticketsSold: paidTickets.length,
    };
  });

  return {
    company,
    completedEvents: summaries.filter((item) => {
      const endDate = item.event.dataFim ?? item.event.dataInicio;

      return endDate ? new Date(endDate).getTime() < now : false;
    }),
    events: summaries,
    formattedRevenue: formatCurrency(summaries.reduce((total, item) => total + item.revenue, 0)),
    totalParticipants: summaries.reduce((total, item) => total + item.participants, 0),
    totalPosts: summaries.reduce((total, item) => total + item.posts, 0),
    totalRevenue: summaries.reduce((total, item) => total + item.revenue, 0),
    totalTicketsSold: summaries.reduce((total, item) => total + item.ticketsSold, 0),
    upcomingEvents: summaries.filter((item) =>
      item.event.dataInicio ? new Date(item.event.dataInicio).getTime() >= now : false,
    ),
  };
}
