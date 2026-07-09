import { db } from '@/db/db'
import { now } from '@/lib/id'
import { syncEnabled } from './config'
import type { SyncTable } from './constants'

// The outbox is the single choke-point through which every local mutation is
// recorded for later push. HARD INVARIANT (tech-spec §4): every db.* write appends
// an outbox row in the SAME Dexie transaction — so a write can never exist without
// its queued op, even across a crash. When sync is off the enqueue is a no-op, so
// the outbox stays empty for the default user (first-connect reconcile is additive
// and needs no pre-existing queue).

export interface OutboxRow {
  key: string // `${table}:${recordId}` — primary key ⇒ coalesces to one row per record
  table: SyncTable
  recordId: string
  op: 'put' | 'delete'
  /** True while a never-pushed local *create* (and its later local edits) sits here.
   * Lets create-then-delete cancel to nothing; reset once the row is pushed+removed. */
  created: boolean
  updatedAt: number // local ms, for offline ordering only (server restamps on push)
  tries: number
}

/** Pure coalescing rule (tech-spec §4): latest op wins per record; a local-only
 * create-then-delete cancels (returns null ⇒ remove the row). */
export function coalesce(
  existing: OutboxRow | undefined,
  next: { table: SyncTable; recordId: string; op: 'put' | 'delete'; created: boolean; updatedAt: number },
): OutboxRow | null {
  const key = `${next.table}:${next.recordId}`
  if (next.op === 'delete') {
    if (existing?.created) return null // never reached the server ⇒ no junk tombstone
    return { key, table: next.table, recordId: next.recordId, op: 'delete', created: false, updatedAt: next.updatedAt, tries: 0 }
  }
  // put: preserve an in-flight create flag across follow-up edits.
  const created = existing ? existing.created : next.created
  return { key, table: next.table, recordId: next.recordId, op: 'put', created, updatedAt: next.updatedAt, tries: 0 }
}

/** Append/coalesce one op. MUST be awaited inside a Dexie rw transaction that
 * already includes db.outbox (see `withOutbox`), or atomicity is lost. */
async function enqueue(table: SyncTable, recordId: string, op: 'put' | 'delete', created: boolean): Promise<void> {
  if (!syncEnabled()) return
  const key = `${table}:${recordId}`
  const existing = await db.outbox.get(key)
  const row = coalesce(existing, { table, recordId, op, created, updatedAt: now() })
  if (row) await db.outbox.put(row)
  else await db.outbox.delete(key)
}

export const enqueuePut = (table: SyncTable, recordId: string, isCreate = false): Promise<void> =>
  enqueue(table, recordId, 'put', isCreate)

export const enqueueDelete = (table: SyncTable, recordId: string): Promise<void> =>
  enqueue(table, recordId, 'delete', false)

// ── Reconciler-facing helpers ────────────────────────────────────────────────
export function listOutbox(): Promise<OutboxRow[]> {
  return db.outbox.toArray()
}
export function removeOutbox(keys: string[]): Promise<void> {
  return db.outbox.bulkDelete(keys).then(() => undefined)
}
export function outboxCount(): Promise<number> {
  return db.outbox.count()
}
