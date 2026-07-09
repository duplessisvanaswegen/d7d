import { CalendarDays } from 'lucide-react'
import styles from './CalendarView.module.css'

export function CalendarView() {
  return (
    <section className={styles.view}>
      <div className={styles.placeholder}>
        <CalendarDays size={28} />
        <span>Calendar — month grid coming next.</span>
      </div>
    </section>
  )
}
