'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { type PermissionRowKey, type PermissionTemplateKey } from '@/lib/access-control'
import {
  getAccessControlCatalog,
  getTemplatePermissions,
  getUserAccessModel,
  saveTemplatePermissionMatrix,
  saveUserAccessModel,
} from '@/lib/access-control-server'

async function requireAdmin() {
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
  if (access.is_admin !== true) return { error: 'Admin access required' as const }

  return { userId: user.id }
}

export async function getAccessControlCatalogAction() {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) return { error: adminCheck.error }
  return getAccessControlCatalog()
}

export async function getInternalUserAccessEditor(profileId: string) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) return { error: adminCheck.error }

  const result = await getUserAccessModel(profileId)
  if ('error' in result) return result

  if (!result.selectedTemplate) {
    return {
      ...result,
      workflowKeys: [],
    }
  }

  return result
}

export async function saveInternalUserAccessEditor(input: {
  profileId: string
  templateKey: PermissionTemplateKey
  workflowKeys: string[]
  permissions: Array<{ rowKey: PermissionRowKey; canView: boolean; canManage: boolean; canAssign: boolean }>
}) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) return { error: adminCheck.error }

  const result = await saveUserAccessModel(input)
  if ('error' in result) return result

  revalidatePath('/more/internal-users')
  revalidatePath(`/more/internal-users/${input.profileId}`)
  return { success: true }
}

export async function getPermissionTemplateManagerAction() {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) return { error: adminCheck.error }

  const result = await getTemplatePermissions()
  if ('error' in result) return { error: result.error }

  return {
    templates: result.templates,
    permissionRows: result.permissionRows,
    workflowRoles: result.workflowRoles,
    templatePermissions: Object.fromEntries(result.templatePermissions),
  }
}

export async function savePermissionTemplateAction(input: {
  templateKey: PermissionTemplateKey
  permissions: Array<{ rowKey: PermissionRowKey; canView: boolean; canManage: boolean; canAssign: boolean }>
}) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) return { error: adminCheck.error }

  const result = await saveTemplatePermissionMatrix(input)
  if ('error' in result) return result

  revalidatePath('/more/internal-users/templates')
  return { success: true }
}
