import type { User } from '@supabase/supabase-js';

import type { CloudinaryUploadFile } from '@/lib/cloudinary';
import { supabase } from '@/lib/supabase';
import type { Database, Json } from '@/types/database.types';

export type TipoPerfil = Database['public']['Enums']['tipo_perfil'];
export type PerfilRow = Database['public']['Tables']['perfis']['Row'];
export type SocialLinkKey = 'instagram' | 'tiktok' | 'youtube' | 'x' | 'linkedin' | 'site';
export type SocialLinks = Partial<Record<SocialLinkKey, string>>;

export type PartyProfile = {
  id: string;
  usuarioId: string;
  tipo: TipoPerfil;
  username: string;
  nome: string;
  dataNascimento: string | null;
  bio: string;
  fotoUrl: string | null;
  linksSociais: SocialLinks;
  pushNotificacoesAtivas: boolean;
  idiomaPreferido: string;
  ultimaAtividadeEm: string | null;
  online: boolean;
  criadoEm: string | null;
  atualizadoEm: string | null;
};

export type ProfileMutationInput = {
  tipo: TipoPerfil;
  username?: string;
  nome: string;
  dataNascimento?: string | null;
  bio?: string;
  fotoUrl?: string | null;
  fotoFile?: CloudinaryUploadFile | null;
  linksSociais?: SocialLinks;
  idiomaPreferido?: string;
};

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function isSocialLinks(value: Json | null): value is SocialLinks {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeUsername(value: string): string {
  return value
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 30);
}

export function isUserOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) {
    return false;
  }

  return Date.now() - new Date(lastSeenAt).getTime() <= ONLINE_WINDOW_MS;
}

export function normalizeSocialLinks(links: SocialLinks = {}): SocialLinks {
  return Object.entries(links).reduce<SocialLinks>((acc, [key, value]) => {
    const cleanValue = value?.trim();

    if (cleanValue) {
      acc[key as SocialLinkKey] = cleanValue;
    }

    return acc;
  }, {});
}

export function mapProfile(row: PerfilRow | null): PartyProfile | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    usuarioId: row.usuario_id,
    tipo: row.tipo,
    username: row.username?.trim() ?? '',
    nome: row.nome?.trim() ?? '',
    dataNascimento: row.data_nascimento,
    bio: row.bio?.trim() ?? '',
    fotoUrl: row.foto_url,
    linksSociais: isSocialLinks(row.links_sociais) ? row.links_sociais : {},
    pushNotificacoesAtivas: row.push_notificacoes_ativas ?? true,
    idiomaPreferido: row.idioma_preferido || 'pt-BR',
    ultimaAtividadeEm: row.ultima_atividade_em,
    online: isUserOnline(row.ultima_atividade_em),
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

export function isProfileComplete(profile: PartyProfile | null): profile is PartyProfile {
  return !!profile?.nome.trim() && !!profile.tipo;
}

export async function getProfileByUserId(userId: string): Promise<PartyProfile | null> {
  const { data, error } = await supabase
    .from('perfis')
    .select('*')
    .eq('usuario_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapProfile(data);
}

export async function ensureUsuario(user: User): Promise<void> {
  const email = user.email?.trim();

  if (!email) {
    return;
  }

  const { error } = await supabase.from('usuarios').upsert(
    {
      id: user.id,
      email,
    },
    {
      onConflict: 'id',
    },
  );

  if (error) {
    throw error;
  }
}

export async function saveProfile(user: User, input: ProfileMutationInput): Promise<PartyProfile> {
  await ensureUsuario(user);

  const normalizedLinks = normalizeSocialLinks(input.linksSociais);
  const username = normalizeUsername(input.username || input.nome);
  const payload: Database['public']['Tables']['perfis']['Insert'] = {
    usuario_id: user.id,
    tipo: input.tipo,
    username: username || null,
    nome: input.nome.trim(),
    data_nascimento: input.dataNascimento || null,
    bio: input.bio?.trim() || null,
    foto_url: input.fotoUrl ?? null,
    links_sociais: normalizedLinks as Json,
    idioma_preferido: input.idiomaPreferido || 'pt-BR',
    ultima_atividade_em: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('perfis')
    .upsert(payload, {
      onConflict: 'usuario_id',
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  const profile = mapProfile(data);

  if (!profile) {
    throw new Error('Nao foi possivel carregar o perfil salvo.');
  }

  return profile;
}

export async function touchUserProfileActivity(userId: string): Promise<void> {
  const { error } = await supabase
    .from('perfis')
    .update({ ultima_atividade_em: new Date().toISOString() })
    .eq('usuario_id', userId);

  if (error) {
    throw error;
  }
}
