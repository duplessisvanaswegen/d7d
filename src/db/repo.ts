import { db } from './db'
import { uid, now } from '@/lib/id'
import { normalizeUrl } from '@/lib/url'
import { UNCATEGORISED, UNCATEGORISED_NAME } from './init'
import { enqueuePut, enqueueDelete } from '@/sync/outbox'
import type { Bookmark, Category, ID, ItemType, Note, NoteColor, NoteKind } from '@/types/models'

const norm = (s: string) => s.trim().toLowerCase()

// Every mutation below wraps its db write + outbox enqueue in ONE Dexie rw
// transaction (tech-spec §4). The enqueue no-ops when sync is off, so behaviour is
// identical for the default user; when sync is on, no write can escape the outbox.
const tableName = (type: ItemType) => (type === 'bookmark' ? 'bookmarks' : 'notes') as 'bookmarks' | 'notes'

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
  await db.transaction('rw', db.categories, db.outbox, async () => {
    await db.categories.add({ id, type, name: trimmed, order: count, createdAt: ts, updatedAt: ts })
    await enqueuePut('categories', id, true)
  })
  return id
}

/** Rename a category. Returns false on name collision or if reserved. */
export async function renameCategory(id: ID, name: string): Promise<boolean> {
  const cat = await db.categories.get(id)
  if (!cat || cat.reserved) return false
  const trimmed = name.trim()
  if (!trimmed) return false
  const existing = await findCategoryByName(cat.type, trimmed)
  if (existing && existing.id !== id) return false
  await db.transaction('rw', db.categories, db.outbox, async () => {
    await db.categories.update(id, { name: trimmed, updatedAt: now() })
    await enqueuePut('categories', id)
  })
  return true
}

/** Delete a category; reassign its items to Uncategorised, or delete them too. */
export async function deleteCategory(id: ID, deleteItems: boolean): Promise<void> {
  const cat = await db.categories.get(id)
  if (!cat || cat.reserved) return
  const table = cat.type === 'bookmark' ? db.bookmarks : db.notes
  const tbl = tableName(cat.type)
  const uncat = UNCATEGORISED[cat.type]
  const items = await table.where('categoryId').equals(id).toArray()
  await db.transaction('rw', table, db.categories, db.outbox, async () => {
    if (deleteItems) {
      await table.bulkDelete(items.map((i) => i.id))
      for (const it of items) await enqueueDelete(tbl, it.id)
    } else {
      for (const it of items) {
        await table.update(it.id, { categoryId: uncat, updatedAt: now() })
        await enqueuePut(tbl, it.id)
      }
    }
    await db.categories.delete(id)
    await enqueueDelete('categories', id)
  })
}

// ── Tags ────────────────────────────────────────────────────
export async function ensureTags(type: ItemType, names: string[]): Promise<ID[]> {
  const ids: ID[] = []
  await db.transaction('rw', db.tags, db.outbox, async () => {
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
        await enqueuePut('tags', id, true)
        byName.set(key, id)
      }
      ids.push(id)
    }
  })
  return [...new Set(ids)]
}

export async function renameTag(id: ID, name: string): Promise<boolean> {
  const tag = await db.tags.get(id)
  if (!tag) return false
  const trimmed = name.trim().replace(/^#/, '').trim()
  if (!trimmed) return false
  const existing = (await db.tags.where('type').equals(tag.type).toArray()).find(
    (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
  )
  if (existing && existing.id !== id) return false
  await db.transaction('rw', db.tags, db.outbox, async () => {
    await db.tags.update(id, { name: trimmed })
    await enqueuePut('tags', id)
  })
  return true
}

/** Delete a tag; removes it from every item that used it. */
export async function deleteTag(type: ItemType, id: ID): Promise<void> {
  const table = type === 'bookmark' ? db.bookmarks : db.notes
  const tbl = tableName(type)
  const items = await table.where('tagIds').equals(id).toArray()
  await db.transaction('rw', table, db.tags, db.outbox, async () => {
    for (const it of items) {
      await table.update(it.id, { tagIds: it.tagIds.filter((t) => t !== id), updatedAt: now() })
      await enqueuePut(tbl, it.id)
    }
    await db.tags.delete(id)
    await enqueueDelete('tags', id)
  })
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
    await db.transaction('rw', db.bookmarks, db.outbox, async () => {
      await db.bookmarks.update(editingId, { url, title, categoryId, tagIds, updatedAt: now() })
      await enqueuePut('bookmarks', editingId)
    })
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
    await db.transaction('rw', db.bookmarks, db.outbox, async () => {
      await db.bookmarks.add(bm)
      await enqueuePut('bookmarks', bm.id, true)
    })
  }
}

export async function deleteBookmark(id: ID): Promise<void> {
  await db.transaction('rw', db.bookmarks, db.outbox, async () => {
    await db.bookmarks.delete(id)
    await enqueueDelete('bookmarks', id)
  })
}

/** Re-add a bookmark after an undo-delete (restore of a possibly server-known row). */
export async function restoreBookmark(bookmark: Bookmark): Promise<void> {
  await db.transaction('rw', db.bookmarks, db.outbox, async () => {
    await db.bookmarks.add(bookmark)
    await enqueuePut('bookmarks', bookmark.id)
  })
}

/** Persist a new order for a set of ids (drag-and-drop): order = index. */
export async function reorderBookmarks(ids: ID[]): Promise<void> {
  await db.transaction('rw', db.bookmarks, db.outbox, async () => {
    for (let i = 0; i < ids.length; i++) {
      await db.bookmarks.update(ids[i], { order: i, updatedAt: now() })
      await enqueuePut('bookmarks', ids[i])
    }
  })
}

export async function reorderNotes(ids: ID[]): Promise<void> {
  await db.transaction('rw', db.notes, db.outbox, async () => {
    for (let i = 0; i < ids.length; i++) {
      await db.notes.update(ids[i], { order: i, updatedAt: now() })
      await enqueuePut('notes', ids[i])
    }
  })
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
  await db.transaction('rw', db.bookmarks, db.outbox, async () => {
    await db.bookmarks.update(bm.id, { order: other.order, updatedAt: now() })
    await db.bookmarks.update(other.id, { order: bm.order, updatedAt: now() })
    await enqueuePut('bookmarks', bm.id)
    await enqueuePut('bookmarks', other.id)
  })
}

/** Is this URL already saved? (duplicate-URL nudge in the add form.) */
export async function findBookmarkByUrl(url: string): Promise<Bookmark | undefined> {
  const normalized = normalizeUrl(url)
  return db.bookmarks.filter((b) => b.url === normalized).first()
}

// ── Notes ───────────────────────────────────────────────────
export interface NoteForm {
  kind?: NoteKind
  title: string
  body: string
  color: NoteColor
  categoryName: string
  tagNames: string[]
  pinned: boolean
  startsAt?: string
  endsAt?: string
  allDay?: boolean
}

async function nextNoteOrder(): Promise<number> {
  const last = await db.notes.orderBy('order').last()
  return (last?.order ?? 0) + 1
}

/** Kind-save hygiene: keep only the schedule fields the chosen kind uses. */
function scheduleFor(kind: NoteKind, form: NoteForm): Pick<Note, 'startsAt' | 'endsAt' | 'allDay'> {
  const start = form.startsAt?.trim() || undefined
  const end = form.endsAt?.trim() || undefined
  if (kind === 'task') return { startsAt: start, endsAt: undefined, allDay: start ? !!form.allDay : undefined }
  if (kind === 'event') return { startsAt: start, endsAt: start && end ? end : undefined, allDay: !!form.allDay }
  return { startsAt: undefined, endsAt: undefined, allDay: undefined } // note: no schedule
}

export async function saveNoteForm(form: NoteForm, editingId?: ID | null): Promise<void> {
  const kind: NoteKind = form.kind ?? 'note'
  const categoryId = await ensureCategory('note', form.categoryName)
  const tagIds = await ensureTags('note', form.tagNames)
  const title = form.title.trim() || undefined
  const body = form.body.trim()
  const schedule = scheduleFor(kind, form)

  if (editingId) {
    const existing = await db.notes.get(editingId)
    await db.transaction('rw', db.notes, db.outbox, async () => {
      await db.notes.update(editingId, {
        kind,
        title,
        body,
        color: form.color,
        categoryId,
        tagIds,
        pinned: form.pinned,
        ...schedule,
        done: kind === 'task' ? (existing?.done ?? false) : undefined,
        completedAt: kind === 'task' ? existing?.completedAt : undefined,
        updatedAt: now(),
      })
      await enqueuePut('notes', editingId)
    })
  } else {
    const ts = now()
    const note: Note = {
      id: uid(),
      kind,
      title,
      body,
      color: form.color,
      categoryId,
      tagIds,
      pinned: form.pinned,
      ...schedule,
      done: kind === 'task' ? false : undefined,
      order: await nextNoteOrder(),
      createdAt: ts,
      updatedAt: ts,
    }
    await db.transaction('rw', db.notes, db.outbox, async () => {
      await db.notes.add(note)
      await enqueuePut('notes', note.id, true)
    })
  }
}

/** Toggle a task's completion (no-op for notes/events). */
export async function toggleNoteDone(id: ID): Promise<void> {
  const n = await db.notes.get(id)
  if (!n || n.kind !== 'task') return
  const done = !n.done
  await db.transaction('rw', db.notes, db.outbox, async () => {
    await db.notes.update(id, { done, completedAt: done ? now() : undefined, updatedAt: now() })
    await enqueuePut('notes', id)
  })
}

export async function deleteNote(id: ID): Promise<void> {
  await db.transaction('rw', db.notes, db.outbox, async () => {
    await db.notes.delete(id)
    await enqueueDelete('notes', id)
  })
}

/** Re-add a note after an undo-delete (restore of a possibly server-known row). */
export async function restoreNote(note: Note): Promise<void> {
  await db.transaction('rw', db.notes, db.outbox, async () => {
    await db.notes.add(note)
    await enqueuePut('notes', note.id)
  })
}

export async function toggleNotePin(id: ID): Promise<void> {
  const n = await db.notes.get(id)
  if (!n) return
  await db.transaction('rw', db.notes, db.outbox, async () => {
    await db.notes.update(id, { pinned: !n.pinned, updatedAt: now() })
    await enqueuePut('notes', id)
  })
}

export async function setNoteColor(id: ID, color: NoteColor): Promise<void> {
  await db.transaction('rw', db.notes, db.outbox, async () => {
    await db.notes.update(id, { color, updatedAt: now() })
    await enqueuePut('notes', id)
  })
}

export async function duplicateNote(id: ID): Promise<void> {
  const n = await db.notes.get(id)
  if (!n) return
  const ts = now()
  const copy: Note = { ...n, id: uid(), order: await nextNoteOrder(), pinned: false, createdAt: ts, updatedAt: ts }
  await db.transaction('rw', db.notes, db.outbox, async () => {
    await db.notes.add(copy)
    await enqueuePut('notes', copy.id, true)
  })
}

// ── Bulk actions ────────────────────────────────────────────
export async function bulkDelete(type: ItemType, ids: ID[]): Promise<void> {
  const table = type === 'bookmark' ? db.bookmarks : db.notes
  const tbl = tableName(type)
  await db.transaction('rw', table, db.outbox, async () => {
    await table.bulkDelete(ids)
    for (const id of ids) await enqueueDelete(tbl, id)
  })
}

export async function bulkSetCategory(type: ItemType, ids: ID[], categoryName: string): Promise<void> {
  const categoryId = await ensureCategory(type, categoryName)
  const table = type === 'bookmark' ? db.bookmarks : db.notes
  const tbl = tableName(type)
  await db.transaction('rw', table, db.outbox, async () => {
    for (const id of ids) {
      await table.update(id, { categoryId, updatedAt: now() })
      await enqueuePut(tbl, id)
    }
  })
}

export async function bulkAddTags(type: ItemType, ids: ID[], tagNames: string[]): Promise<void> {
  const tagIds = await ensureTags(type, tagNames)
  if (!tagIds.length) return
  const table = type === 'bookmark' ? db.bookmarks : db.notes
  const tbl = tableName(type)
  await db.transaction('rw', table, db.outbox, async () => {
    for (const id of ids) {
      const item = await table.get(id)
      if (!item) continue
      const merged = [...new Set([...item.tagIds, ...tagIds])]
      await table.update(id, { tagIds: merged, updatedAt: now() })
      await enqueuePut(tbl, id)
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
  await db.transaction('rw', db.notes, db.outbox, async () => {
    await db.notes.update(note.id, { order: other.order, updatedAt: now() })
    await db.notes.update(other.id, { order: note.order, updatedAt: now() })
    await enqueuePut('notes', note.id)
    await enqueuePut('notes', other.id)
  })
}
