import { useEffect, useState } from 'react'
import { Search, Plus, Settings } from 'lucide-react'
import { cycleTheme } from './theme'
import { useUI } from '@/state/ui'
import styles from './TopBar.module.css'

function useLocalClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 20)
    return () => clearInterval(id)
  }, [])
  return now
}

export function TopBar() {
  const now = useLocalClock()
  const openAdd = useUI((s) => s.openAddBookmark)
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <header className={styles.bar}>
      <span className={styles.logo}>d7d</span>

      <div className={styles.search}>
        <Search size={18} className={styles.searchIcon} />
        <input
          className={styles.input}
          placeholder="Search bookmarks &amp; notes, or  @category  #tag"
          aria-label="Search"
        />
        <kbd className={styles.kbd}>⌘S</kbd>
      </div>

      <div className={styles.clocks}>
        <div className={styles.chip}>
          <span className={styles.chipCity}>Local</span>
          <span className={styles.chipTime}>{time}</span>
        </div>
      </div>

      <button className={styles.add} onClick={openAdd}>
        <Plus size={16} />
        <span>Add</span>
      </button>

      <button className={styles.iconBtn} onClick={() => cycleTheme()} aria-label="Options" title="Options (cycles theme for now)">
        <Settings size={18} />
      </button>
    </header>
  )
}
