'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { parseStoredRoles, serializeRoles } from '@/lib/permissions'

const TEMP_PASSWORD_LENGTH = 16

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
      .select('profile_id, role, is_active, is_admin'),
    admin
      .from('profiles')
      .select('id, full_name, phone, address, birthday'),
  ])

  if ('error' in authUsersResult) return { error: authUsersResult.error }
  if (accessResult.error) return { error: accessResult.error.message }
  if (profilesResult.error) return { error: profilesResult.error.message }

  const authUsers = new Map(authUsersResult.users.map((user) => [user.id, user]))
  const profiles = new Map((profilesResult.data || []).map((p: any) => [p.id, p]))

  const users = (accessResult.data || []).map((access: any) => {
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
      isActive: access.is_active !== false,
    }
  })

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
      isActive: access.is_active !== false,
    },
  }
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
