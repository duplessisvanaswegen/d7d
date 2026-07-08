import type { LucideIcon } from 'lucide-react'
import { Plus } from 'lucide-react'
import styles from './EmptyState.module.css'

interface Props {
  icon: LucideIcon
  title: string
  subtitle: string
  action: string
  onAction?: () => void
}

export function EmptyState({ icon: Icon, title, subtitle, action, onAction }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.circle}>
        <Icon size={26} className={styles.icon} />
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.subtitle}>{subtitle}</p>
      <button className={styles.button} onClick={onAction}>
        <Plus size={15} />
        <span>{action}</span>
      </button>
    </div>
  )
}
