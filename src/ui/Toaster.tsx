import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useToasts, type Toast } from '@/state/toast'
import styles from './Toaster.module.css'

const DURATION = 6000

export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  return createPortal(
    <div className={styles.wrap}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>,
    document.body,
  )
}

function ToastItem({ toast }: { toast: Toast }) {
  const remove = useToasts((s) => s.remove)
  useEffect(() => {
    const id = setTimeout(() => remove(toast.id), DURATION)
    return () => clearTimeout(id)
  }, [toast.id, remove])

  return (
    <div className={styles.toast}>
      <span className={styles.msg}>{toast.message}</span>
      {toast.actionLabel && (
        <button
          className={styles.action}
          onClick={() => {
            toast.onAction?.()
            remove(toast.id)
          }}
        >
          {toast.actionLabel}
        </button>
      )}
    </div>
  )
}
