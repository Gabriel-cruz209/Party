-- PARTY - Supabase SQL Schema

create extension if not exists "pgcrypto";

do $$
begin
  create type public.tipo_evento as enum ('publico', 'privado');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.tipo_perfil as enum ('pessoal', 'empresa');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.status_ingresso as enum ('reservado', 'pago', 'cancelado', 'usado', 'transferido');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.status_amizade as enum ('pendente', 'aceita', 'recusada', 'bloqueada');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  nome text,
  telefone text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null references public.usuarios(id) on delete cascade,
  nome text not null,
  descricao text,
  cnpj text unique,
  site text,
  instagram text,
  verificada boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.perfis (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null unique references public.usuarios(id) on delete cascade,
  empresa_id uuid references public.empresas(id) on delete set null,
  tipo public.tipo_perfil not null default 'pessoal',
  nome_exibicao text not null,
  bio text,
  avatar_url text,
  interesses text[] not null default '{}',
  instagram text,
  tiktok text,
  youtube text,
  x text,
  linkedin text,
  site text,
  perfil_publico boolean not null default true,
  compartilhar_localizacao boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint perfis_empresa_tipo_check check (
    (tipo = 'pessoal' and empresa_id is null)
    or
    (tipo = 'empresa' and empresa_id is not null)
  )
);

create table if not exists public.amizades (
  id uuid primary key default gen_random_uuid(),
  solicitante_id uuid not null references public.usuarios(id) on delete cascade,
  solicitado_id uuid not null references public.usuarios(id) on delete cascade,
  status public.status_amizade not null default 'pendente',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint amizades_usuarios_diferentes check (solicitante_id <> solicitado_id),
  constraint amizades_unicas unique (solicitante_id, solicitado_id)
);

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  organizador_id uuid not null references public.usuarios(id) on delete cascade,
  empresa_id uuid references public.empresas(id) on delete set null,
  titulo text not null,
  descricao text,
  tipo public.tipo_evento not null default 'publico',
  categoria text,
  faixa_etaria text,
  banner_url text,
  endereco text,
  cidade text,
  estado text,
  pais text not null default 'BR',
  latitude double precision,
  longitude double precision,
  inicio_em timestamptz not null,
  fim_em timestamptz,
  capacidade integer,
  preco_minimo numeric(10,2),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.participantes_evento (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  confirmado boolean not null default true,
  checkin_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint participantes_evento_unicos unique (evento_id, usuario_id)
);

create table if not exists public.ingressos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  comprador_id uuid not null references public.usuarios(id) on delete cascade,
  dono_id uuid not null references public.usuarios(id) on delete cascade,
  codigo text not null unique default encode(gen_random_bytes(16), 'hex'),
  qr_code_url text,
  tipo text not null default 'normal',
  lote text,
  preco numeric(10,2) not null default 0,
  status public.status_ingresso not null default 'reservado',
  comprado_em timestamptz,
  usado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.posts_evento (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  conteudo text,
  midia_url text,
  tipo_midia text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.mensagens_evento (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  mensagem text not null,
  midia_url text,
  resposta_a_id uuid references public.mensagens_evento(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  titulo text not null,
  mensagem text not null,
  tipo text,
  dados jsonb not null default '{}',
  lida boolean not null default false,
  criada_em timestamptz not null default now()
);

create or replace function public.sao_amigos(usuario_a uuid, usuario_b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.amizades a
    where a.status = 'aceita'
      and (
        (a.solicitante_id = usuario_a and a.solicitado_id = usuario_b)
        or
        (a.solicitante_id = usuario_b and a.solicitado_id = usuario_a)
      )
  );
$$;

create or replace function public.pode_ver_evento(evento public.eventos)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    evento.ativo = true
    and (
      evento.tipo = 'publico'
      or evento.organizador_id = auth.uid()
      or public.sao_amigos(auth.uid(), evento.organizador_id)
      or exists (
        select 1
        from public.participantes_evento pe
        where pe.evento_id = evento.id
          and pe.usuario_id = auth.uid()
      )
    );
$$;

create or replace function public.usuario_participa_evento(evento_uuid uuid, usuario_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.participantes_evento pe
    where pe.evento_id = evento_uuid
      and pe.usuario_id = usuario_uuid
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nome_metadata text;
begin
  nome_metadata := coalesce(
    new.raw_user_meta_data ->> 'nome',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );

  insert into public.usuarios (id, email, nome)
  values (new.id, new.email, nome_metadata)
  on conflict (id) do nothing;

  insert into public.perfis (usuario_id, tipo, nome_exibicao)
  values (new.id, 'pessoal', nome_metadata)
  on conflict (usuario_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists usuarios_set_atualizado_em on public.usuarios;
create trigger usuarios_set_atualizado_em
before update on public.usuarios
for each row execute function public.set_atualizado_em();

drop trigger if exists empresas_set_atualizado_em on public.empresas;
create trigger empresas_set_atualizado_em
before update on public.empresas
for each row execute function public.set_atualizado_em();

drop trigger if exists perfis_set_atualizado_em on public.perfis;
create trigger perfis_set_atualizado_em
before update on public.perfis
for each row execute function public.set_atualizado_em();

drop trigger if exists amizades_set_atualizado_em on public.amizades;
create trigger amizades_set_atualizado_em
before update on public.amizades
for each row execute function public.set_atualizado_em();

drop trigger if exists eventos_set_atualizado_em on public.eventos;
create trigger eventos_set_atualizado_em
before update on public.eventos
for each row execute function public.set_atualizado_em();

drop trigger if exists participantes_evento_set_atualizado_em on public.participantes_evento;
create trigger participantes_evento_set_atualizado_em
before update on public.participantes_evento
for each row execute function public.set_atualizado_em();

drop trigger if exists ingressos_set_atualizado_em on public.ingressos;
create trigger ingressos_set_atualizado_em
before update on public.ingressos
for each row execute function public.set_atualizado_em();

drop trigger if exists posts_evento_set_atualizado_em on public.posts_evento;
create trigger posts_evento_set_atualizado_em
before update on public.posts_evento
for each row execute function public.set_atualizado_em();

drop trigger if exists mensagens_evento_set_atualizado_em on public.mensagens_evento;
create trigger mensagens_evento_set_atualizado_em
before update on public.mensagens_evento
for each row execute function public.set_atualizado_em();

alter table public.usuarios enable row level security;
alter table public.empresas enable row level security;
alter table public.perfis enable row level security;
alter table public.amizades enable row level security;
alter table public.eventos enable row level security;
alter table public.participantes_evento enable row level security;
alter table public.ingressos enable row level security;
alter table public.posts_evento enable row level security;
alter table public.mensagens_evento enable row level security;
alter table public.notificacoes enable row level security;

drop policy if exists "usuarios_select_proprio_ou_publicos" on public.usuarios;
create policy "usuarios_select_proprio_ou_publicos"
on public.usuarios
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.perfis p
    where p.usuario_id = usuarios.id
      and p.perfil_publico = true
  )
  or public.sao_amigos(auth.uid(), id)
);

drop policy if exists "usuarios_update_proprio" on public.usuarios;
create policy "usuarios_update_proprio"
on public.usuarios
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "empresas_select_publico" on public.empresas;
create policy "empresas_select_publico"
on public.empresas
for select
to authenticated
using (true);

drop policy if exists "empresas_insert_dono" on public.empresas;
create policy "empresas_insert_dono"
on public.empresas
for insert
to authenticated
with check (dono_id = auth.uid());

drop policy if exists "empresas_update_dono" on public.empresas;
create policy "empresas_update_dono"
on public.empresas
for update
to authenticated
using (dono_id = auth.uid())
with check (dono_id = auth.uid());

drop policy if exists "empresas_delete_dono" on public.empresas;
create policy "empresas_delete_dono"
on public.empresas
for delete
to authenticated
using (dono_id = auth.uid());

drop policy if exists "perfis_select_privacidade" on public.perfis;
create policy "perfis_select_privacidade"
on public.perfis
for select
to authenticated
using (
  usuario_id = auth.uid()
  or perfil_publico = true
  or public.sao_amigos(auth.uid(), usuario_id)
);

drop policy if exists "perfis_insert_proprio" on public.perfis;
create policy "perfis_insert_proprio"
on public.perfis
for insert
to authenticated
with check (usuario_id = auth.uid());

drop policy if exists "perfis_update_proprio" on public.perfis;
create policy "perfis_update_proprio"
on public.perfis
for update
to authenticated
using (usuario_id = auth.uid())
with check (usuario_id = auth.uid());

drop policy if exists "amizades_select_participantes" on public.amizades;
create policy "amizades_select_participantes"
on public.amizades
for select
to authenticated
using (
  solicitante_id = auth.uid()
  or solicitado_id = auth.uid()
);

drop policy if exists "amizades_insert_solicitante" on public.amizades;
create policy "amizades_insert_solicitante"
on public.amizades
for insert
to authenticated
with check (
  solicitante_id = auth.uid()
  and status = 'pendente'
);

drop policy if exists "amizades_update_participantes" on public.amizades;
create policy "amizades_update_participantes"
on public.amizades
for update
to authenticated
using (
  solicitante_id = auth.uid()
  or solicitado_id = auth.uid()
)
with check (
  solicitante_id = auth.uid()
  or solicitado_id = auth.uid()
);

drop policy if exists "amizades_delete_participantes" on public.amizades;
create policy "amizades_delete_participantes"
on public.amizades
for delete
to authenticated
using (
  solicitante_id = auth.uid()
  or solicitado_id = auth.uid()
);

drop policy if exists "eventos_select_privacidade" on public.eventos;
create policy "eventos_select_privacidade"
on public.eventos
for select
to authenticated
using (public.pode_ver_evento(eventos));

drop policy if exists "eventos_insert_organizador" on public.eventos;
create policy "eventos_insert_organizador"
on public.eventos
for insert
to authenticated
with check (
  organizador_id = auth.uid()
  and (
    empresa_id is null
    or exists (
      select 1
      from public.empresas e
      where e.id = empresa_id
        and e.dono_id = auth.uid()
    )
  )
);

drop policy if exists "eventos_update_organizador" on public.eventos;
create policy "eventos_update_organizador"
on public.eventos
for update
to authenticated
using (organizador_id = auth.uid())
with check (organizador_id = auth.uid());

drop policy if exists "eventos_delete_organizador" on public.eventos;
create policy "eventos_delete_organizador"
on public.eventos
for delete
to authenticated
using (organizador_id = auth.uid());

drop policy if exists "participantes_evento_select_evento_visivel" on public.participantes_evento;
create policy "participantes_evento_select_evento_visivel"
on public.participantes_evento
for select
to authenticated
using (
  exists (
    select 1
    from public.eventos e
    where e.id = participantes_evento.evento_id
      and public.pode_ver_evento(e)
  )
);

drop policy if exists "participantes_evento_insert_usuario_evento_visivel" on public.participantes_evento;
create policy "participantes_evento_insert_usuario_evento_visivel"
on public.participantes_evento
for insert
to authenticated
with check (
  usuario_id = auth.uid()
  and exists (
    select 1
    from public.eventos e
    where e.id = evento_id
      and public.pode_ver_evento(e)
  )
);

drop policy if exists "participantes_evento_update_proprio_ou_organizador" on public.participantes_evento;
create policy "participantes_evento_update_proprio_ou_organizador"
on public.participantes_evento
for update
to authenticated
using (
  usuario_id = auth.uid()
  or exists (
    select 1
    from public.eventos e
    where e.id = participantes_evento.evento_id
      and e.organizador_id = auth.uid()
  )
)
with check (
  usuario_id = auth.uid()
  or exists (
    select 1
    from public.eventos e
    where e.id = evento_id
      and e.organizador_id = auth.uid()
  )
);

drop policy if exists "participantes_evento_delete_proprio_ou_organizador" on public.participantes_evento;
create policy "participantes_evento_delete_proprio_ou_organizador"
on public.participantes_evento
for delete
to authenticated
using (
  usuario_id = auth.uid()
  or exists (
    select 1
    from public.eventos e
    where e.id = participantes_evento.evento_id
      and e.organizador_id = auth.uid()
  )
);

drop policy if exists "ingressos_select_dono_comprador_organizador" on public.ingressos;
create policy "ingressos_select_dono_comprador_organizador"
on public.ingressos
for select
to authenticated
using (
  dono_id = auth.uid()
  or comprador_id = auth.uid()
  or exists (
    select 1
    from public.eventos e
    where e.id = ingressos.evento_id
      and e.organizador_id = auth.uid()
  )
);

drop policy if exists "ingressos_insert_comprador_evento_visivel" on public.ingressos;
create policy "ingressos_insert_comprador_evento_visivel"
on public.ingressos
for insert
to authenticated
with check (
  comprador_id = auth.uid()
  and dono_id = auth.uid()
  and exists (
    select 1
    from public.eventos e
    where e.id = evento_id
      and public.pode_ver_evento(e)
  )
);

drop policy if exists "ingressos_update_dono_ou_organizador" on public.ingressos;
create policy "ingressos_update_dono_ou_organizador"
on public.ingressos
for update
to authenticated
using (
  dono_id = auth.uid()
  or exists (
    select 1
    from public.eventos e
    where e.id = ingressos.evento_id
      and e.organizador_id = auth.uid()
  )
)
with check (
  dono_id = auth.uid()
  or exists (
    select 1
    from public.eventos e
    where e.id = evento_id
      and e.organizador_id = auth.uid()
  )
);

drop policy if exists "posts_evento_select_evento_visivel" on public.posts_evento;
create policy "posts_evento_select_evento_visivel"
on public.posts_evento
for select
to authenticated
using (
  exists (
    select 1
    from public.eventos e
    where e.id = posts_evento.evento_id
      and public.pode_ver_evento(e)
  )
);

drop policy if exists "posts_evento_insert_participante" on public.posts_evento;
create policy "posts_evento_insert_participante"
on public.posts_evento
for insert
to authenticated
with check (
  usuario_id = auth.uid()
  and public.usuario_participa_evento(evento_id, auth.uid())
);

drop policy if exists "posts_evento_update_autor" on public.posts_evento;
create policy "posts_evento_update_autor"
on public.posts_evento
for update
to authenticated
using (usuario_id = auth.uid())
with check (usuario_id = auth.uid());

drop policy if exists "posts_evento_delete_autor_ou_organizador" on public.posts_evento;
create policy "posts_evento_delete_autor_ou_organizador"
on public.posts_evento
for delete
to authenticated
using (
  usuario_id = auth.uid()
  or exists (
    select 1
    from public.eventos e
    where e.id = posts_evento.evento_id
      and e.organizador_id = auth.uid()
  )
);

drop policy if exists "mensagens_evento_select_participante" on public.mensagens_evento;
create policy "mensagens_evento_select_participante"
on public.mensagens_evento
for select
to authenticated
using (
  public.usuario_participa_evento(evento_id, auth.uid())
  or exists (
    select 1
    from public.eventos e
    where e.id = mensagens_evento.evento_id
      and e.organizador_id = auth.uid()
  )
);

drop policy if exists "mensagens_evento_insert_participante" on public.mensagens_evento;
create policy "mensagens_evento_insert_participante"
on public.mensagens_evento
for insert
to authenticated
with check (
  usuario_id = auth.uid()
  and public.usuario_participa_evento(evento_id, auth.uid())
);

drop policy if exists "mensagens_evento_update_autor" on public.mensagens_evento;
create policy "mensagens_evento_update_autor"
on public.mensagens_evento
for update
to authenticated
using (usuario_id = auth.uid())
with check (usuario_id = auth.uid());

drop policy if exists "mensagens_evento_delete_autor_ou_organizador" on public.mensagens_evento;
create policy "mensagens_evento_delete_autor_ou_organizador"
on public.mensagens_evento
for delete
to authenticated
using (
  usuario_id = auth.uid()
  or exists (
    select 1
    from public.eventos e
    where e.id = mensagens_evento.evento_id
      and e.organizador_id = auth.uid()
  )
);

drop policy if exists "notificacoes_select_proprias" on public.notificacoes;
create policy "notificacoes_select_proprias"
on public.notificacoes
for select
to authenticated
using (usuario_id = auth.uid());

drop policy if exists "notificacoes_insert_proprias" on public.notificacoes;
create policy "notificacoes_insert_proprias"
on public.notificacoes
for insert
to authenticated
with check (usuario_id = auth.uid());

drop policy if exists "notificacoes_update_proprias" on public.notificacoes;
create policy "notificacoes_update_proprias"
on public.notificacoes
for update
to authenticated
using (usuario_id = auth.uid())
with check (usuario_id = auth.uid());

drop policy if exists "notificacoes_delete_proprias" on public.notificacoes;
create policy "notificacoes_delete_proprias"
on public.notificacoes
for delete
to authenticated
using (usuario_id = auth.uid());

create index if not exists idx_usuarios_email on public.usuarios(email);
create index if not exists idx_perfis_usuario_id on public.perfis(usuario_id);
create index if not exists idx_perfis_tipo on public.perfis(tipo);
create index if not exists idx_perfis_nome_exibicao on public.perfis using gin (to_tsvector('portuguese', nome_exibicao));
create index if not exists idx_empresas_dono_id on public.empresas(dono_id);
create index if not exists idx_empresas_nome on public.empresas using gin (to_tsvector('portuguese', nome));
create index if not exists idx_amizades_solicitante on public.amizades(solicitante_id);
create index if not exists idx_amizades_solicitado on public.amizades(solicitado_id);
create index if not exists idx_amizades_status on public.amizades(status);
create index if not exists idx_eventos_organizador_id on public.eventos(organizador_id);
create index if not exists idx_eventos_empresa_id on public.eventos(empresa_id);
create index if not exists idx_eventos_tipo on public.eventos(tipo);
create index if not exists idx_eventos_inicio_em on public.eventos(inicio_em);
create index if not exists idx_eventos_cidade_estado on public.eventos(cidade, estado);
create index if not exists idx_eventos_categoria on public.eventos(categoria);
create index if not exists idx_eventos_titulo_busca on public.eventos using gin (to_tsvector('portuguese', titulo));
create index if not exists idx_eventos_localizacao on public.eventos(latitude, longitude);
create index if not exists idx_participantes_evento_evento_id on public.participantes_evento(evento_id);
create index if not exists idx_participantes_evento_usuario_id on public.participantes_evento(usuario_id);
create index if not exists idx_ingressos_evento_id on public.ingressos(evento_id);
create index if not exists idx_ingressos_comprador_id on public.ingressos(comprador_id);
create index if not exists idx_ingressos_dono_id on public.ingressos(dono_id);
create index if not exists idx_ingressos_status on public.ingressos(status);
create index if not exists idx_ingressos_codigo on public.ingressos(codigo);
create index if not exists idx_posts_evento_evento_id_criado_em on public.posts_evento(evento_id, criado_em desc);
create index if not exists idx_posts_evento_usuario_id on public.posts_evento(usuario_id);
create index if not exists idx_mensagens_evento_evento_id_criado_em on public.mensagens_evento(evento_id, criado_em desc);
create index if not exists idx_mensagens_evento_usuario_id on public.mensagens_evento(usuario_id);
create index if not exists idx_notificacoes_usuario_id_criada_em on public.notificacoes(usuario_id, criada_em desc);
create index if not exists idx_notificacoes_usuario_lida on public.notificacoes(usuario_id, lida);