import { db } from './db'
import { uid, now } from '@/lib/id'
import { normalizeUrl } from '@/lib/url'
import { UNCATEGORISED, UNCATEGORISED_NAME } from './init'
import type { Bookmark, Category, ID, ItemType, Note, NoteColor } from '@/types/models'

const norm = (s: string) => s.trim().toLowerCase()

// ── Categories ──────────────────────────────────────────────
export async function findCategoryByName(type: ItemType, name: string): Promise<Category | undefined> {
  const lower = norm(name)
  const all = await db.categories.where('type').equals(type).toArray()
  return all.find((c) => c.name.toLowerCase() === lower)
}

/** Resolve a category name to an id, creating it if new. Empty/"Uncategorised" → the reserved row. */
export async function ensureCategory(type: ItemType, name: string): Promise<ID> {
  const trimmed = name.trim()
  if (!trimmed || norm(trimmed) === norm(UNCATEGORISED_NAME)) return UNCATEGORISED[type]
  const found = await findCategoryByName(type, trimmed)
  if (found) return found.id
  const count = await db.categories.where('type').equals(type).count()
  const id = uid()
  const ts = now()
  await db.categories.add({ id, type, name: trimmed, order: count, createdAt: ts, updatedAt: ts })
  return id
}

// ── Tags ────────────────────────────────────────────────────
export async function ensureTags(type: ItemType, names: string[]): Promise<ID[]> {
  const ids: ID[] = []
  await db.transaction('rw', db.tags, async () => {
    const existing = await db.tags.where('type').equals(type).toArray()
    const byName = new Map(existing.map((t) => [t.name.toLowerCase(), t.id]))
    for (const raw of names) {
      const name = raw.trim().replace(/^#/, '').trim()
      if (!name) continue
      const key = name.toLowerCase()
      let id = byName.get(key)
      if (!id) {
        id = uid()
        await db.tags.add({ id, type, name, createdAt: now() })
        byName.set(key, id)
      }
      ids.push(id)
    }
  })
  return [...new Set(ids)]
}

// ── Bookmarks ───────────────────────────────────────────────
export interface BookmarkForm {
  url: string
  title: string
  categoryName: string
  tagNames: string[]
}

async function nextBookmarkOrder(): Promise<number> {
  const last = await db.bookmarks.orderBy('order').last()
  return (last?.order ?? 0) + 1
}

/** Create or update a bookmark from the modal form, resolving category + tags. */
export async function saveBookmarkForm(form: BookmarkForm, editingId?: ID | null): Promise<void> {
  const categoryId = await ensureCategory('bookmark', form.categoryName)
  const tagIds = await ensureTags('bookmark', form.tagNames)
  const url = normalizeUrl(form.url)
  const title = form.title.trim() || url
  if (editingId) {
    await db.bookmarks.update(editingId, { url, title, categoryId, tagIds, updatedAt: now() })
  } else {
    const ts = now()
    const bm: Bookmark = {
      id: uid(),
      title,
      url,
      categoryId,
      tagIds,
      order: await nextBookmarkOrder(),
      createdAt: ts,
      updatedAt: ts,
    }
    await db.bookmarks.add(bm)
  }
}

export async function deleteBookmark(id: ID): Promise<void> {
  await db.bookmarks.delete(id)
}

/** Swap a bookmark with its neighbour (same category) in the sort order. */
export async function moveBookmark(id: ID, dir: -1 | 1): Promise<void> {
  const bm = await db.bookmarks.get(id)
  if (!bm) return
  const siblings = (await db.bookmarks.where('categoryId').equals(bm.categoryId).toArray()).sort(
    (a, b) => a.order - b.order,
  )
  const i = siblings.findIndex((s) => s.id === id)
  const other = siblings[i + dir]
  if (!other) return
  await db.bookmarks.update(bm.id, { order: other.order, updatedAt: now() })
  await db.bookmarks.update(other.id, { order: bm.order, updatedAt: now() })
}

/** Is this URL already saved? (duplicate-URL nudge in the add form.) */
export async function findBookmarkByUrl(url: string): Promise<Bookmark | undefined> {
  const normalized = normalizeUrl(url)
  return db.bookmarks.filter((b) => b.url === normalized).first()
}

// ── Notes ───────────────────────────────────────────────────
export interface NoteForm {
  title: string
  body: string
  color: NoteColor
  categoryName: string
  tagNames: string[]
  pinned: boolean
}

async function nextNoteOrder(): Promise<number> {
  const last = await db.notes.orderBy('order').last()
  return (last?.order ?? 0) + 1
}

export async function saveNoteForm(form: NoteForm, editingId?: ID | null): Promise<void> {
  const categoryId = await ensureCategory('note', form.categoryName)
  const tagIds = await ensureTags('note', form.tagNames)
  const title = form.title.trim() || undefined
  const body = form.body.trim()
  if (editingId) {
    await db.notes.update(editingId, {
      title,
      body,
      color: form.color,
      categoryId,
      tagIds,
      pinned: form.pinned,
      updatedAt: now(),
    })
  } else {
    const ts = now()
    const note: Note = {
      id: uid(),
      title,
      body,
      color: form.color,
      categoryId,
      tagIds,
      pinned: form.pinned,
      order: await nextNoteOrder(),
      createdAt: ts,
      updatedAt: ts,
    }
    await db.notes.add(note)
  }
}

export async function deleteNote(id: ID): Promise<void> {
  await db.notes.delete(id)
}

export async function toggleNotePin(id: ID): Promise<void> {
  const n = await db.notes.get(id)
  if (n) await db.notes.update(id, { pinned: !n.pinned, updatedAt: now() })
}

export async function duplicateNote(id: ID): Promise<void> {
  const n = await db.notes.get(id)
  if (!n) return
  const ts = now()
  await db.notes.add({ ...n, id: uid(), order: await nextNoteOrder(), pinned: false, createdAt: ts, updatedAt: ts })
}

// ── Bulk actions ────────────────────────────────────────────
export async function bulkDelete(type: ItemType, ids: ID[]): Promise<void> {
  const table = type === 'bookmark' ? db.bookmarks : db.notes
  await table.bulkDelete(ids)
}

export async function bulkSetCategory(type: ItemType, ids: ID[], categoryName: string): Promise<void> {
  const categoryId = await ensureCategory(type, categoryName)
  const table = type === 'bookmark' ? db.bookmarks : db.notes
  await db.transaction('rw', table, async () => {
    for (const id of ids) await table.update(id, { categoryId, updatedAt: now() })
  })
}

export async function bulkAddTags(type: ItemType, ids: ID[], tagNames: string[]): Promise<void> {
  const tagIds = await ensureTags(type, tagNames)
  if (!tagIds.length) return
  const table = type === 'bookmark' ? db.bookmarks : db.notes
  await db.transaction('rw', table, async () => {
    for (const id of ids) {
      const item = await table.get(id)
      if (!item) continue
      const merged = [...new Set([...item.tagIds, ...tagIds])]
      await table.update(id, { tagIds: merged, updatedAt: now() })
    }
  })
}

/** Swap a note with its neighbour within the same pinned group. */
export async function moveNote(id: ID, dir: -1 | 1): Promise<void> {
  const note = await db.notes.get(id)
  if (!note) return
  const group = (await db.notes.toArray()).filter((n) => n.pinned === note.pinned).sort((a, b) => a.order - b.order)
  const i = group.findIndex((n) => n.id === id)
  const other = group[i + dir]
  if (!other) return
  await db.notes.update(note.id, { order: other.order, updatedAt: now() })
  await db.notes.update(other.id, { order: note.order, updatedAt: now() })
}
