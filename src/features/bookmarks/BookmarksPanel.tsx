import { Bookmark } from 'lucide-react'
import { EmptyState } from '@/ui/EmptyState'
import styles from './BookmarksPanel.module.css'

export function BookmarksPanel() {
  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.titleWrap}>
          <h2 className={styles.title}>Bookmarks</h2>
          <span className={styles.count}>0</span>
        </div>
      </header>
      <EmptyState
        icon={Bookmark}
        title="No bookmarks yet"
        subtitle="Save your favourite sites and organise them by category and tags."
        action="Add your first bookmark"
      />
    </section>
  )
}
