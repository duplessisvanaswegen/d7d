import { StickyNote } from 'lucide-react'
import { EmptyState } from '@/ui/EmptyState'
import styles from './NotesPanel.module.css'

export function NotesPanel() {
  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.titleWrap}>
          <h2 className={styles.title}>Notes</h2>
          <span className={styles.count}>0</span>
        </div>
      </header>
      <EmptyState
        icon={StickyNote}
        title="No notes yet"
        subtitle="Jot quick sticky notes, colour-code them, and pin what matters."
        action="Write your first note"
      />
    </section>
  )
}
