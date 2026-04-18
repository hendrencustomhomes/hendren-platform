'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

const TEMP_PASSWORD_LENGTH = 16
const DEFAULT_SITE_URL = 'https://hendren-platform.vercel.app'

function generateTempPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

function normalizeEmail(email: string) {
  return email.toLowerCase().trim()
}

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL
}

export async function createInternalUser(email: string, fullName: string) {
  const normalizedEmail = normalizeEmail(email)
  const normalizedName = fullName.trim()

  if (!normalizedEmail) {
    return { error: 'Email is required.' }
  }

  if (!normalizedName) {
    return { error: 'Full name is required.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: access } = await supabase
    .from('internal_access')
    .select('is_admin, is_active')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!access?.is_admin || !access?.is_active) {
    return { error: 'Admin access required' }
  }

  const admin = createAdminClient()
  const tempPassword = generateTempPassword()

  try {
    const { data, error } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: normalizedName,
        must_reset_password: true,
      },
    })

    if (error) {
      console.error('CREATE USER ERROR:', error)
      return { error: error.message }
    }

    const userId = data.user?.id

    if (!userId) {
      return { error: 'Failed to create user.' }
    }

    const { error: upsertError } = await admin.from('internal_access').upsert({
      profile_id: userId,
      is_admin: false,
      is_active: true,
      role: 'general',
    })

    if (upsertError) {
      console.error('INTERNAL ACCESS UPSERT ERROR:', upsertError)
      return { error: upsertError.message }
    }

    const { error: resetError } = await admin.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${getSiteUrl()}/auth/confirm`,
    })

    if (resetError) {
      console.error('RESET PASSWORD EMAIL ERROR:', resetError)
      return { error: resetError.message }
    }

    return { success: true }
  } catch (e) {
    console.error('CREATE USER CRASH:', e)
    return { error: 'Unexpected error creating user' }
  }
}
