'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

const TEMP_PASSWORD_LENGTH = 16

function generateTempPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

export async function createInternalUser(email: string, fullName: string) {
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

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      must_reset_password: true,
    },
  })

  if (createError) {
    return { error: createError.message }
  }

  const userId = created.user?.id

  if (!userId) {
    return { error: 'Failed to create user' }
  }

  await admin.from('internal_access').upsert({
    profile_id: userId,
    is_admin: false,
    is_active: true,
    role: 'general',
  })

  await admin.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://hendren-platform.vercel.app'}/auth/confirm?next=/reset-password`,
  })

  return {
    success: true,
    tempPassword,
  }
}
