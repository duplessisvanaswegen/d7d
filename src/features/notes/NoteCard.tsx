import type { HTMLAttributes } from 'react'
import { Pencil, Copy, CopyPlus, Pin, ArrowUp, ArrowDown, Trash2, CircleCheckBig, Circle, GripVertical } from 'lucide-react'
import { Menu, type MenuItem } from '@/ui/Menu'
import { db } from '@/db/db'
import { useUI } from '@/state/ui'
import { deleteNote, duplicateNote, toggleNotePin, moveNote, setNoteColor } from '@/db/repo'
import { toast } from '@/state/toast'
import { noteBg, NOTE_COLORS } from './colors'
import type { Note } from '@/types/models'
import styles from './NoteCard.module.css'

interface Props {
  note: Note
  categoryName?: string
  tagNames: string[]
  handleProps?: HTMLAttributes<HTMLButtonElement>
}

export function NoteCard({ note, categoryName, tagNames, handleProps }: Props) {
  const openEdit = useUI((s) => s.openEditNote)
  const selecting = useUI((s) => s.selection.mode === 'note')
  const selected = useUI((s) => s.selection.ids.has(note.id))
  const toggleSelected = useUI((s) => s.toggleSelected)
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
    <div
      className={selected ? `${styles.card} ${styles.selected}` : styles.card}
      style={{ background: noteBg(note.color) }}
      onClick={selecting ? () => toggleSelected(note.id) : () => openEdit(note.id)}
    >
      <div className={styles.head}>
        {handleProps && !selecting && (
          <button className={styles.handle} {...handleProps} onClick={(e) => e.stopPropagation()} aria-label="Drag to reorder">
            <GripVertical size={13} />
          </button>
        )}
        {selecting &&
          (selected ? <CircleCheckBig size={16} className={styles.check} /> : <Circle size={16} className={styles.check} />)}
        {note.title ? <span className={styles.title}>{note.title}</span> : <span className={styles.spacer} />}
        {note.pinned && <Pin size={13} className={styles.pin} />}
        {!selecting && (
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
        )}
        {!selecting && (
          <Menu
            items={items}
            header={(close) => (
              <div className={styles.swatchRow}>
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    className={c === note.color ? `${styles.swatch} ${styles.swatchOn}` : styles.swatch}
                    style={{ background: noteBg(c) }}
                    onClick={() => {
                      void setNoteColor(note.id, c)
                      close()
                    }}
                    aria-label={c}
                  />
                ))}
              </div>
            )}
          />
        )}
      </div>
      {note.body && <p className={styles.body}>{note.body}</p>}
      {meta && <span className={styles.meta}>{meta}</span>}
    </div>
  )
}
