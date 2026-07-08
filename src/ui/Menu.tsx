import { useEffect, useRef, useState } from 'react'
import { MoreVertical, type LucideIcon } from 'lucide-react'
import styles from './Menu.module.css'

export interface MenuItem {
  label: string
  icon: LucideIcon
  onClick: () => void
  danger?: boolean
}

interface Props {
  items: MenuItem[]
  label?: string
}

export function Menu({ items, label = 'More actions' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              className={it.danger ? `${styles.item} ${styles.danger}` : styles.item}
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                it.onClick()
              }}
            >
              <it.icon size={15} className={styles.itemIcon} />
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
