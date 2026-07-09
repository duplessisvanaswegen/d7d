import { create } from 'zustand'
import type { ID, NoteKind } from '@/types/models'

/** Seed values for a brand-new note (e.g. created from a calendar day). */
export interface NotePrefill {
  kind?: NoteKind
  startDate?: string // 'YYYY-MM-DD'
}

interface UIState {
  bookmarkModal: { open: boolean; editingId: ID | null }
  openAddBookmark: () => void
  openEditBookmark: (id: ID) => void
  closeBookmarkModal: () => void

  noteModal: { open: boolean; editingId: ID | null; prefill?: NotePrefill }
  openAddNote: (prefill?: NotePrefill) => void
  openEditNote: (id: ID) => void
  closeNoteModal: () => void

  view: 'home' | 'calendar'
  setView: (v: 'home' | 'calendar') => void

  query: string
  setQuery: (q: string) => void

  optionsOpen: boolean
  openOptions: () => void
  closeOptions: () => void

  mobileTab: 'bookmarks' | 'notes'
  setMobileTab: (t: 'bookmarks' | 'notes') => void

  selection: { mode: 'bookmark' | 'note' | null; ids: Set<ID> }
  enterSelect: (mode: 'bookmark' | 'note') => void
  toggleSelected: (id: ID) => void
  clearSelect: () => void

  collapsedGroups: Set<ID>
  toggleGroup: (id: ID) => void
}

export const useUI = create<UIState>((set) => ({
  bookmarkModal: { open: false, editingId: null },
  openAddBookmark: () => set({ bookmarkModal: { open: true, editingId: null } }),
  openEditBookmark: (id) => set({ bookmarkModal: { open: true, editingId: id } }),
  closeBookmarkModal: () => set({ bookmarkModal: { open: false, editingId: null } }),

  noteModal: { open: false, editingId: null },
  openAddNote: (prefill) => set({ noteModal: { open: true, editingId: null, prefill } }),
  openEditNote: (id) => set({ noteModal: { open: true, editingId: id } }),
  closeNoteModal: () => set({ noteModal: { open: false, editingId: null } }),

  view: 'home',
  setView: (v) => set({ view: v }),

  query: '',
  setQuery: (q) => set({ query: q }),

  optionsOpen: false,
  openOptions: () => set({ optionsOpen: true }),
  closeOptions: () => set({ optionsOpen: false }),

  mobileTab: 'bookmarks',
  setMobileTab: (t) => set({ mobileTab: t }),

  selection: { mode: null, ids: new Set<ID>() },
  enterSelect: (mode) => set({ selection: { mode, ids: new Set<ID>() } }),
  toggleSelected: (id) =>
    set((s) => {
      const ids = new Set(s.selection.ids)
      ids.has(id) ? ids.delete(id) : ids.add(id)
      return { selection: { ...s.selection, ids } }
    }),
  clearSelect: () => set({ selection: { mode: null, ids: new Set<ID>() } }),

  collapsedGroups: new Set<ID>(),
  toggleGroup: (id) =>
    set((s) => {
      const next = new Set(s.collapsedGroups)
      next.has(id) ? next.delete(id) : next.add(id)
      return { collapsedGroups: next }
    }),
}))
