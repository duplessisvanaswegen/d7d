import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Folder, Tag, Trash2 } from 'lucide-react'
import { useUI } from '@/state/ui'
import { bulkDelete, bulkSetCategory, bulkAddTags } from '@/db/repo'
import { toast } from '@/state/toast'
import styles from './BulkBar.module.css'

export function BulkBar() {
  const selection = useUI((s) => s.selection)
  const clearSelect = useUI((s) => s.clearSelect)
  const [popover, setPopover] = useState<'category' | 'tag' | null>(null)
  const [value, setValue] = useState('')

  const mode = selection.mode
  const ids = [...selection.ids]
  if (!mode || ids.length === 0) return null

  async function applyCategory() {
    if (value.trim()) await bulkSetCategory(mode!, ids, value.trim())
    reset()
    clearSelect()
  }
  async function applyTag() {
    const names = value.split(',').map((s) => s.trim()).filter(Boolean)
    if (names.length) await bulkAddTags(mode!, ids, names)
    reset()
    clearSelect()
  }
  function del() {
    void bulkDelete(mode!, ids)
    toast({ message: `${ids.length} ${mode === 'bookmark' ? 'bookmark' : 'note'}${ids.length === 1 ? '' : 's'} deleted` })
    clearSelect()
  }
  function reset() {
    setPopover(null)
    setValue('')
  }

  return createPortal(
    <div className={styles.bar}>
      <span className={styles.count}>{ids.length} selected</span>
      <div className={styles.divider} />
      {popover ? (
        <div className={styles.pop}>
          <input
            autoFocus
            className={styles.popInput}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void (popover === 'category' ? applyCategory() : applyTag())
              } else if (e.key === 'Escape') {
                reset()
              }
            }}
            placeholder={popover === 'category' ? 'Category name…' : 'Tags (comma-separated)…'}
          />
          <button className={styles.popApply} onClick={() => void (popover === 'category' ? applyCategory() : applyTag())}>
            Apply
          </button>
        </div>
      ) : (
        <>
          <button className={styles.act} onClick={() => setPopover('category')}>
            <Folder size={14} /> Category
          </button>
          <button className={styles.act} onClick={() => setPopover('tag')}>
            <Tag size={14} /> Tags
          </button>
          <button className={`${styles.act} ${styles.danger}`} onClick={del}>
            <Trash2 size={14} /> Delete
          </button>
          <div className={styles.divider} />
          <button className={styles.cancel} onClick={clearSelect}>
            Cancel
          </button>
        </>
      )}
    </div>,
    document.body,
  )
}
