import { TopBar } from './TopBar'
import { BookmarksPanel } from '@/features/bookmarks/BookmarksPanel'
import { NotesPanel } from '@/features/notes/NotesPanel'
import { BookmarkModal } from '@/features/bookmarks/BookmarkModal'
import { NoteModal } from '@/features/notes/NoteModal'
import { OptionsModal } from '@/features/options/OptionsModal'
import styles from './App.module.css'

export function App() {
  return (
    <div className={styles.screen}>
      <TopBar />
      <div className={styles.body}>
        <BookmarksPanel />
        <NotesPanel />
      </div>
      <BookmarkModal />
      <NoteModal />
      <OptionsModal />
    </div>
  )
}
