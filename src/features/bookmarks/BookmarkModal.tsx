import { useEffect, useState, type KeyboardEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link2, X } from 'lucide-react'
import { db } from '@/db/db'
import { saveBookmarkForm, findBookmarkByUrl } from '@/db/repo'
import { useUI } from '@/state/ui'
import { Modal } from '@/ui/Modal'
import { Favicon } from '@/ui/Favicon'
import { titleFromUrl, getDomain } from '@/lib/url'
import type { ID } from '@/types/models'
import styles from './BookmarkModal.module.css'

export function BookmarkModal() {
  const { bookmarkModal, closeBookmarkModal } = useUI()
  return (
    <Modal open={bookmarkModal.open} onClose={closeBookmarkModal} title={bookmarkModal.editingId ? 'Edit bookmark' : 'Add bookmark'}>
      <BookmarkForm key={bookmarkModal.editingId ?? 'new'} editingId={bookmarkModal.editingId} onDone={closeBookmarkModal} />
    </Modal>
  )
}

function BookmarkForm({ editingId, onDone }: { editingId: ID | null; onDone: () => void }) {
  const categories = useLiveQuery(
    async () => (await db.categories.where('type').equals('bookmark').toArray()).filter((c) => !c.reserved),
    [],
    [],
  )
  const tags = useLiveQuery(() => db.tags.where('type').equals('bookmark').toArray(), [], [])

  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [tagNames, setTagNames] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [dupe, setDupe] = useState(false)

  useEffect(() => {
    if (!editingId) return
    void (async () => {
      const bm = await db.bookmarks.get(editingId)
      if (!bm) return
      setUrl(bm.url)
      setTitle(bm.title)
      const cat = await db.categories.get(bm.categoryId)
      setCategoryName(cat && !cat.reserved ? cat.name : '')
      const ts = await db.tags.bulkGet(bm.tagIds)
      setTagNames(ts.filter((t): t is NonNullable<typeof t> => !!t).map((t) => t.name))
    })()
  }, [editingId])

  async function onUrlBlur() {
    if (url.trim() && !title.trim()) setTitle(titleFromUrl(url))
    if (url.trim() && !editingId) setDupe(!!(await findBookmarkByUrl(url)))
  }

  function addTag(raw: string) {
    const name = raw.trim().replace(/^#/, '').trim()
    if (name && !tagNames.some((t) => t.toLowerCase() === name.toLowerCase())) {
      setTagNames([...tagNames, name])
    }
    setTagDraft('')
  }
  function onTagKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagDraft)
    } else if (e.key === 'Backspace' && !tagDraft && tagNames.length) {
      setTagNames(tagNames.slice(0, -1))
    }
  }

  async function submit() {
    if (!url.trim()) return
    await saveBookmarkForm({ url, title, categoryName, tagNames }, editingId)
    onDone()
  }

  const canSave = url.trim().length > 0

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <label className={styles.field}>
        <span className={styles.label}>URL</span>
        <div className={styles.input}>
          <Link2 size={16} className={styles.inputIcon} />
          <input
            className={styles.control}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={onUrlBlur}
            placeholder="https://example.com"
            autoFocus
          />
        </div>
        {dupe && <span className={styles.nudge}>You already have a bookmark for this URL.</span>}
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Title</span>
        <div className={styles.input}>
          {url.trim() ? <Favicon url={url} title={title || getDomain(url)} size={22} /> : null}
          <input
            className={styles.control}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={url.trim() ? titleFromUrl(url) : 'Title'}
          />
        </div>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Category</span>
        <input
          className={styles.plainInput}
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          placeholder="Uncategorised"
          list="bm-categories"
        />
        <datalist id="bm-categories">
          {categories.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Tags</span>
        <div className={styles.tagWrap}>
          {tagNames.map((t) => (
            <span key={t} className={styles.tag}>
              #{t}
              <button type="button" onClick={() => setTagNames(tagNames.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
                <X size={11} />
              </button>
            </span>
          ))}
          <input
            className={styles.tagInput}
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={onTagKey}
            onBlur={() => tagDraft && addTag(tagDraft)}
            placeholder={tagNames.length ? '' : 'Add a tag…'}
            list="bm-tags"
          />
          <datalist id="bm-tags">
            {tags.map((t) => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
        </div>
      </label>

      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className={styles.save} disabled={!canSave}>
          {editingId ? 'Save changes' : 'Add bookmark'}
        </button>
      </div>
    </form>
  )
}
