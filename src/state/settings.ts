import { create } from 'zustand'

export type OpenLinks = 'new' | 'same'
export interface Prefs {
  faviconFetch: boolean
  openLinks: OpenLinks
}

const KEY = 'd7d.prefs'
const DEFAULTS: Prefs = { faviconFetch: true, openLinks: 'new' }

export function loadPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}
function save(p: Prefs) {
  localStorage.setItem(KEY, JSON.stringify(p))
}

interface SettingsState extends Prefs {
  setFaviconFetch: (v: boolean) => void
  setOpenLinks: (v: OpenLinks) => void
  hydrate: (p: Prefs) => void
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...loadPrefs(),
  setFaviconFetch: (v) => {
    set({ faviconFetch: v })
    save({ faviconFetch: v, openLinks: get().openLinks })
  },
  setOpenLinks: (v) => {
    set({ openLinks: v })
    save({ faviconFetch: get().faviconFetch, openLinks: v })
  },
  hydrate: (p) => {
    set(p)
    save(p)
  },
}))
