-- PARTY event creation, ticketing, and age-gate support.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'status_evento') then
    create type public.status_evento as enum ('ativo', 'cancelado');
  end if;
end;
$$;

alter table public.perfis
  add column if not exists data_nascimento date;

alter table public.eventos
  add column if not exists status public.status_evento default 'ativo',
  add column if not exists categoria text default 'festa',
  add column if not exists endereco text,
  add column if not exists capacidade integer,
  add column if not exists classificacao_etaria integer default 0,
  add column if not exists capa_url text,
  add column if not exists preco_ingresso numeric(10, 2) default 0,
  add column if not exists atualizado_em timestamptz default now();

alter table public.ingressos
  add column if not exists valor_pago numeric(10, 2) default 0,
  add column if not exists comprado_em timestamptz default now(),
  add column if not exists validado_em timestamptz;

alter table public.participantes_evento
  add column if not exists removido_chat_em timestamptz,
  add column if not exists removido_chat_por uuid references public.usuarios(id) on delete set null;

alter table public.mensagens_evento
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por uuid references public.usuarios(id) on delete set null;

alter table public.posts_evento
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por uuid references public.usuarios(id) on delete set null;

create table if not exists public.reacoes_post_evento (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  post_id uuid not null references public.posts_evento(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  tipo text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint reacoes_post_evento_tipo_check check (tipo in ('curtir', 'amei', 'fogo', 'uau'))
);

create unique index if not exists reacoes_post_evento_unique_idx
  on public.reacoes_post_evento (post_id, usuario_id);

create index if not exists reacoes_post_evento_evento_idx
  on public.reacoes_post_evento (evento_id, post_id);

alter table public.eventos
  drop constraint if exists eventos_capacidade_check,
  add constraint eventos_capacidade_check check (capacidade is null or capacidade between 1 and 100000);

alter table public.eventos
  drop constraint if exists eventos_classificacao_etaria_check,
  add constraint eventos_classificacao_etaria_check check (classificacao_etaria in (0, 10, 12, 14, 16, 18));

alter table public.eventos
  drop constraint if exists eventos_preco_ingresso_check,
  add constraint eventos_preco_ingresso_check check (preco_ingresso >= 0 and preco_ingresso <= 100000);

alter table public.eventos
  drop constraint if exists eventos_categoria_check,
  add constraint eventos_categoria_check check (categoria ~ '^[a-z0-9_-]{3,40}$');

alter table public.eventos
  drop constraint if exists eventos_data_inicio_check,
  add constraint eventos_data_inicio_check check (data_inicio is null or data_inicio > now() - interval '1 day');

create index if not exists eventos_tipo_status_data_idx
  on public.eventos (tipo, status, data_inicio);

create index if not exists eventos_organizador_status_idx
  on public.eventos (organizador_id, status);

create index if not exists eventos_categoria_status_data_idx
  on public.eventos (categoria, status, data_inicio);

create index if not exists participantes_evento_usuario_evento_idx
  on public.participantes_evento (usuario_id, evento_id);

create index if not exists mensagens_evento_evento_criado_idx
  on public.mensagens_evento (evento_id, criado_em);

create index if not exists posts_evento_evento_criado_idx
  on public.posts_evento (evento_id, criado_em desc);

create index if not exists ingressos_evento_status_idx
  on public.ingressos (evento_id, status);

create unique index if not exists ingressos_codigo_unique_idx
  on public.ingressos (codigo);

create unique index if not exists ingressos_qr_code_url_unique_idx
  on public.ingressos (qr_code_url)
  where qr_code_url is not null;

create or replace function public.sao_amigos(usuario_a uuid, usuario_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.amizades a
    where a.status = 'aceita'
      and (
        (a.solicitante_id = usuario_a and a.destinatario_id = usuario_b)
        or
        (a.solicitante_id = usuario_b and a.destinatario_id = usuario_a)
      )
  );
$$;

create or replace function public.participa_do_evento(evento_uuid uuid, usuario_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.participantes_evento pe
    where pe.evento_id = evento_uuid
      and pe.usuario_id = usuario_uuid
  );
$$;

create or replace function public.evento_organizador_usuario(evento_uuid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.usuario_id
  from public.eventos e
  join public.perfis p on p.id = e.organizador_id
  where e.id = evento_uuid
  limit 1;
$$;

create or replace function public.usuario_tem_ingresso_valido(evento_uuid uuid, usuario_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.participantes_evento pe
    join public.ingressos i
      on i.evento_id = pe.evento_id
     and i.comprador_id = pe.usuario_id
    where pe.evento_id = evento_uuid
      and pe.usuario_id = usuario_uuid
      and pe.removido_chat_em is null
      and i.status in ('pago', 'usado')
  );
$$;

create or replace function public.usuario_pode_acessar_social_evento(evento_uuid uuid, usuario_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.evento_organizador_usuario(evento_uuid) = usuario_uuid
    or public.usuario_tem_ingresso_valido(evento_uuid, usuario_uuid);
$$;

create or replace function public.evento_arquivado_visivel(evento_uuid uuid, usuario_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.eventos e
    join public.perfis organizador on organizador.id = e.organizador_id
    where e.id = evento_uuid
      and coalesce(e.data_fim, e.data_inicio) < now()
      and (
        e.tipo = 'publico'
        or organizador.usuario_id = usuario_uuid
        or public.sao_amigos(usuario_uuid, organizador.usuario_id)
        or public.participa_do_evento(evento_uuid, usuario_uuid)
      )
  );
$$;

create table if not exists public.localizacoes_usuarios (
  usuario_id uuid primary key references public.usuarios(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  precisao_metros double precision,
  evento_id uuid references public.eventos(id) on delete set null,
  compartilhando boolean not null default true,
  atualizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  constraint localizacoes_latitude_check check (latitude between -90 and 90),
  constraint localizacoes_longitude_check check (longitude between -180 and 180),
  constraint localizacoes_precisao_check check (precisao_metros is null or precisao_metros between 0 and 50000)
);

create index if not exists localizacoes_usuarios_compartilhando_idx
  on public.localizacoes_usuarios (compartilhando, atualizado_em desc);

create index if not exists localizacoes_usuarios_evento_idx
  on public.localizacoes_usuarios (evento_id);

alter table public.eventos enable row level security;
alter table public.participantes_evento enable row level security;
alter table public.ingressos enable row level security;
alter table public.localizacoes_usuarios enable row level security;
alter table public.mensagens_evento enable row level security;
alter table public.posts_evento enable row level security;
alter table public.reacoes_post_evento enable row level security;

do $$
begin
  alter publication supabase_realtime add table public.localizacoes_usuarios;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.mensagens_evento;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.posts_evento;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.reacoes_post_evento;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.participantes_evento;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'eventos'
      and policyname = 'eventos_select_public_or_friend_private'
  ) then
    create policy eventos_select_public_or_friend_private
      on public.eventos
      for select
      to authenticated
      using (
        status = 'ativo'
        and (
          tipo = 'publico'
          or exists (
            select 1
            from public.perfis organizador
            where organizador.id = eventos.organizador_id
              and (
                organizador.usuario_id = auth.uid()
                or public.sao_amigos(auth.uid(), organizador.usuario_id)
              )
          )
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'mensagens_evento'
      and policyname = 'mensagens_select_social_or_archive'
  ) then
    create policy mensagens_select_social_or_archive
      on public.mensagens_evento
      for select
      to authenticated
      using (
        public.usuario_pode_acessar_social_evento(evento_id, auth.uid())
        or public.evento_arquivado_visivel(evento_id, auth.uid())
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'mensagens_evento'
      and policyname = 'mensagens_insert_valid_ticket'
  ) then
    create policy mensagens_insert_valid_ticket
      on public.mensagens_evento
      for insert
      to authenticated
      with check (
        autor_id = auth.uid()
        and public.usuario_pode_acessar_social_evento(evento_id, auth.uid())
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'mensagens_evento'
      and policyname = 'mensagens_update_organizer_delete'
  ) then
    create policy mensagens_update_organizer_delete
      on public.mensagens_evento
      for update
      to authenticated
      using (public.evento_organizador_usuario(evento_id) = auth.uid())
      with check (public.evento_organizador_usuario(evento_id) = auth.uid());
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'posts_evento'
      and policyname = 'posts_select_social_or_archive'
  ) then
    create policy posts_select_social_or_archive
      on public.posts_evento
      for select
      to authenticated
      using (
        public.usuario_pode_acessar_social_evento(evento_id, auth.uid())
        or public.evento_arquivado_visivel(evento_id, auth.uid())
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'posts_evento'
      and policyname = 'posts_insert_valid_ticket'
  ) then
    create policy posts_insert_valid_ticket
      on public.posts_evento
      for insert
      to authenticated
      with check (
        autor_id = auth.uid()
        and public.usuario_pode_acessar_social_evento(evento_id, auth.uid())
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'posts_evento'
      and policyname = 'posts_update_author_or_organizer'
  ) then
    create policy posts_update_author_or_organizer
      on public.posts_evento
      for update
      to authenticated
      using (
        autor_id = auth.uid()
        or public.evento_organizador_usuario(evento_id) = auth.uid()
      )
      with check (
        autor_id = auth.uid()
        or public.evento_organizador_usuario(evento_id) = auth.uid()
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reacoes_post_evento'
      and policyname = 'reacoes_select_social_or_archive'
  ) then
    create policy reacoes_select_social_or_archive
      on public.reacoes_post_evento
      for select
      to authenticated
      using (
        public.usuario_pode_acessar_social_evento(evento_id, auth.uid())
        or public.evento_arquivado_visivel(evento_id, auth.uid())
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reacoes_post_evento'
      and policyname = 'reacoes_insert_valid_ticket'
  ) then
    create policy reacoes_insert_valid_ticket
      on public.reacoes_post_evento
      for insert
      to authenticated
      with check (
        usuario_id = auth.uid()
        and public.usuario_pode_acessar_social_evento(evento_id, auth.uid())
      );
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reacoes_post_evento'
      and policyname = 'reacoes_update_delete_self'
  ) then
    drop policy reacoes_update_delete_self on public.reacoes_post_evento;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reacoes_post_evento'
      and policyname = 'reacoes_update_self'
  ) then
    create policy reacoes_update_self
      on public.reacoes_post_evento
      for update
      to authenticated
      using (
        usuario_id = auth.uid()
        and public.usuario_pode_acessar_social_evento(evento_id, auth.uid())
      )
      with check (
        usuario_id = auth.uid()
        and public.usuario_pode_acessar_social_evento(evento_id, auth.uid())
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reacoes_post_evento'
      and policyname = 'reacoes_delete_self'
  ) then
    create policy reacoes_delete_self
      on public.reacoes_post_evento
      for delete
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
      and tablename = 'localizacoes_usuarios'
      and policyname = 'localizacoes_select_self_or_friends'
  ) then
    create policy localizacoes_select_self_or_friends
      on public.localizacoes_usuarios
      for select
      to authenticated
      using (
        usuario_id = auth.uid()
        or (
          compartilhando = true
          and public.sao_amigos(auth.uid(), usuario_id)
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'participantes_evento'
      and policyname = 'participantes_update_chat_moderation'
  ) then
    create policy participantes_update_chat_moderation
      on public.participantes_evento
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.eventos e
          join public.perfis p on p.id = e.organizador_id
          where e.id = evento_id
            and p.usuario_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.eventos e
          join public.perfis p on p.id = e.organizador_id
          where e.id = evento_id
            and p.usuario_id = auth.uid()
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'localizacoes_usuarios'
      and policyname = 'localizacoes_insert_self'
  ) then
    create policy localizacoes_insert_self
      on public.localizacoes_usuarios
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
      and tablename = 'localizacoes_usuarios'
      and policyname = 'localizacoes_update_self'
  ) then
    create policy localizacoes_update_self
      on public.localizacoes_usuarios
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
      and tablename = 'eventos'
      and policyname = 'eventos_select_own_or_participating'
  ) then
    create policy eventos_select_own_or_participating
      on public.eventos
      for select
      to authenticated
      using (
        public.participa_do_evento(eventos.id, auth.uid())
        or exists (
          select 1
          from public.perfis p
          where p.id = eventos.organizador_id
            and p.usuario_id = auth.uid()
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'eventos'
      and policyname = 'eventos_insert_own_profile'
  ) then
    create policy eventos_insert_own_profile
      on public.eventos
      for insert
      to authenticated
      with check (
        exists (
          select 1 from public.perfis p
          where p.id = organizador_id
            and p.usuario_id = auth.uid()
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'participantes_evento'
      and policyname = 'participantes_select_event_organizer'
  ) then
    create policy participantes_select_event_organizer
      on public.participantes_evento
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.eventos e
          join public.perfis p on p.id = e.organizador_id
          where e.id = evento_id
            and p.usuario_id = auth.uid()
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'eventos'
      and policyname = 'eventos_update_own_profile'
  ) then
    create policy eventos_update_own_profile
      on public.eventos
      for update
      to authenticated
      using (
        exists (
          select 1 from public.perfis p
          where p.id = organizador_id
            and p.usuario_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.perfis p
          where p.id = organizador_id
            and p.usuario_id = auth.uid()
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'participantes_evento'
      and policyname = 'participantes_select_visible_events'
  ) then
    create policy participantes_select_visible_events
      on public.participantes_evento
      for select
      to authenticated
      using (
        usuario_id = auth.uid()
        or exists (
          select 1
          from public.eventos e
          where e.id = evento_id
            and (
              e.tipo = 'publico'
              or exists (
                select 1
                from public.perfis organizador
                where organizador.id = e.organizador_id
                  and public.sao_amigos(auth.uid(), organizador.usuario_id)
              )
            )
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'participantes_evento'
      and policyname = 'participantes_insert_self'
  ) then
    create policy participantes_insert_self
      on public.participantes_evento
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
      and tablename = 'ingressos'
      and policyname = 'ingressos_select_buyer_or_organizer'
  ) then
    create policy ingressos_select_buyer_or_organizer
      on public.ingressos
      for select
      to authenticated
      using (
        comprador_id = auth.uid()
        or exists (
          select 1
          from public.eventos e
          join public.perfis p on p.id = e.organizador_id
          where e.id = evento_id
            and p.usuario_id = auth.uid()
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ingressos'
      and policyname = 'ingressos_insert_self'
  ) then
    create policy ingressos_insert_self
      on public.ingressos
      for insert
      to authenticated
      with check (comprador_id = auth.uid());
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ingressos'
      and policyname = 'ingressos_update_organizer_validation'
  ) then
    create policy ingressos_update_organizer_validation
      on public.ingressos
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.eventos e
          join public.perfis p on p.id = e.organizador_id
          where e.id = evento_id
            and p.usuario_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.eventos e
          join public.perfis p on p.id = e.organizador_id
          where e.id = evento_id
            and p.usuario_id = auth.uid()
        )
      );
  end if;
end;
$$;
