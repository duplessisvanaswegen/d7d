import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { useUI } from '@/state/ui'
import styles from './MobileTabs.module.css'

export function MobileTabs() {
  const tab = useUI((s) => s.mobileTab)
  const setTab = useUI((s) => s.setMobileTab)
  const bookmarkCount = useLiveQuery(() => db.bookmarks.count(), [], 0)
  const noteCount = useLiveQuery(() => db.notes.count(), [], 0)

  return (
    <div className={styles.tabs}>
      {(['bookmarks', 'notes'] as const).map((t) => (
        <button
          key={t}
          className={t === tab ? `${styles.tab} ${styles.active}` : styles.tab}
          onClick={() => setTab(t)}
        >
          <span>{t === 'bookmarks' ? 'Bookmarks' : 'Notes'}</span>
          <span className={styles.count}>{t === 'bookmarks' ? bookmarkCount : noteCount}</span>
        </button>
      ))}
    </div>
  )
}
