import { useSync } from './config'
import { reconcile } from './reconcile'
import { syncRealtime } from './realtime'
import { onMutation } from './bus'

// Wires the ambient reconcile triggers (tech-spec §6): on focus, on a modest
// interval while open, debounced after a local mutation, and on regaining network.
// reconcile() is single-flight, so overlapping triggers coalesce safely. Everything
// here no-ops while sync is disabled, so the default user is unaffected.

const INTERVAL_MS = 4 * 60_000 // periodic while the tab is open+visible
const DEBOUNCE_MS = 3_000 // coalesce a burst of edits into one push
const BACKOFF_MS = [5_000, 15_000, 60_000, 180_000] // on offline/error

let started = false
let debounceTimer: ReturnType<typeof setTimeout> | undefined
let backoffTimer: ReturnType<typeof setTimeout> | undefined
let backoffIdx = 0

const enabled = () => useSync.getState().config.enabled
const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible'

async function run(): Promise<void> {
  if (!enabled()) return
  clearTimeout(backoffTimer)
  await reconcile()
  const status = useSync.getState().status
  if (status === 'offline' || status === 'error') {
    const delay = BACKOFF_MS[Math.min(backoffIdx++, BACKOFF_MS.length - 1)]
    backoffTimer = setTimeout(() => void run(), delay) // retry; queued ops are never dropped
  } else {
    backoffIdx = 0 // recovered (idle / signed-out both stop the backoff loop)
  }
}

function scheduleDebounced(): void {
  if (!enabled()) return
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => void run(), DEBOUNCE_MS)
}

function onVisibility(): void {
  if (visible()) void run()
}

/** Start the ambient triggers once, at app boot. Safe to call when sync is off. */
export function startSyncTriggers(): void {
  if (started || typeof window === 'undefined') return
  started = true
  onMutation(scheduleDebounced)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('online', () => void run())
  setInterval(() => {
    if (visible()) void run()
  }, INTERVAL_MS)
  syncRealtime() // restore the live subscription if it was left on
}
