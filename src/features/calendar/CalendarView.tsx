import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '@/db/db'
import { useUI } from '@/state/ui'
import { useSettings } from '@/state/settings'
import { noteBg } from '@/features/notes/colors'
import { parseQuery, isBlank } from '@/features/search/parser'
import { itemMatches, type NameSets } from '@/features/search/match'
import { ymd, addMonths, monthTitle, monthMatrix, timeOf } from '@/lib/datetime'
import { layoutWeek, type CalItem, type Segment } from './layout'
import type { Note, Category, Tag } from '@/types/models'
import styles from './CalendarView.module.css'

const MAX_LANES = 3
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const dateKey = (s: string) => s.slice(0, 10)

export function CalendarView() {
  const query = useUI((s) => s.query)
  const openEdit = useUI((s) => s.openEditNote)
  const openAdd = useUI((s) => s.openAddNote)
  const hour12 = useSettings((s) => s.clockFormat) === '12'
  const [anchor, setAnchor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const notes = useLiveQuery(() => db.notes.toArray(), [], [] as Note[])
  const categories = useLiveQuery(() => db.categories.where('type').equals('note').toArray(), [], [] as Category[])
  const tags = useLiveQuery(() => db.tags.where('type').equals('note').toArray(), [], [] as Tag[])

  const catName = new Map(categories.map((c) => [c.id, c.reserved ? undefined : c.name]))
  const tagName = new Map(tags.map((t) => [t.id, t.name]))
  const names: NameSets = {
    categories: new Set(categories.filter((c) => !c.reserved).map((c) => c.name.toLowerCase())),
    tags: new Set(tags.map((t) => t.name.toLowerCase())),
  }
  const parsed = parseQuery(query)
  const searching = !isBlank(query) || !!parsed.active

  const items: CalItem[] = notes
    .filter((n): n is Note & { startsAt: string } => (n.kind === 'task' || n.kind === 'event') && !!n.startsAt)
    .filter((n) => {
      if (!searching) return true
      const categoryName = catName.get(n.categoryId)
      const tagNames = n.tagIds.map((id) => tagName.get(id)).filter((x): x is string => !!x)
      const text = [n.title, n.body, categoryName, ...tagNames].filter(Boolean).join(' ')
      return itemMatches(parsed, { categoryName, tagNames, text }, names)
    })
    .map((n) => {
      const startKey = dateKey(n.startsAt)
      const endKey = n.kind === 'event' && n.endsAt ? dateKey(n.endsAt) : startKey
      return {
        id: n.id,
        kind: n.kind as 'task' | 'event',
        title: n.title || n.body.slice(0, 40) || (n.kind === 'task' ? 'Task' : 'Event'),
        color: n.color,
        startsAt: n.startsAt,
        endsAt: n.endsAt,
        startKey,
        endKey,
        allDay: n.allDay,
        timed: !n.allDay && n.startsAt.includes('T'),
        done: n.done,
      }
    })

  const matrix = monthMatrix(anchor)
  const weeks: Date[][] = Array.from({ length: 6 }, (_, w) => matrix.slice(w * 7, w * 7 + 7))
  const todayKey = ymd(new Date())
  const anchorMonth = anchor.getMonth()

  return (
    <section className={styles.view}>
      <header className={styles.header}>
        <div className={styles.nav}>
          <button className={styles.navBtn} onClick={() => setAnchor((a) => addMonths(a, -1))} aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <h2 className={styles.title}>{monthTitle(anchor)}</h2>
          <button className={styles.navBtn} onClick={() => setAnchor((a) => addMonths(a, 1))} aria-label="Next month">
            <ChevronRight size={18} />
          </button>
          <button
            className={styles.today}
            onClick={() => {
              const now = new Date()
              setAnchor(new Date(now.getFullYear(), now.getMonth(), 1))
            }}
          >
            Today
          </button>
        </div>
      </header>

      <div className={styles.dow}>
        {DOW.map((d) => (
          <span key={d} className={styles.dowCell}>
            {d}
          </span>
        ))}
      </div>

      <div className={styles.month}>
        {weeks.map((week, wi) => {
          const weekKeys = week.map(ymd)
          const { segments, hiddenPerCol } = layoutWeek(weekKeys, items, MAX_LANES)
          return (
            <div className={styles.week} key={wi}>
              <div className={styles.weekBg}>
                {week.map((d, di) => {
                  const key = weekKeys[di]
                  const other = d.getMonth() !== anchorMonth
                  return (
                    <div
                      key={di}
                      className={`${styles.col}${other ? ` ${styles.other}` : ''}${key === todayKey ? ` ${styles.todayCol}` : ''}`}
                      onClick={() => openAdd({ kind: 'task', startDate: key })}
                      title="New task"
                    />
                  )
                })}
              </div>
              <div className={styles.weekContent}>
                {week.map((d, di) => (
                  <span
                    key={di}
                    className={`${styles.dayNum}${d.getMonth() !== anchorMonth ? ` ${styles.otherNum}` : ''}${weekKeys[di] === todayKey ? ` ${styles.todayNum}` : ''}`}
                    style={{ gridColumn: di + 1, gridRow: 1 }}
                  >
                    {d.getDate()}
                  </span>
                ))}
                {segments.map((seg) => (
                  <Bar key={seg.item.id} seg={seg} hour12={hour12} onEdit={openEdit} />
                ))}
                {hiddenPerCol.map((n, di) =>
                  n > 0 ? (
                    <span key={`more-${di}`} className={styles.more} style={{ gridColumn: di + 1, gridRow: MAX_LANES + 2 }}>
                      +{n} more
                    </span>
                  ) : null,
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Bar({ seg, hour12, onEdit }: { seg: Segment; hour12: boolean; onEdit: (id: string) => void }) {
  const { item, startCol, endCol, lane, continuesLeft, continuesRight } = seg
  const showTime = item.timed && !continuesLeft
  const cls = [
    styles.bar,
    item.done ? styles.barDone : '',
    continuesLeft ? styles.contLeft : '',
    continuesRight ? styles.contRight : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type="button"
      className={cls}
      style={{
        gridColumn: `${startCol + 1} / ${endCol + 2}`,
        gridRow: lane + 2,
        background: noteBg(item.color),
      }}
      title={item.title}
      onClick={() => onEdit(item.id)}
    >
      {showTime && <b className={styles.barTime}>{timeOf(item.startsAt, hour12)}</b>}
      <span className={styles.barTitle}>{item.title}</span>
    </button>
  )
}
