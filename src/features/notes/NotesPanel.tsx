import { useLiveQuery } from 'dexie-react-hooks'
import { StickyNote, Plus, SearchX, CircleCheck } from 'lucide-react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db } from '@/db/db'
import { useUI } from '@/state/ui'
import { EmptyState } from '@/ui/EmptyState'
import { NoteCard } from './NoteCard'
import { parseQuery, isBlank } from '@/features/search/parser'
import { itemMatches, type NameSets } from '@/features/search/match'
import { reorderNotes } from '@/db/repo'
import { useDndSensors } from '@/lib/dnd'
import type { Note, Category, Tag } from '@/types/models'
import styles from './NotesPanel.module.css'

interface NoteWithNames {
  note: Note
  categoryName?: string
  tagNames: string[]
}

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

  const sensors = useDndSensors()
  const sortable = !searching && !selecting
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = sorted.map((x) => x.note.id)
    const oldIndex = ids.indexOf(active.id as string)
    const newIndex = ids.indexOf(over.id as string)
    if (oldIndex < 0 || newIndex < 0) return
    void reorderNotes(arrayMove(ids, oldIndex, newIndex))
  }

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
        <div className={styles.gridWrap}>
          {sortable ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={sorted.map((x) => x.note.id)} strategy={rectSortingStrategy}>
                <div className={styles.grid}>
                  {sorted.map((x) => (
                    <SortableNoteCard key={x.note.id} item={x} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className={styles.grid}>
              {sorted.map(({ note, categoryName, tagNames }) => (
                <NoteCard key={note.id} note={note} categoryName={categoryName} tagNames={tagNames} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function SortableNoteCard({ item }: { item: NoteWithNames }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.note.id })
  const style = {
    // Translate only — never scale (cards vary in size, so CSS.Transform would distort them).
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    zIndex: isDragging ? 1 : undefined,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <NoteCard note={item.note} categoryName={item.categoryName} tagNames={item.tagNames} handleProps={{ ...attributes, ...listeners }} />
    </div>
  )
}
