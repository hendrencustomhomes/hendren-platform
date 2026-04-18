'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export async function createInternalUser(email: string, fullName: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const admin = createAdminClient()

  try {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: 'TempPass123!',
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        must_reset_password: true,
      },
    })

    if (error) {
      console.error('CREATE USER ERROR:', error)
      return { error: error.message }
    }

    console.log('CREATE USER SUCCESS:', data)

    return { success: true }
  } catch (e) {
    console.error('CREATE USER CRASH:', e)
    return { error: 'Unexpected error creating user' }
  }
}
