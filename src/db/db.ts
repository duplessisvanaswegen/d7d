import Dexie, { type Table } from 'dexie'
import type { Bookmark, Note, Category, Tag } from '@/types/models'
import type { OutboxRow } from '@/sync/outbox'

export class D7dDB extends Dexie {
  bookmarks!: Table<Bookmark, string>
  notes!: Table<Note, string>
  categories!: Table<Category, string>
  tags!: Table<Tag, string>
  outbox!: Table<OutboxRow, string>

  constructor() {
    super('d7d')
    // v1 schema (tech-spec §4). `pinned` is not indexed (IndexedDB can't index booleans) — sorted in memory.
    this.version(1).stores({
      bookmarks: 'id, categoryId, order, updatedAt, *tagIds',
      notes: 'id, categoryId, order, updatedAt, *tagIds',
      categories: 'id, [type+name], type, order',
      tags: 'id, [type+name], type',
    })

    // v2: notes gain kind/schedule (Notes → Tasks & Events). Index kind + startsAt for
    // filtering/sorting and the future calendar. Existing notes become kind: 'note'.
    this.version(2)
      .stores({
        notes: 'id, categoryId, order, updatedAt, kind, startsAt, *tagIds',
      })
      .upgrade((tx) =>
        tx
          .table('notes')
          .toCollection()
          .modify((n) => {
            if (!n.kind) n.kind = 'note'
          }),
      )

    // v3: BYOC sync. `outbox` records local mutations awaiting push, keyed by
    // `${table}:${recordId}` so ops coalesce to one row per record. Additive —
    // no data touched; the app is unchanged for the default (sync-off) user.
    this.version(3).stores({
      outbox: 'key, table',
    })
  }
}

export const db = new D7dDB()
