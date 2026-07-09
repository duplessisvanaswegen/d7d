import { Pencil, Link as LinkIcon, ExternalLink, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import { Menu, type MenuItem } from '@/ui/Menu'
import { Favicon } from '@/ui/Favicon'
import { db } from '@/db/db'
import { useUI } from '@/state/ui'
import { useSettings } from '@/state/settings'
import { deleteBookmark, moveBookmark } from '@/db/repo'
import { toast } from '@/state/toast'
import { getDomain } from '@/lib/url'
import type { Bookmark } from '@/types/models'
import styles from './BookmarkRow.module.css'

export function BookmarkRow({ bookmark }: { bookmark: Bookmark }) {
  const openEdit = useUI((s) => s.openEditBookmark)
  const openLinks = useSettings((s) => s.openLinks)
  const open = () =>
    window.open(bookmark.url, openLinks === 'new' ? '_blank' : '_self', 'noopener,noreferrer')

  const del = () => {
    void deleteBookmark(bookmark.id)
    toast({ message: 'Bookmark deleted', actionLabel: 'Undo', onAction: () => void db.bookmarks.add(bookmark) })
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
      className={styles.row}
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') open()
      }}
    >
      <Favicon url={bookmark.url} title={bookmark.title} size={22} />
      <span className={styles.title}>{bookmark.title}</span>
      <span className={styles.domain}>{getDomain(bookmark.url)}</span>
      <Menu items={items} />
    </div>
  )
}
