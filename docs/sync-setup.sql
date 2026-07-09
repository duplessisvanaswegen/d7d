-- d7d BYOC sync — one-time setup (schema_version 1).
-- Mode: Auth (owner-scoped RLS — recommended).
-- Paste this whole block into your Supabase project's SQL editor and run it once.
-- Then, in Authentication → Providers → Email, turn OFF "Confirm email" so first sign-in is instant.
--
-- For "Simple (less secure)" mode instead, the app's Sync tab shows a permissive-RLS
-- variant of this same script — anyone with your URL + anon key could then read/write.

-- 1. Tables + cursor indexes (one JSONB payload per record).
create table if not exists public.bookmarks (
  id uuid primary key,
  owner uuid default auth.uid(),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  payload jsonb not null
);
create index if not exists bookmarks_cursor on public.bookmarks (updated_at, id);

create table if not exists public.notes (
  id uuid primary key,
  owner uuid default auth.uid(),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  payload jsonb not null
);
create index if not exists notes_cursor on public.notes (updated_at, id);

create table if not exists public.categories (
  id uuid primary key,
  owner uuid default auth.uid(),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  payload jsonb not null
);
create index if not exists categories_cursor on public.categories (updated_at, id);

create table if not exists public.tags (
  id uuid primary key,
  owner uuid default auth.uid(),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  payload jsonb not null
);
create index if not exists tags_cursor on public.tags (updated_at, id);

create table if not exists public.sync_meta (
  key text primary key,
  value text not null
);

-- 2. Server-authoritative updated_at: clients cannot spoof the LWW key.
create or replace function public.d7d_touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists touch_bookmarks on public.bookmarks;
create trigger touch_bookmarks before insert or update on public.bookmarks
  for each row execute function public.d7d_touch_updated_at();

drop trigger if exists touch_notes on public.notes;
create trigger touch_notes before insert or update on public.notes
  for each row execute function public.d7d_touch_updated_at();

drop trigger if exists touch_categories on public.categories;
create trigger touch_categories before insert or update on public.categories
  for each row execute function public.d7d_touch_updated_at();

drop trigger if exists touch_tags on public.tags;
create trigger touch_tags before insert or update on public.tags
  for each row execute function public.d7d_touch_updated_at();

-- 3. Row Level Security (Auth mode — every row scoped to the signed-in user).
alter table public.bookmarks enable row level security;
drop policy if exists d7d_owner on public.bookmarks;
create policy d7d_owner on public.bookmarks for all
  using (owner = auth.uid()) with check (owner = auth.uid());

alter table public.notes enable row level security;
drop policy if exists d7d_owner on public.notes;
create policy d7d_owner on public.notes for all
  using (owner = auth.uid()) with check (owner = auth.uid());

alter table public.categories enable row level security;
drop policy if exists d7d_owner on public.categories;
create policy d7d_owner on public.categories for all
  using (owner = auth.uid()) with check (owner = auth.uid());

alter table public.tags enable row level security;
drop policy if exists d7d_owner on public.tags;
create policy d7d_owner on public.tags for all
  using (owner = auth.uid()) with check (owner = auth.uid());

alter table public.sync_meta enable row level security;
drop policy if exists d7d_meta_read on public.sync_meta;
create policy d7d_meta_read on public.sync_meta for select using (true);

-- 4. Schema-version marker (checked by d7d on every connect).
insert into public.sync_meta(key, value) values ('schema_version', '1')
  on conflict (key) do update set value = excluded.value;
