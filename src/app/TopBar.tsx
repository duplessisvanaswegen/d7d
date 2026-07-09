import { Settings } from 'lucide-react'
import { useUI } from '@/state/ui'
import { SearchBar } from '@/features/search/SearchBar'
import { ClockWidget } from '@/features/weather/ClockWidget'
import styles from './TopBar.module.css'

const VIEWS = [
  { key: 'home', label: 'Home' },
  { key: 'calendar', label: 'Calendar' },
] as const

export function TopBar() {
  const openOptions = useUI((s) => s.openOptions)
  const view = useUI((s) => s.view)
  const setView = useUI((s) => s.setView)

  return (
    <header className={styles.bar}>
      <span className={styles.logo}>d7d</span>

      <div className={styles.viewSwitch}>
        {VIEWS.map((v) => (
          <button
            key={v.key}
            className={v.key === view ? `${styles.viewOpt} ${styles.viewActive}` : styles.viewOpt}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

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
