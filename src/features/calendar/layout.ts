import type { NoteColor } from '@/types/models'

/** A dated task/event, reduced to what the month grid needs. */
export interface CalItem {
  id: string
  kind: 'task' | 'event'
  title: string
  color: NoteColor
  startsAt: string // floating string
  endsAt?: string
  startKey: string // 'YYYY-MM-DD'
  endKey: string // inclusive
  allDay?: boolean
  timed: boolean
  done?: boolean
}

/** A CalItem's slice within one week, positioned by column with continuation flags. */
export interface Segment {
  item: CalItem
  startCol: number // 0–6
  endCol: number // 0–6 inclusive
  lane: number
  continuesLeft: boolean
  continuesRight: boolean
}

export interface WeekLayout {
  segments: Segment[] // only lanes < maxLanes
  hiddenPerCol: number[] // length 7 — items that overflowed the lane cap, per day
}

/**
 * Greedy interval-partitioning over one week's 7 day-keys (Mon→Sun).
 * Items are packed into the fewest lanes; anything past `maxLanes` becomes
 * per-day overflow counts. Multi-day items are single bars, clipped to the week.
 */
export function layoutWeek(weekKeys: string[], items: CalItem[], maxLanes: number): WeekLayout {
  const weekStart = weekKeys[0]
  const weekEnd = weekKeys[6]

  const raw: Segment[] = items
    .filter((it) => it.endKey >= weekStart && it.startKey <= weekEnd)
    .map((it) => ({
      item: it,
      startCol: it.startKey <= weekStart ? 0 : weekKeys.indexOf(it.startKey),
      endCol: it.endKey >= weekEnd ? 6 : weekKeys.indexOf(it.endKey),
      continuesLeft: it.startKey < weekStart,
      continuesRight: it.endKey > weekEnd,
      lane: -1,
    }))

  // Earliest start first; longer spans first; then a stable tiebreak.
  raw.sort(
    (a, b) =>
      a.startCol - b.startCol ||
      b.endCol - b.startCol - (a.endCol - a.startCol) ||
      a.item.startsAt.localeCompare(b.item.startsAt) ||
      a.item.id.localeCompare(b.item.id),
  )

  const laneEnd: number[] = [] // last occupied column per lane
  for (const seg of raw) {
    let lane = 0
    while (lane < laneEnd.length && laneEnd[lane] >= seg.startCol) lane++
    seg.lane = lane
    laneEnd[lane] = seg.endCol
  }

  const hiddenPerCol = new Array(7).fill(0)
  for (const seg of raw) {
    if (seg.lane >= maxLanes) {
      for (let c = seg.startCol; c <= seg.endCol; c++) hiddenPerCol[c]++
    }
  }

  return { segments: raw.filter((s) => s.lane < maxLanes), hiddenPerCol }
}
