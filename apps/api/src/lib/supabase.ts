import { createClient } from '@supabase/supabase-js'

// Called once per Worker request — createClient is lightweight
export function getSupabase(env: { SUPABASE_URL: string; SUPABASE_ANON_KEY: string }) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
}
