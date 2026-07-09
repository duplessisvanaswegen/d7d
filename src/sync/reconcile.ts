import type { SupabaseClient } from '@supabase/supabase-js'
import { db } from '@/db/db'
import { UNCATEGORISED } from '@/db/init'
import { getClient } from './connect'
import { useSync, loadCursors, saveCursor, type Cursor, type SyncStatus, type Summary } from './config'
import { enqueuePut, listOutbox, removeOutbox, type OutboxRow } from './outbox'
import { normalizeRow } from './normalize'
import { SYNC_TABLES, type SyncTable } from './constants'

// The core reconciler: push local outbox up, then pull remote changes down, LWW by
// the server's updated_at. Single-flight with a trailing re-run (tech-spec §5).

const PAGE = 500
const RESERVED_CAT_IDS = new Set(Object.values(UNCATEGORISED))

interface CloudRow {
  id: string
  deleted: boolean
  updated_at: string // ISO timestamptz — server-authoritative LWW key
  payload: unknown
}

// ── Push ──────────────────────────────────────────────────────────────────────
// Drain the outbox in one upsert per (table, op). Each upsert `.select()`s the
// server updated_at, which we stamp back onto the local record so local == server
// (no echo re-apply on the following pull). Outbox rows are cleared only for the
// statements the server acked (partial-batch safe).
async function push(client: SupabaseClient): Promise<number> {
  const rows = await listOutbox()
  if (!rows.length) return 0

  const groups = new Map<string, OutboxRow[]>()
  for (const r of rows) {
    const gk = `${r.table}:${r.op}`
    const list = groups.get(gk) ?? []
    list.push(r)
    groups.set(gk, list)
  }

  let acked = 0
  for (const [gk, ops] of groups) {
    const table = gk.slice(0, gk.lastIndexOf(':')) as SyncTable
    const op = gk.slice(gk.lastIndexOf(':') + 1) as 'put' | 'delete'

    if (op === 'put') {
      const recs = await Promise.all(ops.map((o) => db.table(table).get(o.recordId)))
      const present: OutboxRow[] = []
      const gone: OutboxRow[] = []
      const payloadRows: { id: string; deleted: boolean; payload: unknown }[] = []
      ops.forEach((o, i) => {
        const rec = recs[i]
        if (rec) {
          present.push(o)
          payloadRows.push({ id: o.recordId, deleted: false, payload: rec })
        } else {
          gone.push(o) // record vanished after enqueue; drop the stale op
        }
      })
      if (payloadRows.length) {
        const { data, error } = await client.from(table).upsert(payloadRows, { onConflict: 'id' }).select('id, updated_at')
        if (error) throw error
        const stamp = new Map((data as { id: string; updated_at: string }[]).map((d) => [d.id, Date.parse(d.updated_at)]))
        for (const o of present) {
          const ms = stamp.get(o.recordId)
          if (ms) await db.table(table).update(o.recordId, { updatedAt: ms }) // raw: no re-enqueue
        }
        acked += present.length
      }
      await removeOutbox([...present.map((o) => o.key), ...gone.map((o) => o.key)])
    } else {
      // delete → tombstone (deleted=true, bumped updated_at). payload is minimal.
      const tomb = ops.map((o) => ({ id: o.recordId, deleted: true, payload: { id: o.recordId } }))
      const { error } = await client.from(table).upsert(tomb, { onConflict: 'id' }).select('id')
      if (error) throw error
      await removeOutbox(ops.map((o) => o.key))
      acked += ops.length
    }
  }
  return acked
}

// ── Pull ──────────────────────────────────────────────────────────────────────
// Compound (updated_at, id) keyset — a bare updated_at cursor would skip/loop over
// rows that share one now() from a bulk write (tech-spec §5). Each row is healed
// through the import normalize path and applied by LWW in its own tx.
async function applyRow(table: SyncTable, row: CloudRow): Promise<boolean> {
  const t = db.table(table)
  const local = await t.get(row.id)
  const serverMs = Date.parse(row.updated_at)
  const localMs = Number(local?.updatedAt ?? 0)

  if (row.deleted) {
    if (local && serverMs >= localMs) {
      await t.delete(row.id)
      return true
    }
    return false
  }
  if (!local || serverMs > localMs) {
    const rec = normalizeRow(table, row.payload)
    if (!rec) {
      console.warn('[sync] skipped invalid row', table, row.id)
      return false
    }
    await t.put({ ...rec, id: row.id, updatedAt: serverMs })
    return true
  }
  return false
}

async function pullTable(client: SupabaseClient, table: SyncTable): Promise<number> {
  let cursor: Cursor | null = loadCursors()[table] ?? null
  let applied = 0
  for (;;) {
    let q = client
      .from(table)
      .select('id, deleted, updated_at, payload')
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(PAGE)
    if (cursor) {
      q = q.or(`updated_at.gt.${cursor.ts},and(updated_at.eq.${cursor.ts},id.gt.${cursor.id})`)
    }
    const { data, error } = await q
    if (error) throw error
    const rows = (data ?? []) as CloudRow[]
    if (!rows.length) break

    for (const row of rows) {
      // Apply per-row in its own tx (a bad row aborts itself, not the DB).
      if (await applyRow(table, row)) applied++
      cursor = { ts: row.updated_at, id: row.id }
    }
    if (cursor) saveCursor(table, cursor) // resumable across a crash
    if (rows.length < PAGE) break
  }
  return applied
}

// ── First-connect bootstrap (additive union-merge) ────────────────────────────
// Enqueue every local (non-reserved) record as a put so first connect pushes all
// existing local data up; the subsequent pull brings the cloud down. Additive only —
// no deletes are generated, so nothing is removed on first connect.
async function bootstrap(): Promise<void> {
  const [bm, nt, ct, tg] = await Promise.all([
    db.bookmarks.toArray(),
    db.notes.toArray(),
    db.categories.toArray(),
    db.tags.toArray(),
  ])
  await db.transaction('rw', db.bookmarks, db.notes, db.categories, db.tags, db.outbox, async () => {
    for (const r of bm) await enqueuePut('bookmarks', r.id, true)
    for (const r of nt) await enqueuePut('notes', r.id, true)
    for (const r of ct) if (!RESERVED_CAT_IDS.has(r.id)) await enqueuePut('categories', r.id, true)
    for (const r of tg) await enqueuePut('tags', r.id, true)
  })
}

async function runOnce(): Promise<Summary> {
  const client = await getClient()
  if (!client) return { pushed: 0, pulled: 0 }

  if (!useSync.getState().config.bootstrapped) {
    await bootstrap()
    useSync.getState().setConfig({ bootstrapped: true })
  }

  const pushed = await push(client)
  let pulled = 0
  for (const t of SYNC_TABLES) pulled += await pullTable(client, t)
  return { pushed, pulled }
}

// ── Single-flight orchestration ───────────────────────────────────────────────
let running: Promise<Summary> | null = null
let dirty = false

function classify(e: unknown): [SyncStatus, string] {
  const msg = e instanceof Error ? e.message : String(e)
  if (/jwt|token|not authenticated|unauthorized|401|403/i.test(msg)) {
    return ['signed-out', 'Sync session expired — re-enter your password to resume.']
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return ['offline', 'Offline — changes are queued and will sync when you reconnect.']
  }
  if (/network|fetch|failed to fetch|timeout|econn|dns/i.test(msg)) {
    return ['offline', 'Could not reach Supabase — will retry.']
  }
  return ['error', msg]
}

/** Run a reconcile. If one is already in flight, mark it dirty so it re-runs once
 * more when it finishes (never drops a mutation that landed mid-cycle). */
export function reconcile(): Promise<Summary> {
  if (running) {
    dirty = true
    return running
  }
  const { setStatus, setLastSyncAt, setSummary } = useSync.getState()
  running = (async () => {
    let summary: Summary = { pushed: 0, pulled: 0 }
    try {
      setStatus('syncing')
      do {
        dirty = false
        summary = await runOnce()
      } while (dirty)
      setLastSyncAt(Date.now())
      setSummary(summary)
      setStatus('idle')
    } catch (e) {
      const [status, message] = classify(e)
      setStatus(status, message)
      console.warn('[sync] reconcile failed:', e)
    } finally {
      running = null
    }
    return summary
  })()
  return running
}

/** Manual "Sync now" entry point. */
export const syncNow = reconcile
