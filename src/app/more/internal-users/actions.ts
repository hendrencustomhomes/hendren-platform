'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

const TEMP_PASSWORD_LENGTH = 16

type AccessRow = {
  profile_id: string
  role: string | null
  is_active: boolean | null
  is_admin: boolean | null
}

type ProfileRow = {
  id: string
  full_name: string | null
  phone: string | null
  address: string | null
  birthday: string | null
}

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

async function requireAdmin() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' as const }

  const { data: access } = await supabase
    .from('internal_access')
    .select('is_admin, is_active')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!access?.is_admin || !access?.is_active) {
    return { error: 'Admin access required' as const }
  }

  return { userId: user.id }
}

async function listAllAuthUsers() {
  const admin = createAdminClient()
  const users: Array<{ id: string; email: string | null }> = []
  let page = 1

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (error) return { error: error.message as string }

    const batch = data?.users ?? []
    users.push(...batch.map((user) => ({ id: user.id, email: user.email ?? null })))

    if (batch.length < 100) break
    page += 1
  }

  return { users }
}

export async function getInternalUsers() {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) return { error: adminCheck.error }

  const admin = createAdminClient()
  const [authUsersResult, accessResult, profilesResult] = await Promise.all([
    listAllAuthUsers(),
    admin
      .from('internal_access')
      .select('profile_id, role, is_active, is_admin')
      .order('profile_id', { ascending: true }),
    admin
      .from('profiles')
      .select('id, full_name, phone, address, birthday')
      .order('full_name', { ascending: true }),
  ])

  if ('error' in authUsersResult) return { error: authUsersResult.error }
  if (accessResult.error) return { error: accessResult.error.message }
  if (profilesResult.error) return { error: profilesResult.error.message }

  const authUsers = new Map(authUsersResult.users.map((user) => [user.id, user]))
  const profiles = new Map(((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]))

  const users = ((accessResult.data ?? []) as AccessRow[]).map((access) => {
    const profile = profiles.get(access.profile_id)
    const authUser = authUsers.get(access.profile_id)

    return {
      id: access.profile_id,
      email: authUser?.email ?? null,
      fullName: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      address: profile?.address ?? null,
      birthday: profile?.birthday ?? null,
      role: access.role ?? 'general',
      isActive: access.is_active !== false,
      isAdmin: access.is_admin === true,
    }
  })

  users.sort((a, b) => (a.fullName || a.email || '').localeCompare(b.fullName || b.email || ''))

  return { users }
}

export async function getInternalUser(profileId: string) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) return { error: adminCheck.error }

  const admin = createAdminClient()
  const [authUsersResult, accessResult, profileResult] = await Promise.all([
    listAllAuthUsers(),
    admin
      .from('internal_access')
      .select('profile_id, role, is_active, is_admin')
      .eq('profile_id', profileId)
      .maybeSingle(),
    admin
      .from('profiles')
      .select('id, full_name, phone, address, birthday')
      .eq('id', profileId)
      .maybeSingle(),
  ])

  if ('error' in authUsersResult) return { error: authUsersResult.error }
  if (accessResult.error) return { error: accessResult.error.message }
  if (profileResult.error) return { error: profileResult.error.message }
  if (!accessResult.data) return { error: 'User not found' }

  const authUser = authUsersResult.users.find((user) => user.id === profileId)
  const profile = profileResult.data as ProfileRow | null
  const access = accessResult.data as AccessRow

  return {
    user: {
      id: profileId,
      email: authUser?.email ?? null,
      fullName: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      address: profile?.address ?? null,
      birthday: profile?.birthday ?? null,
      role: access.role ?? 'general',
      isActive: access.is_active !== false,
      isAdmin: access.is_admin === true,
    },
  }
}

export async function createInternalUser(email: string, fullName: string) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) return { error: adminCheck.error }

  const admin = createAdminClient()
  const tempPassword = generateTempPassword()
  const normalizedEmail = normalizeEmail(email)
  const trimmedName = fullName.trim()

  const { data, error } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: trimmedName,
      must_reset_password: true,
    },
  })

  if (error) return { error: error.message }

  const userId = data.user?.id
  if (!userId) return { error: 'Failed to create user' }

  const { error: upsertError } = await admin.from('internal_access').upsert({
    profile_id: userId,
    is_admin: false,
    is_active: true,
    role: 'general',
  })

  if (upsertError) return { error: upsertError.message }

  revalidatePath('/more/internal-users')

  const { error: resetError } = await admin.auth.resetPasswordForEmail(normalizedEmail)

  if (resetError) {
    return {
      success: true,
      warning: 'User created but email failed',
      email: normalizedEmail,
    }
  }

  return { success: true, email: normalizedEmail }
}

export async function resendResetEmail(email: string) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) return { error: adminCheck.error }

  const admin = createAdminClient()
  const { error } = await admin.auth.resetPasswordForEmail(normalizeEmail(email))
  if (error) return { error: error.message }
  return { success: true }
}

export async function generateResetLink(email: string) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) return { error: adminCheck.error }

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: normalizeEmail(email),
  })

  if (error) return { error: error.message }

  return { link: data?.properties?.action_link ?? null }
}

export async function updateInternalUser(input: {
  profileId: string
  fullName: string
  role: string
  isAdmin: boolean
  phone: string
  address: string
  birthday: string
}) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) return { error: adminCheck.error }

  const admin = createAdminClient()

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      full_name: input.fullName.trim(),
      phone: input.phone.trim() || null,
      address: input.address.trim() || null,
      birthday: input.birthday || null,
    })
    .eq('id', input.profileId)

  if (profileError) return { error: profileError.message }

  const { error: accessError } = await admin
    .from('internal_access')
    .update({
      role: input.role.trim() || 'general',
      is_admin: input.isAdmin,
    })
    .eq('profile_id', input.profileId)

  if (accessError) return { error: accessError.message }

  revalidatePath('/more/internal-users')
  revalidatePath(`/more/internal-users/${input.profileId}`)

  return { success: true }
}

export async function deactivateInternalUser(profileId: string) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) return { error: adminCheck.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('internal_access')
    .update({ is_active: false })
    .eq('profile_id', profileId)

  if (error) return { error: error.message }

  revalidatePath('/more/internal-users')
  revalidatePath(`/more/internal-users/${profileId}`)

  return { success: true }
}
