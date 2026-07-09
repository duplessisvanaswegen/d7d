import { Pencil, Copy, CopyPlus, Pin, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import { Menu, type MenuItem } from '@/ui/Menu'
import { db } from '@/db/db'
import { useUI } from '@/state/ui'
import { deleteNote, duplicateNote, toggleNotePin, moveNote } from '@/db/repo'
import { toast } from '@/state/toast'
import { noteBg } from './colors'
import type { Note } from '@/types/models'
import styles from './NoteCard.module.css'

interface Props {
  note: Note
  categoryName?: string
  tagNames: string[]
}

export function NoteCard({ note, categoryName, tagNames }: Props) {
  const openEdit = useUI((s) => s.openEditNote)
  const meta = [categoryName, ...tagNames.map((t) => `#${t}`)].filter(Boolean).join('  ·  ')
  const copy = () => void navigator.clipboard?.writeText([note.title, note.body].filter(Boolean).join('\n'))

  const del = () => {
    void deleteNote(note.id)
    toast({ message: 'Note deleted', actionLabel: 'Undo', onAction: () => void db.notes.add(note) })
  }

  const items: MenuItem[] = [
    { label: 'Edit', icon: Pencil, onClick: () => openEdit(note.id) },
    { label: 'Copy to clipboard', icon: Copy, onClick: copy },
    { label: 'Duplicate', icon: CopyPlus, onClick: () => void duplicateNote(note.id) },
    { label: note.pinned ? 'Unpin' : 'Pin', icon: Pin, onClick: () => void toggleNotePin(note.id) },
    { label: 'Move up', icon: ArrowUp, onClick: () => void moveNote(note.id, -1) },
    { label: 'Move down', icon: ArrowDown, onClick: () => void moveNote(note.id, 1) },
    { label: 'Delete', icon: Trash2, danger: true, onClick: del },
  ]

  return (
    <div className={styles.card} style={{ background: noteBg(note.color) }} onClick={() => openEdit(note.id)}>
      <div className={styles.head}>
        {note.title ? <span className={styles.title}>{note.title}</span> : <span className={styles.spacer} />}
        {note.pinned && <Pin size={13} className={styles.pin} />}
        <button
          className={styles.iconBtn}
          onClick={(e) => {
            e.stopPropagation()
            copy()
          }}
          aria-label="Copy to clipboard"
        >
          <Copy size={14} />
        </button>
        <Menu items={items} />
      </div>
      {note.body && <p className={styles.body}>{note.body}</p>}
      {meta && <span className={styles.meta}>{meta}</span>}
    </div>
  )
}
