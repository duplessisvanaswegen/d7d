import { Settings } from 'lucide-react'
import { useUI } from '@/state/ui'
import { SearchBar } from '@/features/search/SearchBar'
import { ClockWidget } from '@/features/weather/ClockWidget'
import styles from './TopBar.module.css'

export function TopBar() {
  const openOptions = useUI((s) => s.openOptions)

  return (
    <header className={styles.bar}>
      <span className={styles.logo}>d7d</span>

      <SearchBar />

      <div className={styles.clocks}>
        <ClockWidget />
      </div>

      <button className={styles.iconBtn} onClick={openOptions} aria-label="Options" title="Options">
        <Settings size={18} />
      </button>
    </header>
  )
}
