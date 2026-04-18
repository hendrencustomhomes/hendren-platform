'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

const MIN_LENGTH = 10
const MAX_LENGTH = 64

export async function updatePassword(password: string) {
  if (password.length < MIN_LENGTH) {
    return { error: `Password must be at least ${MIN_LENGTH} characters.` }
  }

  if (password.length > MAX_LENGTH) {
    return { error: `Password must be ${MAX_LENGTH} characters or fewer.` }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated.' }
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: error.message }
  }

  await supabase
    .from('internal_access')
    .update({ must_reset_password: false })
    .eq('profile_id', user.id)

  redirect('/')
}
