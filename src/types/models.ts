export type ID = string
export type ItemType = 'bookmark' | 'note'
export type NoteColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple' | 'neutral'
export type NoteKind = 'note' | 'task' | 'event'

export interface Bookmark {
  id: ID
  title: string
  url: string
  categoryId: ID
  tagIds: ID[]
  order: number
  createdAt: number
  updatedAt: number
}

export interface Note {
  id: ID
  kind: NoteKind
  title?: string
  body: string
  categoryId: ID
  tagIds: ID[]
  color: NoteColor
  pinned: boolean
  order: number
  // Schedule — floating LOCAL strings, never epoch: 'YYYY-MM-DD' (all-day) or 'YYYY-MM-DDTHH:mm' (timed).
  startsAt?: string // task → due; event → start
  endsAt?: string // events only
  allDay?: boolean
  done?: boolean // tasks
  completedAt?: number // epoch instant when completed
  createdAt: number
  updatedAt: number
}

export interface Category {
  id: ID
  type: ItemType
  name: string
  order: number
  reserved?: boolean
  createdAt: number
  updatedAt: number
}

export interface Tag {
  id: ID
  type: ItemType
  name: string
  createdAt: number
}
