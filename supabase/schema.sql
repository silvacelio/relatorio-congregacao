-- Execute este script no SQL Editor do seu projeto no Supabase
-- (Menu lateral: SQL Editor -> New Query -> Cole e clique em Run)

create table if not exists public.publishers (
  id text primary key,
  name text not null,
  group_name text not null default 'Congregação',
  privilege text not null default 'Publicador',
  active boolean not null default true,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_reports (
  id text primary key,
  month_key text not null,
  timestamp timestamptz not null default now(),
  publisher_name text not null,
  publisher_id text references public.publishers(id) on delete set null,
  participated boolean not null default true,
  hours integer,
  bible_studies integer,
  auxiliary_pioneer text not null default 'Não',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_reports_month
  on public.activity_reports (month_key);

-- Habilita Row Level Security (RLS) com acesso de leitura/escrita pela chave pública (anon)
alter table public.publishers enable row level security;
alter table public.activity_reports enable row level security;

drop policy if exists "Acesso público publishers" on public.publishers;
create policy "Acesso público publishers"
  on public.publishers
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Acesso público activity_reports" on public.activity_reports;
create policy "Acesso público activity_reports"
  on public.activity_reports
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Habilita atualizações em tempo real (Realtime)
alter publication supabase_realtime add table public.publishers;
alter publication supabase_realtime add table public.activity_reports;
