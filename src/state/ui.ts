import { create } from 'zustand'
import type { ID } from '@/types/models'

interface UIState {
  bookmarkModal: { open: boolean; editingId: ID | null }
  openAddBookmark: () => void
  openEditBookmark: (id: ID) => void
  closeBookmarkModal: () => void

  collapsedGroups: Set<ID>
  toggleGroup: (id: ID) => void
}

export const useUI = create<UIState>((set) => ({
  bookmarkModal: { open: false, editingId: null },
  openAddBookmark: () => set({ bookmarkModal: { open: true, editingId: null } }),
  openEditBookmark: (id) => set({ bookmarkModal: { open: true, editingId: id } }),
  closeBookmarkModal: () => set({ bookmarkModal: { open: false, editingId: null } }),

  collapsedGroups: new Set<ID>(),
  toggleGroup: (id) =>
    set((s) => {
      const next = new Set(s.collapsedGroups)
      next.has(id) ? next.delete(id) : next.add(id)
      return { collapsedGroups: next }
    }),
}))
