import { create } from 'zustand'
import { uid } from '@/lib/id'

export type OpenLinks = 'new' | 'same'
export type TempUnit = 'c' | 'f'
export type ClockFormat = '24' | '12'

export interface Location {
  id: string
  label: string
  lat: number
  lon: number
  timezone: string
}

export interface Prefs {
  faviconFetch: boolean
  openLinks: OpenLinks
  weatherUnits: TempUnit
  clockFormat: ClockFormat
  refreshMins: number
  locations: Location[]
}

const KEY = 'd7d.prefs'
const DEFAULTS: Prefs = {
  faviconFetch: true,
  openLinks: 'new',
  weatherUnits: 'c',
  clockFormat: '24',
  refreshMins: 30,
  locations: [],
}

export function loadPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}
function persist(p: Prefs) {
  localStorage.setItem(KEY, JSON.stringify(p))
}

interface SettingsState extends Prefs {
  setFaviconFetch: (v: boolean) => void
  setOpenLinks: (v: OpenLinks) => void
  setWeatherUnits: (v: TempUnit) => void
  setClockFormat: (v: ClockFormat) => void
  setRefreshMins: (v: number) => void
  addLocation: (l: Omit<Location, 'id'>) => void
  removeLocation: (id: string) => void
  hydrate: (p: Partial<Prefs>) => void
}

function prefsOf(s: Prefs): Prefs {
  return {
    faviconFetch: s.faviconFetch,
    openLinks: s.openLinks,
    weatherUnits: s.weatherUnits,
    clockFormat: s.clockFormat,
    refreshMins: s.refreshMins,
    locations: s.locations,
  }
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...loadPrefs(),
  setFaviconFetch: (v) => set(commit(get, { faviconFetch: v })),
  setOpenLinks: (v) => set(commit(get, { openLinks: v })),
  setWeatherUnits: (v) => set(commit(get, { weatherUnits: v })),
  setClockFormat: (v) => set(commit(get, { clockFormat: v })),
  setRefreshMins: (v) => set(commit(get, { refreshMins: v })),
  addLocation: (l) => set(commit(get, { locations: [...get().locations, { ...l, id: uid() }] })),
  removeLocation: (id) => set(commit(get, { locations: get().locations.filter((x) => x.id !== id) })),
  hydrate: (p) => set(commit(get, p)),
}))

function commit(get: () => SettingsState, patch: Partial<Prefs>): Partial<Prefs> {
  const next = { ...prefsOf(get()), ...patch }
  persist(next)
  return patch
}
