import { create } from 'zustand'
import { forecast } from './api'
import type { Location } from '@/state/settings'

export interface WeatherEntry {
  tempC: number
  code: number
  at: number
}

const KEY = 'd7d.weatherCache'
function load(): Record<string, WeatherEntry> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

interface WeatherState {
  data: Record<string, WeatherEntry>
  loading: boolean
  refresh: (locs: Location[]) => Promise<void>
}

/** Cache-first: last-known values persist to localStorage for offline/stale display. */
export const useWeather = create<WeatherState>((set, get) => ({
  data: load(),
  loading: false,
  refresh: async (locs) => {
    if (!locs.length) return
    set({ loading: true })
    const next = { ...get().data }
    await Promise.all(
      locs.map(async (l) => {
        const w = await forecast(l.lat, l.lon)
        if (w) next[l.id] = { ...w, at: Date.now() }
      }),
    )
    localStorage.setItem(KEY, JSON.stringify(next))
    set({ data: next, loading: false })
  },
}))
