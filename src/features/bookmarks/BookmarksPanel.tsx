import { useLiveQuery } from 'dexie-react-hooks'
import { Bookmark as BookmarkIcon, ChevronDown, ChevronRight } from 'lucide-react'
import { db } from '@/db/db'
import { useUI } from '@/state/ui'
import { EmptyState } from '@/ui/EmptyState'
import { BookmarkRow } from './BookmarkRow'
import type { Bookmark, Category } from '@/types/models'
import styles from './BookmarksPanel.module.css'

export function BookmarksPanel() {
  const openAdd = useUI((s) => s.openAddBookmark)
  const bookmarks = useLiveQuery(() => db.bookmarks.orderBy('order').toArray(), [], [] as Bookmark[])
  const categories = useLiveQuery(
    () => db.categories.where('type').equals('bookmark').toArray(),
    [],
    [] as Category[],
  )

  const byCat = new Map<string, Bookmark[]>()
  for (const b of bookmarks) {
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
          <span className={styles.count}>{bookmarks.length}</span>
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
      ) : (
        <div className={styles.list}>
          {groups.map(({ cat, items }) => (
            <CategoryGroup key={cat.id} cat={cat} items={items} />
          ))}
        </div>
      )}
    </section>
  )
}

function CategoryGroup({ cat, items }: { cat: Category; items: Bookmark[] }) {
  const collapsed = useUI((s) => s.collapsedGroups.has(cat.id))
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
