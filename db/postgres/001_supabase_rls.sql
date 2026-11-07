-- FoodDecode 2.0 — Postgres / Supabase schema with Row Level Security.
-- STATUS: reference migration for deployments that prefer Supabase. It mirrors db/migrations/001_init.sql
-- but has NOT been executed in FoodDecode's test runs (the shipped app uses SQLite + application-level
-- per-user scoping + AES-256-GCM). Using it requires replacing src/lib/server/db.ts/auth.ts with
-- Supabase Auth and a Postgres client; see docs/DEPLOYMENT.md.

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data_enc text not null,                 -- still encrypted by the app (defence in depth)
  updated_at timestamptz not null default now()
);
create table public.profile_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data_enc text not null,
  created_at timestamptz not null default now()
);
create table public.consents (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('health_data','cloud_ocr','scan_history')),
  granted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
create table public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'en' check (language in ('en','hi','ta')),
  updated_at timestamptz not null default now()
);
create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data_enc text not null,
  created_at timestamptz not null default now()
);
create table public.comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data_enc text not null,
  created_at timestamptz not null default now()
);
create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null, field text not null, value text not null, note text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create table public.product_cache (
  barcode text primary key, data jsonb, source text not null, fetched_at timestamptz not null default now()
);

-- Row Level Security: every personal table is readable/writable only by its owner.
do $$
declare t text;
begin
  foreach t in array array['profiles','profile_history','consents','settings','scans','comparisons','corrections'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('create policy %I on public.%I for select using (auth.uid() = user_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id)', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete using (auth.uid() = user_id)', t || '_delete_own', t);
  end loop;
end $$;

-- Health data can only be written after consent.
create policy profiles_require_consent on public.profiles as restrictive for insert
  with check (exists (select 1 from public.consents c where c.user_id = auth.uid() and c.kind = 'health_data' and c.granted));

-- Public product cache: anyone may read, only the service role writes.
alter table public.product_cache enable row level security;
create policy product_cache_read on public.product_cache for select using (true);
revoke insert, update, delete on public.product_cache from anon, authenticated;
