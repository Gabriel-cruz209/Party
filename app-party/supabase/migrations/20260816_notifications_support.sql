-- PARTY notifications, support tickets, and user language preferences.

alter table public.perfis
  add column if not exists push_notificacoes_ativas boolean not null default true,
  add column if not exists idioma_preferido text not null default 'pt-BR';

alter table public.perfis
  drop column if exists expo_push_token;

alter table public.notificacoes
  add column if not exists tipo text not null default 'sistema',
  add column if not exists dados jsonb not null default '{}'::jsonb,
  add column if not exists link_href text,
  add column if not exists dedupe_key text,
  add column if not exists lida_em timestamptz;

alter table public.notificacoes
  drop constraint if exists notificacoes_tipo_check,
  add constraint notificacoes_tipo_check
    check (tipo in ('sistema', 'amizade', 'evento_amigo', 'ingresso_confirmado', 'evento_comecando', 'suporte'));

create unique index if not exists notificacoes_dedupe_key_idx
  on public.notificacoes (dedupe_key)
  where dedupe_key is not null;

create index if not exists notificacoes_usuario_lida_criado_idx
  on public.notificacoes (usuario_id, lida, criado_em desc);

create table if not exists public.tickets_suporte (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  assunto text not null,
  mensagem text not null,
  status text not null default 'aberto',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint tickets_suporte_status_check check (status in ('aberto', 'em_atendimento', 'resolvido', 'fechado')),
  constraint tickets_suporte_assunto_check check (char_length(assunto) between 4 and 120),
  constraint tickets_suporte_mensagem_check check (char_length(mensagem) between 10 and 3000)
);

create index if not exists tickets_suporte_usuario_status_idx
  on public.tickets_suporte (usuario_id, status, criado_em desc);

create table if not exists public.dispositivos_push (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  expo_push_token text not null unique,
  plataforma text not null default 'native',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint dispositivos_push_plataforma_check check (plataforma in ('ios', 'android', 'native'))
);

create index if not exists dispositivos_push_usuario_ativo_idx
  on public.dispositivos_push (usuario_id, ativo);

alter table public.notificacoes enable row level security;
alter table public.tickets_suporte enable row level security;
alter table public.dispositivos_push enable row level security;

do $$
begin
  alter publication supabase_realtime add table public.notificacoes;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

create or replace function public.criar_notificacao(
  usuario_uuid uuid,
  tipo_notificacao text,
  titulo_notificacao text,
  mensagem_notificacao text,
  dados_notificacao jsonb default '{}'::jsonb,
  link_notificacao text default null,
  chave_unica text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  notificacao_id uuid;
begin
  insert into public.notificacoes (
    usuario_id,
    tipo,
    titulo,
    mensagem,
    dados,
    link_href,
    dedupe_key
  )
  values (
    usuario_uuid,
    tipo_notificacao,
    titulo_notificacao,
    mensagem_notificacao,
    coalesce(dados_notificacao, '{}'::jsonb),
    link_notificacao,
    chave_unica
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into notificacao_id;

  return notificacao_id;
end;
$$;

create or replace function public.notificar_nova_amizade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nome_solicitante text;
begin
  if new.status <> 'pendente' then
    return new;
  end if;

  select coalesce(nome, username, 'Alguem')
    into nome_solicitante
    from public.perfis
    where usuario_id = new.solicitante_id
    limit 1;

  perform public.criar_notificacao(
    new.destinatario_id,
    'amizade',
    'Nova solicitacao de amizade',
    coalesce(nome_solicitante, 'Alguem') || ' quer ser seu amigo no Party.',
    jsonb_build_object('amizadeId', new.id, 'usuarioId', new.solicitante_id),
    '/amizades',
    'amizade:' || new.id || ':pendente'
  );

  return new;
end;
$$;

drop trigger if exists trg_notificar_nova_amizade on public.amizades;
create trigger trg_notificar_nova_amizade
after insert on public.amizades
for each row
execute function public.notificar_nova_amizade();

create or replace function public.notificar_amizade_aceita()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nome_destinatario text;
begin
  if old.status = new.status or new.status <> 'aceita' then
    return new;
  end if;

  select coalesce(nome, username, 'Seu novo amigo')
    into nome_destinatario
    from public.perfis
    where usuario_id = new.destinatario_id
    limit 1;

  perform public.criar_notificacao(
    new.solicitante_id,
    'amizade',
    'Novo amigo no Party',
    coalesce(nome_destinatario, 'Seu novo amigo') || ' aceitou sua solicitacao.',
    jsonb_build_object('amizadeId', new.id, 'usuarioId', new.destinatario_id),
    '/amizades',
    'amizade:' || new.id || ':aceita'
  );

  return new;
end;
$$;

drop trigger if exists trg_notificar_amizade_aceita on public.amizades;
create trigger trg_notificar_amizade_aceita
after update on public.amizades
for each row
execute function public.notificar_amizade_aceita();

create or replace function public.notificar_evento_de_amigo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  organizador_usuario uuid;
  amigo record;
begin
  select usuario_id
    into organizador_usuario
    from public.perfis
    where id = new.organizador_id
    limit 1;

  if organizador_usuario is null then
    return new;
  end if;

  for amigo in
    select case
      when a.solicitante_id = organizador_usuario then a.destinatario_id
      else a.solicitante_id
    end as usuario_id
    from public.amizades a
    where a.status = 'aceita'
      and (a.solicitante_id = organizador_usuario or a.destinatario_id = organizador_usuario)
  loop
    perform public.criar_notificacao(
      amigo.usuario_id,
      'evento_amigo',
      'Evento novo de um amigo',
      'Um amigo publicou ' || new.titulo || '.',
      jsonb_build_object('eventoId', new.id, 'organizadorId', organizador_usuario),
      '/eventos/' || new.id || '/index',
      'evento-amigo:' || new.id || ':' || amigo.usuario_id
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notificar_evento_de_amigo on public.eventos;
create trigger trg_notificar_evento_de_amigo
after insert on public.eventos
for each row
execute function public.notificar_evento_de_amigo();

create or replace function public.notificar_ingresso_confirmado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  titulo_evento text;
begin
  if new.status <> 'pago' then
    return new;
  end if;

  select titulo
    into titulo_evento
    from public.eventos
    where id = new.evento_id
    limit 1;

  perform public.criar_notificacao(
    new.comprador_id,
    'ingresso_confirmado',
    'Ingresso confirmado',
    'Seu ingresso para ' || coalesce(titulo_evento, 'o evento') || ' esta ativo.',
    jsonb_build_object('eventoId', new.evento_id, 'ingressoId', new.id),
    '/ingressos/index',
    'ingresso:' || new.id || ':confirmado'
  );

  return new;
end;
$$;

drop trigger if exists trg_notificar_ingresso_confirmado on public.ingressos;
create trigger trg_notificar_ingresso_confirmado
after insert on public.ingressos
for each row
execute function public.notificar_ingresso_confirmado();

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notificacoes'
      and policyname = 'notificacoes_select_own'
  ) then
    create policy notificacoes_select_own
      on public.notificacoes
      for select
      to authenticated
      using (usuario_id = auth.uid());
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dispositivos_push'
      and policyname = 'dispositivos_push_select_own'
  ) then
    create policy dispositivos_push_select_own
      on public.dispositivos_push
      for select
      to authenticated
      using (usuario_id = auth.uid());
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dispositivos_push'
      and policyname = 'dispositivos_push_insert_own'
  ) then
    create policy dispositivos_push_insert_own
      on public.dispositivos_push
      for insert
      to authenticated
      with check (usuario_id = auth.uid());
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dispositivos_push'
      and policyname = 'dispositivos_push_update_own'
  ) then
    create policy dispositivos_push_update_own
      on public.dispositivos_push
      for update
      to authenticated
      using (usuario_id = auth.uid())
      with check (usuario_id = auth.uid());
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notificacoes'
      and policyname = 'notificacoes_insert_own'
  ) then
    create policy notificacoes_insert_own
      on public.notificacoes
      for insert
      to authenticated
      with check (usuario_id = auth.uid());
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notificacoes'
      and policyname = 'notificacoes_update_own'
  ) then
    create policy notificacoes_update_own
      on public.notificacoes
      for update
      to authenticated
      using (usuario_id = auth.uid())
      with check (usuario_id = auth.uid());
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tickets_suporte'
      and policyname = 'tickets_suporte_select_own'
  ) then
    create policy tickets_suporte_select_own
      on public.tickets_suporte
      for select
      to authenticated
      using (usuario_id = auth.uid());
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tickets_suporte'
      and policyname = 'tickets_suporte_insert_own'
  ) then
    create policy tickets_suporte_insert_own
      on public.tickets_suporte
      for insert
      to authenticated
      with check (usuario_id = auth.uid());
  end if;
end;
$$;
