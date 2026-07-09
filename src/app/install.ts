import { create } from 'zustand'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: string }>
}

let deferred: BeforeInstallPromptEvent | null = null

interface InstallState {
  available: boolean
  setEvent: (e: BeforeInstallPromptEvent) => void
  markInstalled: () => void
  prompt: () => Promise<void>
}

export const useInstall = create<InstallState>((set) => ({
  available: false,
  setEvent: (e) => {
    deferred = e
    set({ available: true })
  },
  markInstalled: () => {
    deferred = null
    set({ available: false })
  },
  prompt: async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    deferred = null
    set({ available: false })
  },
}))

export function initInstall(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    useInstall.getState().setEvent(e as BeforeInstallPromptEvent)
  })
  window.addEventListener('appinstalled', () => useInstall.getState().markInstalled())
}
