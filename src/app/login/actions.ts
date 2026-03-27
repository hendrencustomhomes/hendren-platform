'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function checkEmailType(email: string): Promise<'internal' | 'external'> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('is_internal_email', { p_email: email.toLowerCase().trim() })
  if (error || !data) return 'external'
  return data === true ? 'internal' : 'external'
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password,
  })
  if (error) return { error: error.message }
  redirect('/')
}

export async function signInWithMagicLink(email: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: email.toLowerCase().trim(),
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://hendren-platform.vercel.app'}/auth/confirm`,
    },
  })
  if (error) return { error: error.message }
  return { success: true }
}
