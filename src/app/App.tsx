import { TopBar } from './TopBar'
import { BookmarksPanel } from '@/features/bookmarks/BookmarksPanel'
import { NotesPanel } from '@/features/notes/NotesPanel'
import { BookmarkModal } from '@/features/bookmarks/BookmarkModal'
import { NoteModal } from '@/features/notes/NoteModal'
import { OptionsModal } from '@/features/options/OptionsModal'
import { MobileTabs } from './MobileTabs'
import { Toaster } from '@/ui/Toaster'
import { useUI } from '@/state/ui'
import styles from './App.module.css'

export function App() {
  const mobileTab = useUI((s) => s.mobileTab)
  return (
    <div className={styles.screen}>
      <TopBar />
      <MobileTabs />
      <div className={styles.body} data-mobile-tab={mobileTab}>
        <BookmarksPanel />
        <NotesPanel />
      </div>
      <BookmarkModal />
      <NoteModal />
      <OptionsModal />
      <Toaster />
    </div>
  )
}
