import { useEffect, useState } from 'react'
import { Plus, Settings } from 'lucide-react'
import { useUI } from '@/state/ui'
import { SearchBar } from '@/features/search/SearchBar'
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
  const openOptions = useUI((s) => s.openOptions)
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <header className={styles.bar}>
      <span className={styles.logo}>d7d</span>

      <SearchBar />

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

      <button className={styles.iconBtn} onClick={openOptions} aria-label="Options" title="Options">
        <Settings size={18} />
      </button>
    </header>
  )
}
