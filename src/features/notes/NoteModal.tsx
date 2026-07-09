import { useEffect, useState, type KeyboardEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pin, X } from 'lucide-react'
import { db } from '@/db/db'
import { saveNoteForm } from '@/db/repo'
import { useUI } from '@/state/ui'
import { Modal } from '@/ui/Modal'
import { NOTE_COLORS, noteBg, NOTE_BODY_SOFT_CAP } from './colors'
import type { ID, NoteColor, NoteKind } from '@/types/models'
import styles from './NoteModal.module.css'

const KINDS: { value: NoteKind; label: string }[] = [
  { value: 'note', label: 'Note' },
  { value: 'task', label: 'Task' },
  { value: 'event', label: 'Event' },
]

function splitFloating(s?: string): { date: string; time: string } {
  if (!s) return { date: '', time: '' }
  const [date, time] = s.split('T')
  return { date: date ?? '', time: time ?? '' }
}

export function NoteModal() {
  const { noteModal, closeNoteModal } = useUI()
  return (
    <Modal open={noteModal.open} onClose={closeNoteModal} title={noteModal.editingId ? 'Edit' : 'New'}>
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

  const [kind, setKind] = useState<NoteKind>('note')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [color, setColor] = useState<NoteColor>('yellow')
  const [categoryName, setCategoryName] = useState('')
  const [tagNames, setTagNames] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [pinned, setPinned] = useState(false)
  const [allDay, setAllDay] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')

  useEffect(() => {
    if (!editingId) return
    void (async () => {
      const n = await db.notes.get(editingId)
      if (!n) return
      setKind(n.kind)
      setTitle(n.title ?? '')
      setBody(n.body)
      setColor(n.color)
      setPinned(n.pinned)
      setAllDay(n.allDay ?? true)
      const s = splitFloating(n.startsAt)
      setStartDate(s.date)
      setStartTime(s.time)
      const e = splitFloating(n.endsAt)
      setEndDate(e.date)
      setEndTime(e.time)
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

  const compose = (date: string, time: string) => (date ? (allDay || !time ? date : `${date}T${time}`) : undefined)

  async function submit() {
    if (!canSave) return
    await saveNoteForm(
      {
        kind,
        title,
        body,
        color,
        categoryName,
        tagNames,
        pinned,
        startsAt: compose(startDate, startTime),
        endsAt: kind === 'event' ? compose(endDate, endTime) : undefined,
        allDay,
      },
      editingId,
    )
    onDone()
  }

  const over = body.length > NOTE_BODY_SOFT_CAP
  const hasContent = body.trim().length > 0 || title.trim().length > 0
  const canSave = hasContent && (kind !== 'event' || startDate.length > 0)

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <div className={styles.kindSeg}>
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            className={k.value === kind ? `${styles.kindOpt} ${styles.kindActive}` : styles.kindOpt}
            onClick={() => setKind(k.value)}
          >
            {k.label}
          </button>
        ))}
      </div>

      <input className={styles.titleInput} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" />

      {kind !== 'note' && (
        <div className={styles.schedule}>
          <div className={styles.scheduleHead}>
            <span className={styles.scheduleLabel}>{kind === 'task' ? 'Due' : 'When'}</span>
            <label className={styles.allDay}>
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
              All day
            </label>
          </div>
          <div className={styles.dateRow}>
            {kind === 'event' && <span className={styles.dateSub}>Start</span>}
            <input type="date" className={styles.dateInput} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            {!allDay && <input type="time" className={styles.dateInput} value={startTime} onChange={(e) => setStartTime(e.target.value)} />}
          </div>
          {kind === 'event' && (
            <div className={styles.dateRow}>
              <span className={styles.dateSub}>End</span>
              <input type="date" className={styles.dateInput} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              {!allDay && <input type="time" className={styles.dateInput} value={endTime} onChange={(e) => setEndTime(e.target.value)} />}
            </div>
          )}
        </div>
      )}

      <div className={styles.bodyWrap}>
        <textarea
          className={styles.body}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={kind === 'note' ? 'Write a note…' : 'Notes (optional)…'}
          rows={kind === 'note' ? 4 : 2}
        />
      </div>
      <div className={styles.bodyMeta}>
        <span className={styles.hint}>
          <b>**bold**</b> · <b>*italic*</b> · <b>- list</b>
        </span>
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
        <button type="submit" className={styles.save} disabled={!canSave}>
          {editingId ? 'Save changes' : `Add ${kind}`}
        </button>
      </div>
    </form>
  )
}
