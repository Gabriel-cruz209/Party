-- PARTY social features support.
-- Run this after the base PARTY schema if these columns/policies are not already present.

create extension if not exists pg_trgm;

alter table public.perfis
  add column if not exists username text,
  add column if not exists ultima_atividade_em timestamptz,
  add column if not exists atualizado_em timestamptz default now();

alter table public.amizades
  add column if not exists atualizado_em timestamptz default now();

create unique index if not exists perfis_username_lower_unique_idx
  on public.perfis (lower(username))
  where username is not null and username <> '';

create index if not exists perfis_nome_trgm_idx
  on public.perfis using gin (nome gin_trgm_ops);

create index if not exists perfis_username_trgm_idx
  on public.perfis using gin (username gin_trgm_ops);

create index if not exists perfis_ultima_atividade_idx
  on public.perfis (ultima_atividade_em desc);

create index if not exists amizades_solicitante_status_idx
  on public.amizades (solicitante_id, status);

create index if not exists amizades_destinatario_status_idx
  on public.amizades (destinatario_id, status);

create unique index if not exists amizades_par_unico_idx
  on public.amizades (
    least(solicitante_id, destinatario_id),
    greatest(solicitante_id, destinatario_id)
  );

create or replace function public.set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists set_perfis_atualizado_em on public.perfis;
create trigger set_perfis_atualizado_em
before update on public.perfis
for each row
execute function public.set_atualizado_em();

drop trigger if exists set_amizades_atualizado_em on public.amizades;
create trigger set_amizades_atualizado_em
before update on public.amizades
for each row
execute function public.set_atualizado_em();

alter table public.perfis enable row level security;
alter table public.amizades enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'perfis'
      and policyname = 'perfis_select_authenticated'
  ) then
    create policy perfis_select_authenticated
      on public.perfis
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
      and tablename = 'perfis'
      and policyname = 'perfis_insert_own_profile'
  ) then
    create policy perfis_insert_own_profile
      on public.perfis
      for insert
      to authenticated
      with check (auth.uid() = usuario_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'perfis'
      and policyname = 'perfis_update_own_profile'
  ) then
    create policy perfis_update_own_profile
      on public.perfis
      for update
      to authenticated
      using (auth.uid() = usuario_id)
      with check (auth.uid() = usuario_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'amizades'
      and policyname = 'amizades_select_own'
  ) then
    create policy amizades_select_own
      on public.amizades
      for select
      to authenticated
      using (auth.uid() = solicitante_id or auth.uid() = destinatario_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'amizades'
      and policyname = 'amizades_insert_own_request'
  ) then
    create policy amizades_insert_own_request
      on public.amizades
      for insert
      to authenticated
      with check (auth.uid() = solicitante_id and status = 'pendente');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'amizades'
      and policyname = 'amizades_recipient_responds'
  ) then
    create policy amizades_recipient_responds
      on public.amizades
      for update
      to authenticated
      using (auth.uid() = destinatario_id or auth.uid() = solicitante_id)
      with check (
        (auth.uid() = destinatario_id and status in ('aceita', 'recusada'))
        or
        (auth.uid() = solicitante_id and status = 'pendente')
      );
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'amizades'
     ) then
    alter publication supabase_realtime add table public.amizades;
  end if;
end;
$$;
