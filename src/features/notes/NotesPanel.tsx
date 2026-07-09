import { useLiveQuery } from 'dexie-react-hooks'
import { StickyNote, Plus, SearchX, CircleCheck } from 'lucide-react'
import { db } from '@/db/db'
import { useUI } from '@/state/ui'
import { EmptyState } from '@/ui/EmptyState'
import { NoteCard } from './NoteCard'
import { parseQuery, isBlank } from '@/features/search/parser'
import { itemMatches, type NameSets } from '@/features/search/match'
import type { Note, Category, Tag } from '@/types/models'
import styles from './NotesPanel.module.css'

export function NotesPanel() {
  const openAdd = useUI((s) => s.openAddNote)
  const query = useUI((s) => s.query)
  const enterSelect = useUI((s) => s.enterSelect)
  const clearSelect = useUI((s) => s.clearSelect)
  const selecting = useUI((s) => s.selection.mode === 'note')
  const notes = useLiveQuery(() => db.notes.toArray(), [], [] as Note[])
  const categories = useLiveQuery(() => db.categories.where('type').equals('note').toArray(), [], [] as Category[])
  const tags = useLiveQuery(() => db.tags.where('type').equals('note').toArray(), [], [] as Tag[])

  const parsed = parseQuery(query)
  const searching = !isBlank(query) || !!parsed.active
  const catName = new Map(categories.map((c) => [c.id, c.reserved ? undefined : c.name]))
  const tagName = new Map(tags.map((t) => [t.id, t.name]))
  const names: NameSets = {
    categories: new Set(categories.filter((c) => !c.reserved).map((c) => c.name.toLowerCase())),
    tags: new Set(tags.map((t) => t.name.toLowerCase())),
  }

  const withNames = notes.map((n) => {
    const categoryName = catName.get(n.categoryId)
    const tagNames = n.tagIds.map((id) => tagName.get(id)).filter((x): x is string => !!x)
    return { note: n, categoryName, tagNames }
  })
  const filtered = withNames.filter(({ note, categoryName, tagNames }) => {
    const text = [note.title, note.body, categoryName, ...tagNames].filter(Boolean).join(' ')
    return itemMatches(parsed, { categoryName, tagNames, text }, names)
  })
  const sorted = [...filtered].sort(
    (a, b) => (b.note.pinned ? 1 : 0) - (a.note.pinned ? 1 : 0) || a.note.order - b.note.order,
  )

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.titleWrap}>
          <h2 className={styles.title}>Notes</h2>
          <span className={styles.count}>{searching ? filtered.length : notes.length}</span>
        </div>
        {notes.length > 0 && (
          <div className={styles.actions}>
            <button className={styles.addBtn} onClick={() => (selecting ? clearSelect() : enterSelect('note'))}>
              <CircleCheck size={15} />
              <span>{selecting ? 'Done' : 'Select'}</span>
            </button>
            <button className={styles.addBtn} onClick={openAdd}>
              <Plus size={15} />
              <span>Note</span>
            </button>
          </div>
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
      ) : filtered.length === 0 ? (
        <div className={styles.noMatch}>
          <SearchX size={22} />
          <span>No notes match your search.</span>
        </div>
      ) : (
        <div className={styles.grid}>
          {sorted.map(({ note, categoryName, tagNames }) => (
            <NoteCard key={note.id} note={note} categoryName={categoryName} tagNames={tagNames} />
          ))}
        </div>
      )}
    </section>
  )
}
