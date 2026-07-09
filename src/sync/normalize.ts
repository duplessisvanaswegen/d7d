import { bookmark, note, category, tag } from '@/features/importexport/schema'
import type { SyncTable } from './constants'

// Heal every pulled payload through the same Zod-with-defaults schemas the importer
// uses, so old-shape cloud rows self-correct on read (e.g. a note written before the
// `kind` field gains `kind: 'note'`). A row that fails validation is dropped, not
// applied — the caller skips + logs it rather than poisoning the batch (tech-spec §9).
const validators = { bookmarks: bookmark, notes: note, categories: category, tags: tag } as const

export function normalizeRow(table: SyncTable, payload: unknown): Record<string, unknown> | null {
  const res = validators[table].safeParse(payload)
  if (!res.success) return null
  const rec = res.data as Record<string, unknown>
  if (table === 'notes' && !rec.kind) rec.kind = 'note' // matches importer's normalizeNotes
  return rec
}
