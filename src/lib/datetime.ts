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

/** 'YYYY-MM-DD' day-key for a LOCAL Date (matches the floating-string date part). */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** First-of-month `n` months from `d` (day-of-month reset to 1). */
export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

/** "July 2026". */
export function monthTitle(d: Date): string {
  return d.toLocaleDateString([], { month: 'long', year: 'numeric' })
}

/** 42 local-midnight Dates (6 weeks × 7), Monday-start, covering the month of `anchor`. */
export function monthMatrix(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const mondayOffset = (first.getDay() + 6) % 7 // Sun=0 → 6, Mon=1 → 0, …
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    days.push(new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset + i))
  }
  return days
}

/** Just the time part of a timed floating string, e.g. "14:00" / "2:00 pm". */
export function timeOf(floating: string, hour12?: boolean): string {
  return timeLabel(parseFloating(floating), hour12)
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

const timeLabel = (d: Date, hour12?: boolean) =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12 })

/** "Due Fri", "Due Today 14:00". */
export function formatDue(startsAt: string, allDay: boolean | undefined, hour12?: boolean): string {
  const d = parseFloating(startsAt)
  return allDay ? dayLabel(d) : `${dayLabel(d)} ${timeLabel(d, hour12)}`
}

/** "Mon · all day", "Fri 14:00–15:00", "12 Jul 22:00 – 13 Jul 02:00". */
export function formatEventTime(
  startsAt: string,
  endsAt: string | undefined,
  allDay: boolean | undefined,
  hour12?: boolean,
): string {
  const start = parseFloating(startsAt)
  if (allDay) {
    if (endsAt) {
      const end = parseFloating(endsAt)
      if (!sameDay(start, end)) return `${dayLabel(start)} – ${dayLabel(end)}`
    }
    return `${dayLabel(start)} · all day`
  }
  if (!endsAt) return `${dayLabel(start)} ${timeLabel(start, hour12)}`
  const end = parseFloating(endsAt)
  if (sameDay(start, end)) return `${dayLabel(start)} ${timeLabel(start, hour12)}–${timeLabel(end, hour12)}`
  return `${dayLabel(start)} ${timeLabel(start, hour12)} – ${dayLabel(end)} ${timeLabel(end, hour12)}`
}
