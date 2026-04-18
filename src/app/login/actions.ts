'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

const DEFAULT_SITE_URL = 'https://hendren-platform.vercel.app'

function normalizeEmail(email: string) {
  return email.toLowerCase().trim()
}

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  })

  if (error) return { error: error.message }

  redirect('/')
}

export async function requestPasswordReset(email: string) {
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail) {
    return { error: 'Enter your email first.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: `${getSiteUrl()}/auth/confirm?next=/reset-password`,
  })

  if (error) return { error: error.message }

  return { success: true }
}
