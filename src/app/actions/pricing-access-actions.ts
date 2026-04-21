'use server'

import { normalizePermissionState, type PermissionRowKey } from '@/lib/access-control'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

type SupportedPricingPermissionRowKey = Extract<PermissionRowKey, 'pricing_sources' | 'bids'>

export async function getCurrentPricingAccess(rowKey: SupportedPricingPermissionRowKey) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      canView: false,
      canManage: false,
      canAssign: false,
      error: 'Not authenticated' as const,
    }
  }

  const admin = createAdminClient()

  const { data: access, error: accessError } = await admin
    .from('internal_access')
    .select('permission_template_id, is_active')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (accessError) {
    return {
      canView: false,
      canManage: false,
      canAssign: false,
      error: accessError.message,
    }
  }

  if (!access?.is_active) {
    return {
      canView: false,
      canManage: false,
      canAssign: false,
      error: 'Internal user access required' as const,
    }
  }

  const { data: permissionRow, error: rowError } = await admin
    .from('permission_rows')
    .select('id')
    .eq('key', rowKey)
    .maybeSingle()

  if (rowError) {
    return {
      canView: false,
      canManage: false,
      canAssign: false,
      error: rowError.message,
    }
  }

  if (!permissionRow?.id) {
    return {
      canView: false,
      canManage: false,
      canAssign: false,
      error: 'Permission row not found' as const,
    }
  }

  const { data: snapshot, error: snapshotError } = await admin
    .from('user_permission_snapshots')
    .select('can_view, can_manage, can_assign')
    .eq('profile_id', user.id)
    .eq('permission_row_id', permissionRow.id)
    .maybeSingle()

  if (snapshotError) {
    return {
      canView: false,
      canManage: false,
      canAssign: false,
      error: snapshotError.message,
    }
  }

  if (snapshot) {
    return normalizePermissionState(rowKey, snapshot)
  }

  if (access.permission_template_id) {
    const { data: templatePermission, error: templateError } = await admin
      .from('template_permissions')
      .select('can_view, can_manage, can_assign')
      .eq('permission_template_id', access.permission_template_id)
      .eq('permission_row_id', permissionRow.id)
      .maybeSingle()

    if (templateError) {
      return {
        canView: false,
        canManage: false,
        canAssign: false,
        error: templateError.message,
      }
    }

    if (templatePermission) {
      return normalizePermissionState(rowKey, templatePermission)
    }
  }

  return normalizePermissionState(rowKey, {
    canView: false,
    canManage: false,
    canAssign: false,
  })
}
