import { db } from './db'
import { uid, now } from '@/lib/id'
import { normalizeUrl } from '@/lib/url'
import { UNCATEGORISED, UNCATEGORISED_NAME } from './init'
import type { Bookmark, Category, ID, ItemType } from '@/types/models'

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

/** Is this URL already saved? (duplicate-URL nudge in the add form.) */
export async function findBookmarkByUrl(url: string): Promise<Bookmark | undefined> {
  const normalized = normalizeUrl(url)
  return db.bookmarks.filter((b) => b.url === normalized).first()
}
