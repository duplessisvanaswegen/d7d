import { useLiveQuery } from 'dexie-react-hooks'
import { StickyNote, Plus } from 'lucide-react'
import { db } from '@/db/db'
import { useUI } from '@/state/ui'
import { EmptyState } from '@/ui/EmptyState'
import { NoteCard } from './NoteCard'
import type { Note, Category, Tag } from '@/types/models'
import styles from './NotesPanel.module.css'

export function NotesPanel() {
  const openAdd = useUI((s) => s.openAddNote)
  const notes = useLiveQuery(() => db.notes.toArray(), [], [] as Note[])
  const categories = useLiveQuery(() => db.categories.where('type').equals('note').toArray(), [], [] as Category[])
  const tags = useLiveQuery(() => db.tags.where('type').equals('note').toArray(), [], [] as Tag[])

  const catName = new Map(categories.map((c) => [c.id, c.reserved ? undefined : c.name]))
  const tagName = new Map(tags.map((t) => [t.id, t.name]))

  const sorted = [...notes].sort(
    (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || a.order - b.order,
  )

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.titleWrap}>
          <h2 className={styles.title}>Notes</h2>
          <span className={styles.count}>{notes.length}</span>
        </div>
        {notes.length > 0 && (
          <button className={styles.addBtn} onClick={openAdd}>
            <Plus size={15} />
            <span>Note</span>
          </button>
        )}
      </header>

      {notes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="No notes yet"
          subtitle="Jot quick sticky notes, colour-code them, and pin what matters."
          action="Write your first note"
          onAction={openAdd}
        />
      ) : (
        <div className={styles.grid}>
          {sorted.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              categoryName={catName.get(n.categoryId)}
              tagNames={n.tagIds.map((id) => tagName.get(id)).filter((x): x is string => !!x)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
