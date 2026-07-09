import { create } from 'zustand'

let seq = 0

export interface Toast {
  id: number
  message: string
  actionLabel?: string
  onAction?: () => void
}

interface ToastState {
  toasts: Toast[]
  add: (t: Omit<Toast, 'id'>) => void
  remove: (id: number) => void
}

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  add: (t) => set((s) => ({ toasts: [...s.toasts, { ...t, id: ++seq }] })),
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

export const toast = (t: Omit<Toast, 'id'>) => useToasts.getState().add(t)
