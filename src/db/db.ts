import Dexie, { type Table } from 'dexie'
import type { Bookmark, Note, Category, Tag } from '@/types/models'

export class D7dDB extends Dexie {
  bookmarks!: Table<Bookmark, string>
  notes!: Table<Note, string>
  categories!: Table<Category, string>
  tags!: Table<Tag, string>

  constructor() {
    super('d7d')
    // v1 schema (tech-spec §4). `pinned` is not indexed (IndexedDB can't index booleans) — sorted in memory.
    this.version(1).stores({
      bookmarks: 'id, categoryId, order, updatedAt, *tagIds',
      notes: 'id, categoryId, order, updatedAt, *tagIds',
      categories: 'id, [type+name], type, order',
      tags: 'id, [type+name], type',
    })
  }
}

export const db = new D7dDB()
