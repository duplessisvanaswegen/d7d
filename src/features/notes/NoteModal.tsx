import { useEffect, useState, type KeyboardEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pin, X } from 'lucide-react'
import { db } from '@/db/db'
import { saveNoteForm } from '@/db/repo'
import { useUI } from '@/state/ui'
import { Modal } from '@/ui/Modal'
import { NOTE_COLORS, noteBg, NOTE_BODY_SOFT_CAP } from './colors'
import type { ID, NoteColor } from '@/types/models'
import styles from './NoteModal.module.css'

export function NoteModal() {
  const { noteModal, closeNoteModal } = useUI()
  return (
    <Modal open={noteModal.open} onClose={closeNoteModal} title={noteModal.editingId ? 'Edit note' : 'New note'}>
      <NoteForm key={noteModal.editingId ?? 'new'} editingId={noteModal.editingId} onDone={closeNoteModal} />
    </Modal>
  )
}

function NoteForm({ editingId, onDone }: { editingId: ID | null; onDone: () => void }) {
  const categories = useLiveQuery(
    async () => (await db.categories.where('type').equals('note').toArray()).filter((c) => !c.reserved),
    [],
    [],
  )
  const tags = useLiveQuery(() => db.tags.where('type').equals('note').toArray(), [], [])

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [color, setColor] = useState<NoteColor>('yellow')
  const [categoryName, setCategoryName] = useState('')
  const [tagNames, setTagNames] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    if (!editingId) return
    void (async () => {
      const n = await db.notes.get(editingId)
      if (!n) return
      setTitle(n.title ?? '')
      setBody(n.body)
      setColor(n.color)
      setPinned(n.pinned)
      const cat = await db.categories.get(n.categoryId)
      setCategoryName(cat && !cat.reserved ? cat.name : '')
      const ts = await db.tags.bulkGet(n.tagIds)
      setTagNames(ts.filter((t): t is NonNullable<typeof t> => !!t).map((t) => t.name))
    })()
  }, [editingId])

  function addTag(raw: string) {
    const name = raw.trim().replace(/^#/, '').trim()
    if (name && !tagNames.some((t) => t.toLowerCase() === name.toLowerCase())) setTagNames([...tagNames, name])
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
    if (!body.trim() && !title.trim()) return
    await saveNoteForm({ title, body, color, categoryName, tagNames, pinned }, editingId)
    onDone()
  }

  const over = body.length > NOTE_BODY_SOFT_CAP

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <input className={styles.titleInput} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" />

      <div className={styles.bodyWrap}>
        <textarea
          className={styles.body}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a note…"
          rows={4}
          autoFocus
        />
        <span className={over ? `${styles.counter} ${styles.over}` : styles.counter}>
          {body.length} / {NOTE_BODY_SOFT_CAP}
        </span>
      </div>

      <div className={styles.swatches}>
        {NOTE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={c === color ? `${styles.swatch} ${styles.swatchActive}` : styles.swatch}
            style={{ background: noteBg(c) }}
            onClick={() => setColor(c)}
            aria-label={c}
          />
        ))}
      </div>

      <div className={styles.row}>
        <input
          className={styles.control}
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          placeholder="Uncategorised"
          list="note-categories"
        />
        <datalist id="note-categories">
          {categories.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <button
          type="button"
          className={pinned ? `${styles.pinBtn} ${styles.pinActive}` : styles.pinBtn}
          onClick={() => setPinned((v) => !v)}
        >
          <Pin size={14} />
          {pinned ? 'Pinned' : 'Pin'}
        </button>
      </div>

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
          list="note-tags"
        />
        <datalist id="note-tags">
          {tags.map((t) => (
            <option key={t.id} value={t.name} />
          ))}
        </datalist>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className={styles.save} disabled={!body.trim() && !title.trim()}>
          {editingId ? 'Save changes' : 'Add note'}
        </button>
      </div>
    </form>
  )
}
