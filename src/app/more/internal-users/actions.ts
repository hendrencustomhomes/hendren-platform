'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { parseStoredRoles, serializeRoles } from '@/lib/permissions'

const TEMP_PASSWORD_LENGTH = 16

type InternalUsersView = 'active' | 'inactive' | 'archived'

function composeAddress(street: string, city: string, state: string, zip: string): string {
  const s = street.trim(), c = city.trim(), st = state.trim(), z = zip.trim()
  const cityStateZip = [c, [st, z].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return [s, cityStateZip].filter(Boolean).join(', ')
}

function splitAddress(address: string | null) {
  if (!address) return { street: '', city: '', state: '', zip: '' }

  const parts = address.split(',').map((p) => p.trim())
  const street = parts[0] || ''
  let city = ''
  let state = ''
  let zip = ''

  if (parts[1]) {
    const cityStateZip = parts[1].split(' ')
    city = cityStateZip.slice(0, -2).join(' ') || parts[1]
    state = cityStateZip[cityStateZip.length - 2] || ''
    zip = cityStateZip[cityStateZip.length - 1] || ''
  }

  return { street, city, state, zip }
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

async function getViewerContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' as const }

  const { data: access, error } = await supabase
    .from('internal_access')
    .select('is_admin, is_active')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (error) return { error: error.message as string }
  if (!access?.is_active) return { error: 'Internal user access required' as const }

  return {
    userId: user.id,
    isAdmin: access.is_admin === true,
  }
}

async function requireAdmin() {
  const viewer = await getViewerContext()
  if ('error' in viewer) return viewer
  if (!viewer.isAdmin) return { error: 'Admin access required' as const }
  return viewer
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

export async function getInternalUsers(view: InternalUsersView = 'active') {
  const viewer = await getViewerContext()
  if ('error' in viewer) return { error: viewer.error }

  const admin = createAdminClient()
  const [authUsersResult, accessResult, profilesResult] = await Promise.all([
    listAllAuthUsers(),
    admin.from('internal_access').select('profile_id, role, is_active, is_admin, archived_at, archived_by'),
    admin.from('profiles').select('id, full_name, phone, address, birthday'),
  ])

  if ('error' in authUsersResult) return { error: authUsersResult.error }
  if (accessResult.error) return { error: accessResult.error.message }
  if (profilesResult.error) return { error: profilesResult.error.message }

  const authUsers = new Map<string, { id: string; email: string | null }>(authUsersResult.users.map((user) => [user.id, user]))
  const profiles = new Map<string, any>((profilesResult.data || []).map((p: any) => [p.id, p]))

  const users = (accessResult.data || [])
    .filter((access: any) => {
      const isArchived = access.archived_at != null
      if (!viewer.isAdmin) {
        return access.is_active === true && !isArchived
      }
      if (view === 'archived') return isArchived
      if (view === 'inactive') return !isArchived && access.is_active !== true
      return !isArchived && access.is_active === true
    })
    .map((access: any) => {
      const profile = profiles.get(access.profile_id)
      const authUser = authUsers.get(access.profile_id)

      return {
        id: access.profile_id,
        email: authUser?.email ?? null,
        fullName: profile?.full_name ?? null,
        phone: profile?.phone ?? null,
        address: profile?.address ?? null,
        addressParts: splitAddress(profile?.address),
        birthday: profile?.birthday ?? null,
        roles: parseStoredRoles(access.role, access.is_admin === true),
        isActive: access.is_active === true,
        archivedAt: access.archived_at ?? null,
      }
    })

  users.sort((a, b) => (a.fullName || a.email || '').localeCompare(b.fullName || b.email || ''))

  return {
    users,
    canManage: viewer.isAdmin,
  }
}

export async function getInternalUser(profileId: string) {
  const viewer = await getViewerContext()
  if ('error' in viewer) return { error: viewer.error }

  const admin = createAdminClient()
  const [authUsersResult, accessResult, profileResult] = await Promise.all([
    listAllAuthUsers(),
    admin
      .from('internal_access')
      .select('profile_id, role, is_active, is_admin, archived_at, archived_by')
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

  if (!viewer.isAdmin && (accessResult.data.is_active !== true || accessResult.data.archived_at != null)) {
    return { error: 'User not found' }
  }

  const authUser = authUsersResult.users.find((user) => user.id === profileId)
  const profile = profileResult.data
  const access = accessResult.data

  return {
    user: {
      id: profileId,
      email: authUser?.email ?? null,
      fullName: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      address: profile?.address ?? null,
      addressParts: splitAddress(profile?.address),
      birthday: profile?.birthday ?? null,
      roles: parseStoredRoles(access.role, access.is_admin === true),
      isActive: access.is_active === true,
      archivedAt: access.archived_at ?? null,
    },
    canManage: viewer.isAdmin,
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
    role: 'viewer',
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
  roles: string[]
  phone: string
  street: string
  city: string
  state: string
  zip: string
  birthday: string
}) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) return { error: adminCheck.error }

  const admin = createAdminClient()
  const { roleValue, isAdmin } = serializeRoles(input.roles as any)

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      full_name: input.fullName.trim(),
      phone: input.phone.trim() || null,
      address: composeAddress(input.street, input.city, input.state, input.zip) || null,
      birthday: input.birthday || null,
    })
    .eq('id', input.profileId)

  if (profileError) return { error: profileError.message }

  const { error: accessError } = await admin
    .from('internal_access')
    .update({
      role: roleValue,
      is_admin: isAdmin,
    })
    .eq('profile_id', input.profileId)

  if (accessError) return { error: accessError.message }

  revalidatePath('/more/internal-users')
  revalidatePath(`/more/internal-users/${input.profileId}`)
  return { success: true }
}

export async function archiveInternalUser(profileId: string) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) return { error: adminCheck.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('internal_access')
    .update({
      archived_at: new Date().toISOString(),
      archived_by: adminCheck.userId,
    })
    .eq('profile_id', profileId)

  if (error) return { error: error.message }

  revalidatePath('/more/internal-users')
  revalidatePath(`/more/internal-users/${profileId}`)
  return { success: true }
}

export async function restoreInternalUser(profileId: string) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) return { error: adminCheck.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('internal_access')
    .update({
      archived_at: null,
      archived_by: null,
    })
    .eq('profile_id', profileId)

  if (error) return { error: error.message }

  revalidatePath('/more/internal-users')
  revalidatePath(`/more/internal-users/${profileId}`)
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

export async function activateInternalUser(profileId: string) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) return { error: adminCheck.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('internal_access')
    .update({ is_active: true })
    .eq('profile_id', profileId)

  if (error) return { error: error.message }

  revalidatePath('/more/internal-users')
  revalidatePath(`/more/internal-users/${profileId}`)
  return { success: true }
}
