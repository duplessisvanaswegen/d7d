import { Pencil, Link as LinkIcon, ExternalLink, Trash2 } from 'lucide-react'
import { Menu, type MenuItem } from '@/ui/Menu'
import { Favicon } from '@/ui/Favicon'
import { useUI } from '@/state/ui'
import { useSettings } from '@/state/settings'
import { deleteBookmark } from '@/db/repo'
import { getDomain } from '@/lib/url'
import type { Bookmark } from '@/types/models'
import styles from './BookmarkRow.module.css'

export function BookmarkRow({ bookmark }: { bookmark: Bookmark }) {
  const openEdit = useUI((s) => s.openEditBookmark)
  const openLinks = useSettings((s) => s.openLinks)
  const open = () =>
    window.open(bookmark.url, openLinks === 'new' ? '_blank' : '_self', 'noopener,noreferrer')

  const items: MenuItem[] = [
    { label: 'Edit', icon: Pencil, onClick: () => openEdit(bookmark.id) },
    { label: 'Copy URL', icon: LinkIcon, onClick: () => void navigator.clipboard?.writeText(bookmark.url) },
    { label: 'Open in new tab', icon: ExternalLink, onClick: open },
    { label: 'Delete', icon: Trash2, danger: true, onClick: () => void deleteBookmark(bookmark.id) },
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
