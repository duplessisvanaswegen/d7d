import type { SupabaseClient } from '@supabase/supabase-js'
import { useSync, type SyncMode } from './config'
import { createSupabase, signIn, checkSchemaVersion } from './client'

// Cached client for the reconciler; recreated on connect / config change.
let _client: SupabaseClient | null = null

/** The live supabase client if sync is enabled, else null. Reconstructs from
 * stored config (restoring the persisted auth session) on first call after reload. */
export async function getClient(): Promise<SupabaseClient | null> {
  const { config } = useSync.getState()
  if (!config.enabled || !config.url || !config.anonKey) return null
  if (!_client) _client = await createSupabase(config.url, config.anonKey)
  return _client
}

export function clearClient(): void {
  _client = null
}

export interface ConnectParams {
  url: string
  anonKey: string
  mode: SyncMode
  email: string
  password: string
}

export type ConnectResult =
  | { ok: true }
  | { ok: false; error: string; needsSetup?: boolean }

/** Validate creds, sign in (auth mode), verify the schema marker, and — on success —
 * persist config + flip sync on. No data movement here (that is the reconciler). */
export async function connect(p: ConnectParams): Promise<ConnectResult> {
  const url = p.url.trim().replace(/\/+$/, '')
  const anonKey = p.anonKey.trim()
  if (!url || !anonKey) return { ok: false, error: 'Enter your Supabase URL and anon key.' }
  if (p.mode === 'auth' && (!p.email.trim() || !p.password)) {
    return { ok: false, error: 'Enter the email and password for your sync account.' }
  }

  let client: SupabaseClient
  try {
    client = await createSupabase(url, anonKey)
  } catch {
    return { ok: false, error: 'Could not initialise the Supabase client. Check the URL.' }
  }

  if (p.mode === 'auth') {
    const res = await signIn(client, p.email.trim(), p.password)
    if (!res.ok) return { ok: false, error: res.error }
  }

  let check: Awaited<ReturnType<typeof checkSchemaVersion>>
  try {
    check = await checkSchemaVersion(client)
  } catch {
    return { ok: false, error: 'Could not reach Supabase. Check the URL and your connection.' }
  }
  if (check === 'missing' || check === 'older') {
    return { ok: false, needsSetup: true, error: 'Your Supabase project needs the setup SQL (run it below), then reconnect.' }
  }
  if (check === 'newer') {
    return { ok: false, error: 'Your cloud schema is newer than this app. Update d7d first.' }
  }

  _client = client
  useSync.getState().setConfig({ enabled: true, url, anonKey, mode: p.mode, email: p.email.trim() })
  useSync.getState().setStatus('idle')
  return { ok: true }
}

/** Stop sync and clear creds/session from this device. Local Dexie is untouched. */
export async function disconnect(): Promise<void> {
  try {
    if (_client) await _client.auth.signOut()
  } catch {
    // best-effort; we clear locally regardless
  }
  _client = null
  useSync.getState().setConfig({ enabled: false, anonKey: '' })
  useSync.getState().setStatus('off')
}
