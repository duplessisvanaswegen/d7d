import { create } from 'zustand'

// ── Sync config + status (device-local, never synced) ────────────────────────
// Persisted in localStorage (creds/session + per-table cursors). No Dexie table
// for config — it is single-device, single-row state and needs no migration.
// (Tech-spec §12 left this open: chosen localStorage over a Dexie row for simplicity.)

export type SyncMode = 'auth' | 'simple'
export type SyncStatus =
  | 'off' // sync disabled (default)
  | 'idle' // enabled, nothing in flight
  | 'syncing' // reconcile in progress
  | 'offline' // network unreachable, queued
  | 'error' // last reconcile failed (non-auth)
  | 'signed-out' // auth session lost/unrefreshable — needs re-sign-in

export interface SyncConfig {
  enabled: boolean
  url: string
  anonKey: string
  mode: SyncMode
  email: string // auth mode only; shown in the tab, not a secret
  realtime: boolean
  /** False until the first reconcile has union-merged local ⇄ cloud (additive). */
  bootstrapped: boolean
}

const CONFIG_KEY = 'd7d.sync.config'
const CURSORS_KEY = 'd7d.sync.cursors'
const LASTSYNC_KEY = 'd7d.sync.lastSync'

const DEFAULT_CONFIG: SyncConfig = {
  enabled: false,
  url: '',
  anonKey: '',
  mode: 'auth',
  email: '',
  realtime: false,
  bootstrapped: false,
}

function loadConfig(): SyncConfig {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(CONFIG_KEY) ?? '{}') }
  } catch {
    return DEFAULT_CONFIG
  }
}

function saveConfig(c: SyncConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(c))
}

// Module-level mirror of `enabled` so the outbox enqueue (a hot path inside Dexie
// transactions) can gate synchronously without touching the store/localStorage.
let _enabled = loadConfig().enabled
/** Synchronous, cheap gate used by the outbox enqueue choke-point. */
export function syncEnabled(): boolean {
  return _enabled
}

// ── Per-table pull cursors: compound (updated_at, id) keyset ──────────────────
export interface Cursor {
  ts: string // ISO timestamptz of the last applied row
  id: string
}
export type Cursors = Partial<Record<string, Cursor>>

export function loadCursors(): Cursors {
  try {
    return JSON.parse(localStorage.getItem(CURSORS_KEY) ?? '{}')
  } catch {
    return {}
  }
}
export function saveCursor(table: string, cursor: Cursor): void {
  const all = loadCursors()
  all[table] = cursor
  localStorage.setItem(CURSORS_KEY, JSON.stringify(all))
}
export function clearCursors(): void {
  localStorage.removeItem(CURSORS_KEY)
}

export function loadLastSync(): number | null {
  const v = localStorage.getItem(LASTSYNC_KEY)
  return v ? Number(v) : null
}
export function saveLastSync(ts: number): void {
  localStorage.setItem(LASTSYNC_KEY, String(ts))
}

// ── Store ─────────────────────────────────────────────────────────────────────
interface SyncState {
  config: SyncConfig
  status: SyncStatus
  lastSyncAt: number | null
  lastError: string | null
  /** Rewrite config (persisting) and keep the enabled-mirror in sync. */
  setConfig: (patch: Partial<SyncConfig>) => void
  setStatus: (status: SyncStatus, error?: string | null) => void
  setLastSyncAt: (ts: number) => void
}

export const useSync = create<SyncState>((set, get) => ({
  config: loadConfig(),
  status: loadConfig().enabled ? 'idle' : 'off',
  lastSyncAt: loadLastSync(),
  lastError: null,
  setConfig: (patch) => {
    const config = { ...get().config, ...patch }
    saveConfig(config)
    _enabled = config.enabled
    set({ config })
  },
  setStatus: (status, error = null) => set({ status, lastError: error }),
  setLastSyncAt: (ts) => {
    saveLastSync(ts)
    set({ lastSyncAt: ts })
  },
}))
