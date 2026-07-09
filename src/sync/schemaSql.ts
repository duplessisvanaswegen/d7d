import type { SyncMode } from './config'
import { CLOUD_SCHEMA_VERSION, SYNC_TABLES } from './constants'

// The copy-paste setup SQL shown in the Sync tab and mirrored in docs/sync-setup.sql.
// One DDL for both modes; only the RLS policies differ (auth = owner-scoped,
// simple = permissive). `owner` is nullable so simple-mode inserts (no auth.uid())
// succeed while auth-mode inserts fill it from the session.

const ddl = SYNC_TABLES.map(
  (t) => `create table if not exists public.${t} (
  id uuid primary key,
  owner uuid default auth.uid(),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  payload jsonb not null
);
create index if not exists ${t}_cursor on public.${t} (updated_at, id);`,
).join('\n\n')

const triggers = SYNC_TABLES.map(
  (t) => `drop trigger if exists touch_${t} on public.${t};
create trigger touch_${t} before insert or update on public.${t}
  for each row execute function public.d7d_touch_updated_at();`,
).join('\n\n')

function policies(mode: SyncMode): string {
  if (mode === 'simple') {
    // Simple (less secure): anyone with the URL + anon key can read/write.
    return SYNC_TABLES.map(
      (t) => `alter table public.${t} enable row level security;
drop policy if exists d7d_all on public.${t};
create policy d7d_all on public.${t} for all using (true) with check (true);`,
    ).join('\n\n')
  }
  // Auth (default): every row scoped to the signed-in user.
  return SYNC_TABLES.map(
    (t) => `alter table public.${t} enable row level security;
drop policy if exists d7d_owner on public.${t};
create policy d7d_owner on public.${t} for all
  using (owner = auth.uid()) with check (owner = auth.uid());`,
  ).join('\n\n')
}

export function setupSql(mode: SyncMode): string {
  return `-- d7d BYOC sync — one-time setup (schema_version ${CLOUD_SCHEMA_VERSION}).
-- Mode: ${mode === 'simple' ? 'Simple (permissive RLS — less secure)' : 'Auth (owner-scoped RLS — recommended)'}
-- Paste this whole block into your Supabase project's SQL editor and run it once.
${mode === 'auth' ? "-- Then, in Authentication → Providers → Email, turn OFF \"Confirm email\" so first sign-in is instant.\n" : ''}
-- 1. Tables + cursor indexes (one JSONB payload per record).
${ddl}

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

${triggers}

-- 3. Row Level Security.
${policies(mode)}

alter table public.sync_meta enable row level security;
drop policy if exists d7d_meta_read on public.sync_meta;
create policy d7d_meta_read on public.sync_meta for select using (true);
${
  mode === 'simple'
    ? `drop policy if exists d7d_meta_write on public.sync_meta;
create policy d7d_meta_write on public.sync_meta for all using (true) with check (true);
`
    : ''
}
-- 4. Schema-version marker (checked by d7d on every connect).
insert into public.sync_meta(key, value) values ('schema_version', '${CLOUD_SCHEMA_VERSION}')
  on conflict (key) do update set value = excluded.value;
`
}
