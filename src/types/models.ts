export type ID = string
export type ItemType = 'bookmark' | 'note'
export type NoteColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple' | 'neutral'

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
  title?: string
  body: string
  categoryId: ID
  tagIds: ID[]
  color: NoteColor
  pinned: boolean
  order: number
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
