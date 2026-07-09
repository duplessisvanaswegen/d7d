import type { HTMLAttributes } from 'react'
import { Pencil, Link as LinkIcon, ExternalLink, ArrowUp, ArrowDown, Trash2, CircleCheckBig, Circle, GripVertical } from 'lucide-react'
import { Menu, type MenuItem } from '@/ui/Menu'
import { Favicon } from '@/ui/Favicon'
import { useUI } from '@/state/ui'
import { useSettings } from '@/state/settings'
import { deleteBookmark, restoreBookmark, moveBookmark } from '@/db/repo'
import { toast } from '@/state/toast'
import { getDomain } from '@/lib/url'
import type { Bookmark } from '@/types/models'
import styles from './BookmarkRow.module.css'

export function BookmarkRow({
  bookmark,
  handleProps,
}: {
  bookmark: Bookmark
  handleProps?: HTMLAttributes<HTMLButtonElement>
}) {
  const openEdit = useUI((s) => s.openEditBookmark)
  const openLinks = useSettings((s) => s.openLinks)
  const selecting = useUI((s) => s.selection.mode === 'bookmark')
  const selected = useUI((s) => s.selection.ids.has(bookmark.id))
  const toggleSelected = useUI((s) => s.toggleSelected)

  const open = () =>
    window.open(bookmark.url, openLinks === 'new' ? '_blank' : '_self', 'noopener,noreferrer')

  const del = () => {
    void deleteBookmark(bookmark.id)
    toast({ message: 'Bookmark deleted', actionLabel: 'Undo', onAction: () => void restoreBookmark(bookmark) })
  }

  const items: MenuItem[] = [
    { label: 'Edit', icon: Pencil, onClick: () => openEdit(bookmark.id) },
    { label: 'Copy URL', icon: LinkIcon, onClick: () => void navigator.clipboard?.writeText(bookmark.url) },
    { label: 'Open in new tab', icon: ExternalLink, onClick: open },
    { label: 'Move up', icon: ArrowUp, onClick: () => void moveBookmark(bookmark.id, -1) },
    { label: 'Move down', icon: ArrowDown, onClick: () => void moveBookmark(bookmark.id, 1) },
    { label: 'Delete', icon: Trash2, danger: true, onClick: del },
  ]

  return (
    <div
      className={selected ? `${styles.row} ${styles.selected}` : styles.row}
      onClick={selecting ? () => toggleSelected(bookmark.id) : open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') selecting ? toggleSelected(bookmark.id) : open()
      }}
    >
      {handleProps && !selecting && (
        <button className={styles.handle} {...handleProps} onClick={(e) => e.stopPropagation()} aria-label="Drag to reorder">
          <GripVertical size={14} />
        </button>
      )}
      {selecting &&
        (selected ? (
          <CircleCheckBig size={17} className={styles.checkOn} />
        ) : (
          <Circle size={17} className={styles.check} />
        ))}
      <Favicon url={bookmark.url} title={bookmark.title} size={22} />
      <span className={styles.title}>{bookmark.title}</span>
      <span className={styles.domain}>{getDomain(bookmark.url)}</span>
      {!selecting && <Menu items={items} />}
    </div>
  )
}
