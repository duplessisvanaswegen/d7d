// Floating local date/time helpers. Schedule strings are 'YYYY-MM-DD' (all-day)
// or 'YYYY-MM-DDTHH:mm' (timed) — local wall-clock, no offset, no timezone math.
// Lexicographic order of these strings == chronological order (they're ISO-ish).

/** Parse a floating string to a LOCAL Date. Avoids `new Date('2024-07-12')` = UTC-midnight. */
export function parseFloating(s: string): Date {
  const [date, time] = s.split('T')
  const [y, m, d] = date.split('-').map(Number)
  if (time) {
    const [hh, mm] = time.split(':').map(Number)
    return new Date(y, m - 1, d, hh, mm)
  }
  return new Date(y, m - 1, d)
}

/** A task/event is overdue if its start is in the past (all-day → after the end of that day). */
export function isOverdue(startsAt: string, allDay: boolean | undefined): boolean {
  const when = parseFloating(startsAt)
  if (allDay) when.setDate(when.getDate() + 1) // overdue only from the next day
  return Date.now() >= when.getTime()
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** Relative-ish day label: "Today", "Tomorrow", weekday if within a week, else "12 Jul" (+ year if not this year). */
function dayLabel(d: Date): string {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((startOfDay.getTime() - startOfToday.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 1 && diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }
  return d.toLocaleDateString([], opts)
}

const timeLabel = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** "Due Fri", "Due Today 14:00". */
export function formatDue(startsAt: string, allDay: boolean | undefined): string {
  const d = parseFloating(startsAt)
  return allDay ? dayLabel(d) : `${dayLabel(d)} ${timeLabel(d)}`
}

/** "Mon · all day", "Fri 14:00–15:00", "12 Jul 22:00 – 13 Jul 02:00". */
export function formatEventTime(startsAt: string, endsAt: string | undefined, allDay: boolean | undefined): string {
  const start = parseFloating(startsAt)
  if (allDay) {
    if (endsAt) {
      const end = parseFloating(endsAt)
      if (!sameDay(start, end)) return `${dayLabel(start)} – ${dayLabel(end)}`
    }
    return `${dayLabel(start)} · all day`
  }
  if (!endsAt) return `${dayLabel(start)} ${timeLabel(start)}`
  const end = parseFloating(endsAt)
  if (sameDay(start, end)) return `${dayLabel(start)} ${timeLabel(start)}–${timeLabel(end)}`
  return `${dayLabel(start)} ${timeLabel(start)} – ${dayLabel(end)} ${timeLabel(end)}`
}
