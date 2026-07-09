import { TopBar } from './TopBar'
import { BookmarksPanel } from '@/features/bookmarks/BookmarksPanel'
import { NotesPanel } from '@/features/notes/NotesPanel'
import { CalendarView } from '@/features/calendar/CalendarView'
import { BookmarkModal } from '@/features/bookmarks/BookmarkModal'
import { NoteModal } from '@/features/notes/NoteModal'
import { OptionsModal } from '@/features/options/OptionsModal'
import { MobileTabs } from './MobileTabs'
import { Toaster } from '@/ui/Toaster'
import { BulkBar } from '@/ui/BulkBar'
import { useUI } from '@/state/ui'
import styles from './App.module.css'

export function App() {
  const view = useUI((s) => s.view)
  const mobileTab = useUI((s) => s.mobileTab)
  return (
    <div className={styles.screen}>
      <TopBar />
      {view === 'calendar' ? (
        <div className={styles.body}>
          <CalendarView />
        </div>
      ) : (
        <>
          <MobileTabs />
          <div className={styles.body} data-mobile-tab={mobileTab}>
            <BookmarksPanel />
            <NotesPanel />
          </div>
        </>
      )}
      <BookmarkModal />
      <NoteModal />
      <OptionsModal />
      <BulkBar />
      <Toaster />
    </div>
  )
}
