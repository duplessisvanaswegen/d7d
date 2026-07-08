import { useLiveQuery } from 'dexie-react-hooks'
import { Bookmark as BookmarkIcon, ChevronDown, ChevronRight, SearchX } from 'lucide-react'
import { db } from '@/db/db'
import { useUI } from '@/state/ui'
import { EmptyState } from '@/ui/EmptyState'
import { BookmarkRow } from './BookmarkRow'
import { parseQuery, isBlank } from '@/features/search/parser'
import { itemMatches, type NameSets } from '@/features/search/match'
import type { Bookmark, Category, Tag } from '@/types/models'
import styles from './BookmarksPanel.module.css'

export function BookmarksPanel() {
  const openAdd = useUI((s) => s.openAddBookmark)
  const query = useUI((s) => s.query)
  const bookmarks = useLiveQuery(() => db.bookmarks.orderBy('order').toArray(), [], [] as Bookmark[])
  const categories = useLiveQuery(
    () => db.categories.where('type').equals('bookmark').toArray(),
    [],
    [] as Category[],
  )
  const tags = useLiveQuery(() => db.tags.where('type').equals('bookmark').toArray(), [], [] as Tag[])

  const parsed = parseQuery(query)
  const searching = !isBlank(query) || !!parsed.active
  const catName = new Map(categories.map((c) => [c.id, c.reserved ? undefined : c.name]))
  const tagName = new Map(tags.map((t) => [t.id, t.name]))
  const names: NameSets = {
    categories: new Set(categories.filter((c) => !c.reserved).map((c) => c.name.toLowerCase())),
    tags: new Set(tags.map((t) => t.name.toLowerCase())),
  }

  const filtered = bookmarks.filter((b) => {
    const categoryName = catName.get(b.categoryId)
    const tagNames = b.tagIds.map((id) => tagName.get(id)).filter((x): x is string => !!x)
    const text = [b.title, b.url, categoryName, ...tagNames].filter(Boolean).join(' ')
    return itemMatches(parsed, { categoryName, tagNames, text }, names)
  })

  const byCat = new Map<string, Bookmark[]>()
  for (const b of filtered) {
    const arr = byCat.get(b.categoryId) ?? []
    arr.push(b)
    byCat.set(b.categoryId, arr)
  }
  const groups = [...categories]
    .sort((a, b) => a.order - b.order)
    .filter((c) => byCat.has(c.id))
    .map((cat) => ({ cat, items: byCat.get(cat.id)! }))

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.titleWrap}>
          <h2 className={styles.title}>Bookmarks</h2>
          <span className={styles.count}>{searching ? filtered.length : bookmarks.length}</span>
        </div>
      </header>

      {bookmarks.length === 0 ? (
        <EmptyState
          icon={BookmarkIcon}
          title="No bookmarks yet"
          subtitle="Save your favourite sites and organise them by category and tags."
          action="Add your first bookmark"
          onAction={openAdd}
        />
      ) : filtered.length === 0 ? (
        <div className={styles.noMatch}>
          <SearchX size={22} />
          <span>No bookmarks match your search.</span>
        </div>
      ) : (
        <div className={styles.list}>
          {groups.map(({ cat, items }) => (
            <CategoryGroup key={cat.id} cat={cat} items={items} forceOpen={searching} />
          ))}
        </div>
      )}
    </section>
  )
}

function CategoryGroup({ cat, items, forceOpen }: { cat: Category; items: Bookmark[]; forceOpen: boolean }) {
  const collapsed = useUI((s) => s.collapsedGroups.has(cat.id)) && !forceOpen
  const toggle = useUI((s) => s.toggleGroup)
  return (
    <div className={styles.group}>
      <button className={styles.groupHead} onClick={() => toggle(cat.id)}>
        {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        <span className={styles.groupName}>{cat.name.toUpperCase()}</span>
        <span className={styles.groupCount}>{items.length}</span>
      </button>
      {!collapsed && items.map((b) => <BookmarkRow key={b.id} bookmark={b} />)}
    </div>
  )
}
