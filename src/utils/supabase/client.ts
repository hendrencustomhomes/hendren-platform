import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.SUPABASE_URL_OVERRIDE || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY_OVERRIDE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
