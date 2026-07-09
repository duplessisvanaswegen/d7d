// Shared sync constants. Kept dependency-free so both the (eagerly-loaded) outbox
// and the (lazy-loaded) reconciler/client can import it without pulling supabase-js.

/** Version marker for the *cloud* schema (real columns only, not payload shape).
 * Bumped only when the SQL in `docs/sync-setup.sql` changes its real columns —
 * payload shape changes ride in JSONB and self-heal via the import normalize path. */
export const CLOUD_SCHEMA_VERSION = 1

/** The four synced tables — mirror the local Dexie stores one-to-one. */
export const SYNC_TABLES = ['bookmarks', 'notes', 'categories', 'tags'] as const
export type SyncTable = (typeof SYNC_TABLES)[number]
