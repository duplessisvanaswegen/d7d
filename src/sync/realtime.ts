import type { RealtimeChannel } from '@supabase/supabase-js'
import { getClient } from './connect'
import { useSync } from './config'
import { emitMutation } from './bus'
import { SYNC_TABLES } from './constants'

// Optional bonus (tech-spec §6): a postgres_changes subscription that nudges a
// (debounced) reconcile whenever the cloud changes, for live device-to-device
// updates. Off by default — interval + focus already cover the common case.

let channel: RealtimeChannel | null = null

async function startRealtime(): Promise<void> {
  if (channel) return
  const client = await getClient()
  if (!client) return
  const ch = client.channel('d7d-sync')
  for (const t of SYNC_TABLES) {
    ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => emitMutation())
  }
  ch.subscribe()
  channel = ch
}

async function stopRealtime(): Promise<void> {
  if (!channel) return
  const client = await getClient()
  await client?.removeChannel(channel)
  channel = null
}

/** Reconcile the live subscription with current config (enabled + realtime toggle). */
export function syncRealtime(): void {
  const { config } = useSync.getState()
  if (config.enabled && config.realtime) void startRealtime()
  else void stopRealtime()
}
