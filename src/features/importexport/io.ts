import { db } from '@/db/db'
import { initDb } from '@/db/init'
import { loadAppearance, applyAppearance, type Appearance } from '@/app/theme'
import { loadPrefs, useSettings } from '@/state/settings'
import { exportSchema, type ExportFile } from './schema'
import type { Note } from '@/types/models'

export const SCHEMA_VERSION = 1
const LAST_EXPORT_KEY = 'd7d.lastExport'

// ── Export ──────────────────────────────────────────────────
export async function buildExport(): Promise<ExportFile> {
  const [bookmarks, notes, categories, tags] = await Promise.all([
    db.bookmarks.toArray(),
    db.notes.toArray(),
    db.categories.toArray(),
    db.tags.toArray(),
  ])
  return {
    app: 'd7d',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    bookmarks,
    notes,
    categories,
    tags,
    settings: { appearance: loadAppearance(), prefs: loadPrefs() },
  }
}

export async function downloadExport(): Promise<void> {
  const data = await buildExport()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const d = new Date(data.exportedAt)
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const a = document.createElement('a')
  a.href = url
  a.download = `d7d-export-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
  localStorage.setItem(LAST_EXPORT_KEY, String(data.exportedAt))
}

export function lastExportedAt(): number | null {
  const v = localStorage.getItem(LAST_EXPORT_KEY)
  return v ? Number(v) : null
}

// ── Parse & validate ────────────────────────────────────────
export type ParseResult = { ok: true; data: ExportFile } | { ok: false; error: string }

export function parseImport(text: string): ParseResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file isn’t valid JSON.' }
  }
  const res = exportSchema.safeParse(json)
  if (!res.success) return { ok: false, error: 'This file isn’t a valid d7d export.' }
  if (res.data.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: `This export is from a newer version (v${res.data.schemaVersion}). Update d7d first.` }
  }
  return { ok: true, data: res.data }
}

// ── Diff ────────────────────────────────────────────────────
export interface DiffRow {
  sym: '+' | '~'
  label: string
  detail: string
}
export interface Diff {
  added: number
  changed: number
  localKept: number
  rows: DiffRow[]
}

type Rec = { id: string; updatedAt?: number }

function diffTable<T extends Rec>(
  incoming: T[],
  current: T[],
  label: (r: T) => string,
  kind: string,
  acc: { added: number; changed: number; rows: DiffRow[] },
  incomingIds: Set<string>,
) {
  const byId = new Map(current.map((r) => [r.id, r]))
  for (const r of incoming) {
    incomingIds.add(r.id)
    const cur = byId.get(r.id)
    if (!cur) {
      acc.added++
      if (acc.rows.length < 8) acc.rows.push({ sym: '+', label: label(r), detail: `new ${kind}` })
    } else if ((r.updatedAt ?? 0) !== (cur.updatedAt ?? 0)) {
      acc.changed++
      const older = (r.updatedAt ?? 0) < (cur.updatedAt ?? 0)
      if (acc.rows.length < 8)
        acc.rows.push({ sym: '~', label: label(r), detail: older ? `updated · yours is newer` : `updated ${kind}` })
    }
  }
}

export async function computeDiff(data: ExportFile): Promise<Diff> {
  const [cb, cn, cc, ct] = await Promise.all([
    db.bookmarks.toArray(),
    db.notes.toArray(),
    db.categories.toArray(),
    db.tags.toArray(),
  ])
  const acc = { added: 0, changed: 0, rows: [] as DiffRow[] }
  const incomingIds = new Set<string>()
  diffTable(data.bookmarks, cb, (b) => b.title, 'bookmark', acc, incomingIds)
  diffTable(data.notes, cn, (n) => n.title || n.body.slice(0, 24) || 'note', 'note', acc, incomingIds)
  diffTable(data.categories, cc, (c) => c.name, 'category', acc, incomingIds)
  diffTable(
    data.tags.map((t) => ({ ...t, updatedAt: t.createdAt })),
    ct.map((t) => ({ ...t, updatedAt: t.createdAt })),
    (t) => `#${t.name}`,
    'tag',
    acc,
    incomingIds,
  )
  const curIds = [...cb, ...cn, ...cc, ...ct].map((r) => r.id)
  const localKept = curIds.filter((id) => !incomingIds.has(id)).length
  return { added: acc.added, changed: acc.changed, localKept, rows: acc.rows }
}

// ── Apply ───────────────────────────────────────────────────
function restoreSettings(s: ExportFile['settings']) {
  if (!s) return
  applyAppearance(s.appearance as Appearance)
  useSettings.getState().hydrate(s.prefs)
}

// Pre-feature exports have no `kind` — default imported notes to 'note'.
function normalizeNotes(notes: ExportFile['notes']): Note[] {
  return notes.map((n) => ({ ...n, kind: n.kind ?? 'note' }))
}

export async function applyReplace(data: ExportFile): Promise<void> {
  await db.transaction('rw', db.bookmarks, db.notes, db.categories, db.tags, async () => {
    await Promise.all([db.bookmarks.clear(), db.notes.clear(), db.categories.clear(), db.tags.clear()])
    await db.bookmarks.bulkAdd(data.bookmarks)
    await db.notes.bulkAdd(normalizeNotes(data.notes))
    await db.categories.bulkAdd(data.categories)
    await db.tags.bulkAdd(data.tags)
  })
  await initDb() // ensure reserved categories exist even if the file predates them
  restoreSettings(data.settings)
}

async function amend<T extends Rec>(table: { get: (id: string) => Promise<T | undefined>; put: (v: T) => Promise<unknown> }, incoming: T[]) {
  for (const r of incoming) {
    const cur = await table.get(r.id)
    if (!cur || (r.updatedAt ?? 0) >= (cur.updatedAt ?? 0)) await table.put(r)
  }
}

export async function applyAmend(data: ExportFile): Promise<void> {
  await db.transaction('rw', db.bookmarks, db.notes, db.categories, db.tags, async () => {
    await amend(db.bookmarks, data.bookmarks)
    await amend(db.notes, normalizeNotes(data.notes))
    await amend(db.categories, data.categories)
    // tags: no updatedAt — add if missing, keep existing otherwise
    for (const t of data.tags) if (!(await db.tags.get(t.id))) await db.tags.add(t)
  })
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.bookmarks, db.notes, db.categories, db.tags, async () => {
    await Promise.all([db.bookmarks.clear(), db.notes.clear(), db.categories.clear(), db.tags.clear()])
  })
  await initDb()
}
