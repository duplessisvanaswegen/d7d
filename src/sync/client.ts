import type { SupabaseClient } from '@supabase/supabase-js'
import { CLOUD_SCHEMA_VERSION } from './constants'

// supabase-js is lazy-loaded via dynamic import() so the default (sync-off) user
// never pays for it — this whole module is only reached once sync is enabled.

export async function createSupabase(url: string, anonKey: string): Promise<SupabaseClient> {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'd7d.sync.sb-auth',
    },
  })
}

export type SignInResult = { ok: true } | { ok: false; error: string }

/** Sign in with email + password (default mode). First connect has no user yet,
 * so a failed sign-in falls back to sign-up (email confirmation is disabled in the
 * setup, so sign-up returns a live session immediately). */
export async function signIn(client: SupabaseClient, email: string, password: string): Promise<SignInResult> {
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (!error) return { ok: true }

  // Unknown user on first connect → create the single-user account, then it's signed in.
  const signUp = await client.auth.signUp({ email, password })
  if (signUp.error) return { ok: false, error: signUp.error.message }
  if (!signUp.data.session) {
    return {
      ok: false,
      error: 'Account created but email confirmation is on. Disable "Confirm email" in Supabase → Authentication → Providers → Email, then reconnect.',
    }
  }
  return { ok: true }
}

export type SchemaCheck = 'ok' | 'missing' | 'older' | 'newer'

/** Confirm the cloud schema marker matches what this app build expects. */
export async function checkSchemaVersion(client: SupabaseClient): Promise<SchemaCheck> {
  const { data, error } = await client.from('sync_meta').select('value').eq('key', 'schema_version').maybeSingle()
  if (error || !data) return 'missing' // table absent or marker row not written yet
  const v = Number(data.value)
  if (v === CLOUD_SCHEMA_VERSION) return 'ok'
  return v < CLOUD_SCHEMA_VERSION ? 'older' : 'newer'
}
