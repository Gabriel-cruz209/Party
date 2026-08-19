-- PARTY business profiles and organizer dashboard support.

alter table public.empresas
  add column if not exists descricao text,
  add column if not exists endereco text,
  add column if not exists telefone text,
  add column if not exists site text,
  add column if not exists tipo_local text default 'casa_de_eventos',
  add column if not exists atualizado_em timestamptz default now();

alter table public.empresas
  drop constraint if exists empresas_tipo_local_check,
  add constraint empresas_tipo_local_check
    check (tipo_local in ('bar', 'clube', 'casa_de_show', 'casa_de_eventos', 'outro'));

create unique index if not exists empresas_perfil_idx
  on public.empresas (perfil_id);

create index if not exists eventos_busca_publica_idx
  on public.eventos (status, tipo, categoria, data_inicio);

create index if not exists eventos_local_data_idx
  on public.eventos (local_nome, data_inicio);

create index if not exists posts_evento_evento_excluido_idx
  on public.posts_evento (evento_id, excluido_em);

alter table public.empresas enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'empresas'
      and policyname = 'empresas_select_authenticated'
  ) then
    create policy empresas_select_authenticated
      on public.empresas
      for select
      to authenticated
      using (true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'empresas'
      and policyname = 'empresas_insert_own_profile'
  ) then
    create policy empresas_insert_own_profile
      on public.empresas
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.perfis p
          where p.id = perfil_id
            and p.usuario_id = auth.uid()
            and p.tipo = 'empresa'
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
      and tablename = 'empresas'
      and policyname = 'empresas_update_own_profile'
  ) then
    create policy empresas_update_own_profile
      on public.empresas
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.perfis p
          where p.id = perfil_id
            and p.usuario_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.perfis p
          where p.id = perfil_id
            and p.usuario_id = auth.uid()
            and p.tipo = 'empresa'
        )
      );
  end if;
end;
$$;
