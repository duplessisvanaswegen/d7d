import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { StickyNote, Plus, SearchX, CircleCheck, ListTodo, CalendarDays, Eye, EyeOff } from 'lucide-react'
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
import type { Note, NoteKind, Category, Tag } from '@/types/models'
import styles from './NotesPanel.module.css'

interface NoteWithNames {
  note: Note
  categoryName?: string
  tagNames: string[]
}

type KindFilter = 'all' | NoteKind

const TABS: { key: KindFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'note', label: 'Notes' },
  { key: 'task', label: 'Tasks' },
  { key: 'event', label: 'Events' },
]

const EMPTY_KIND: Record<Exclude<KindFilter, 'all'>, { icon: typeof StickyNote; noun: string }> = {
  note: { icon: StickyNote, noun: 'notes' },
  task: { icon: ListTodo, noun: 'tasks' },
  event: { icon: CalendarDays, noun: 'events' },
}

const kindOf = (n: Note): NoteKind => n.kind ?? 'note'
const isDoneTask = (n: Note) => n.kind === 'task' && !!n.done

export function NotesPanel() {
  const openAdd = useUI((s) => s.openAddNote)
  const query = useUI((s) => s.query)
  const enterSelect = useUI((s) => s.enterSelect)
  const clearSelect = useUI((s) => s.clearSelect)
  const selecting = useUI((s) => s.selection.mode === 'note')
  const notes = useLiveQuery(() => db.notes.toArray(), [], [] as Note[])
  const categories = useLiveQuery(() => db.categories.where('type').equals('note').toArray(), [], [] as Category[])
  const tags = useLiveQuery(() => db.tags.where('type').equals('note').toArray(), [], [] as Tag[])

  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [hideCompleted, setHideCompleted] = useState(false)

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
  // Search first, so the chip counts reflect the active query.
  const found = withNames.filter(({ note, categoryName, tagNames }) => {
    const text = [note.title, note.body, categoryName, ...tagNames].filter(Boolean).join(' ')
    return itemMatches(parsed, { categoryName, tagNames, text }, names)
  })
  const kindCount = (k: KindFilter) => (k === 'all' ? found.length : found.filter((x) => kindOf(x.note) === k).length)

  const byKind = kindFilter === 'all' ? found : found.filter((x) => kindOf(x.note) === kindFilter)
  const hasCompleted = byKind.some((x) => isDoneTask(x.note))
  const visible = hideCompleted ? byKind.filter((x) => !isDoneTask(x.note)) : byKind

  // Tasks/Events sort by when (soonest first, undated last); Notes/All keep manual order.
  const dateView = kindFilter === 'task' || kindFilter === 'event'
  const sorted = [...visible].sort((a, b) => {
    const ad = isDoneTask(a.note) ? 1 : 0
    const bd = isDoneTask(b.note) ? 1 : 0
    if (ad !== bd) return ad - bd // completed tasks always sink
    if (dateView) {
      const as = a.note.startsAt ?? '~' // '~' > any date digit → undated sorts last
      const bs = b.note.startsAt ?? '~'
      return as < bs ? -1 : as > bs ? 1 : 0
    }
    return (b.note.pinned ? 1 : 0) - (a.note.pinned ? 1 : 0) || a.note.order - b.note.order
  })

  const sensors = useDndSensors()
  // Manual drag only in the unfiltered "All" view — writes a clean global order.
  const sortable = !searching && !selecting && kindFilter === 'all'
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
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={t.key === kindFilter ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              onClick={() => setKindFilter(t.key)}
            >
              {t.label}
              <span className={styles.tabCount}>{kindCount(t.key)}</span>
            </button>
          ))}
        </div>
        {notes.length > 0 && (
          <div className={styles.actions}>
            {hasCompleted && (
              <button className={styles.addBtn} onClick={() => setHideCompleted((v) => !v)}>
                {hideCompleted ? <Eye size={15} /> : <EyeOff size={15} />}
                <span>{hideCompleted ? 'Show done' : 'Hide done'}</span>
              </button>
            )}
            <button className={styles.addBtn} onClick={() => (selecting ? clearSelect() : enterSelect('note'))}>
              <CircleCheck size={15} />
              <span>{selecting ? 'Done' : 'Select'}</span>
            </button>
            <button className={styles.addBtn} onClick={openAdd}>
              <Plus size={15} />
              <span>New</span>
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
      ) : sorted.length === 0 ? (
        <div className={styles.noMatch}>
          {searching ? (
            <>
              <SearchX size={22} />
              <span>No notes match your search.</span>
            </>
          ) : (
            (() => {
              const e = kindFilter === 'all' ? EMPTY_KIND.note : EMPTY_KIND[kindFilter]
              const Icon = e.icon
              return (
                <>
                  <Icon size={22} />
                  <span>No {e.noun} here yet.</span>
                </>
              )
            })()
          )}
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
  // Async (Dexie) reorder → disable the post-drop layout FLIP so the item
  // doesn't animate the "wrong way" while the new order settles.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.note.id,
    animateLayoutChanges: () => false,
  })
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
