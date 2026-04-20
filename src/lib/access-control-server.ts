import { createAdminClient } from '@/utils/supabase/admin'
import {
  buildDefaultPermissionMatrix,
  deriveLegacyRoleState,
  getNormalizedKey,
  getNormalizedLabel,
  isPermissionRowKey,
  isPermissionTemplateKey,
  isWorkflowRoleKey,
  mergeWorkflowEligibility,
  normalizePermissionState,
  PERMISSION_ROW_KEYS,
  PERMISSION_ROW_LABELS,
  sortPermissionRows,
  type PermissionMatrixCell,
  type PermissionRowKey,
  type PermissionRowRecord,
  type PermissionTemplateKey,
  type PermissionTemplateRecord,
  type WorkflowRoleKey,
  type WorkflowRoleRecord,
} from './access-control'

function mapTemplateRecord(record: any): PermissionTemplateRecord | null {
  const key = getNormalizedKey(record)
  if (!isPermissionTemplateKey(key)) return null
  return {
    id: String(record.id),
    key,
    label: getNormalizedLabel(record, key),
  }
}

function mapWorkflowRoleRecord(record: any): WorkflowRoleRecord | null {
  const key = getNormalizedKey(record)
  if (!isWorkflowRoleKey(key)) return null
  return {
    id: String(record.id),
    key,
    label: getNormalizedLabel(record, key),
  }
}

function mapPermissionRowRecord(record: any): PermissionRowRecord | null {
  const key = getNormalizedKey(record)
  if (!isPermissionRowKey(key)) return null
  return {
    id: String(record.id),
    key,
    label: getNormalizedLabel(record, key),
  }
}

export async function getAccessControlCatalog() {
  const admin = createAdminClient()
  const [templatesResult, workflowsResult, rowsResult] = await Promise.all([
    admin.from('permission_templates').select('*'),
    admin.from('workflow_roles').select('*'),
    admin.from('permission_rows').select('*'),
  ])

  if (templatesResult.error) return { error: templatesResult.error.message as string }
  if (workflowsResult.error) return { error: workflowsResult.error.message as string }
  if (rowsResult.error) return { error: rowsResult.error.message as string }

  const templates = (templatesResult.data || [])
    .map(mapTemplateRecord)
    .filter((value): value is PermissionTemplateRecord => value != null)
    .sort((a, b) => a.label.localeCompare(b.label))

  const workflowRoles = (workflowsResult.data || [])
    .map(mapWorkflowRoleRecord)
    .filter((value): value is WorkflowRoleRecord => value != null)
    .sort((a, b) => a.label.localeCompare(b.label))

  const permissionRows = sortPermissionRows(
    (rowsResult.data || [])
      .map(mapPermissionRowRecord)
      .filter((value): value is PermissionRowRecord => value != null)
  )

  return {
    templates,
    workflowRoles,
    permissionRows,
  }
}

export async function getTemplatePermissions() {
  const catalog = await getAccessControlCatalog()
  if ('error' in catalog) return { error: catalog.error }

  const admin = createAdminClient()
  const result = await admin.from('template_permissions').select('*')
  if (result.error) return { error: result.error.message as string }

  const templateById = new Map(catalog.templates.map((template) => [template.id, template]))
  const rowById = new Map(catalog.permissionRows.map((row) => [row.id, row]))

  const rows = new Map<string, PermissionMatrixCell[]>()

  for (const template of catalog.templates) {
    rows.set(template.key, buildDefaultPermissionMatrix())
  }

  for (const record of result.data || []) {
    const template = templateById.get(String(record.permission_template_id))
    const row = rowById.get(String(record.permission_row_id))
    if (!template || !row) continue

    const current = rows.get(template.key) || buildDefaultPermissionMatrix()
    const next = current.map((cell) =>
      cell.rowKey === row.key
        ? { rowKey: row.key, ...normalizePermissionState(row.key, record) }
        : cell
    )
    rows.set(template.key, next)
  }

  return {
    templates: catalog.templates,
    permissionRows: catalog.permissionRows,
    workflowRoles: catalog.workflowRoles,
    templatePermissions: rows,
  }
}

export async function getUserAccessModel(profileId: string) {
  const catalog = await getAccessControlCatalog()
  if ('error' in catalog) return { error: catalog.error }

  const admin = createAdminClient()
  const [accessResult, workflowsResult, snapshotsResult, templatePermissionsResult] = await Promise.all([
    admin
      .from('internal_access')
      .select('profile_id, permission_template_id, role, is_admin, is_active, archived_at, archived_by')
      .eq('profile_id', profileId)
      .maybeSingle(),
    admin
      .from('user_workflow_eligibility')
      .select('workflow_role_id')
      .eq('profile_id', profileId),
    admin
      .from('user_permission_snapshots')
      .select('*')
      .eq('profile_id', profileId),
    admin
      .from('template_permissions')
      .select('*'),
  ])

  if (accessResult.error) return { error: accessResult.error.message as string }
  if (workflowsResult.error) return { error: workflowsResult.error.message as string }
  if (snapshotsResult.error) return { error: snapshotsResult.error.message as string }
  if (templatePermissionsResult.error) return { error: templatePermissionsResult.error.message as string }

  const templateById = new Map(catalog.templates.map((template) => [template.id, template]))
  const workflowById = new Map(catalog.workflowRoles.map((workflow) => [workflow.id, workflow]))
  const rowById = new Map(catalog.permissionRows.map((row) => [row.id, row]))

  const access = accessResult.data
  const selectedTemplate = access?.permission_template_id ? templateById.get(String(access.permission_template_id)) ?? null : null

  const workflowKeys = (workflowsResult.data || [])
    .map((record: any) => workflowById.get(String(record.workflow_role_id))?.key ?? null)
    .filter((value): value is WorkflowRoleKey => value != null)

  const snapshotRows = new Map<PermissionRowKey, PermissionMatrixCell>()

  for (const record of snapshotsResult.data || []) {
    const row = rowById.get(String(record.permission_row_id))
    if (!row) continue
    snapshotRows.set(row.key, {
      rowKey: row.key,
      ...normalizePermissionState(row.key, record),
    })
  }

  if (snapshotRows.size === 0 && selectedTemplate) {
    for (const record of templatePermissionsResult.data || []) {
      if (String(record.permission_template_id) !== selectedTemplate.id) continue
      const row = rowById.get(String(record.permission_row_id))
      if (!row) continue
      snapshotRows.set(row.key, {
        rowKey: row.key,
        ...normalizePermissionState(row.key, record),
      })
    }
  }

  const permissionSnapshot = PERMISSION_ROW_KEYS.map((rowKey) => {
    return snapshotRows.get(rowKey) || {
      rowKey,
      ...normalizePermissionState(rowKey, { canView: false, canManage: false, canAssign: false }),
    }
  })

  return {
    selectedTemplate,
    workflowKeys: mergeWorkflowEligibility(selectedTemplate?.key || 'media', workflowKeys).filter(isWorkflowRoleKey),
    permissionSnapshot,
    templates: catalog.templates,
    workflowRoles: catalog.workflowRoles,
    permissionRows: catalog.permissionRows,
  }
}

export async function saveUserAccessModel(input: {
  profileId: string
  templateKey: PermissionTemplateKey
  workflowKeys: string[]
  permissions: Array<{ rowKey: PermissionRowKey; canView: boolean; canManage: boolean; canAssign: boolean }>
}) {
  const catalog = await getAccessControlCatalog()
  if ('error' in catalog) return { error: catalog.error }

  const admin = createAdminClient()
  const template = catalog.templates.find((record) => record.key === input.templateKey)
  if (!template) return { error: 'Permission template not found' }

  const workflowKeys = mergeWorkflowEligibility(input.templateKey, input.workflowKeys)
  const { isAdmin, roleValue } = deriveLegacyRoleState(input.templateKey, workflowKeys)

  const workflowRoleIds = catalog.workflowRoles
    .filter((record) => workflowKeys.includes(record.key))
    .map((record) => record.id)

  const rowByKey = new Map(catalog.permissionRows.map((row) => [row.key, row]))
  const normalizedPermissions = PERMISSION_ROW_KEYS.map((rowKey) => {
    const found = input.permissions.find((row) => row.rowKey === rowKey)
    return {
      rowKey,
      ...normalizePermissionState(rowKey, found || { canView: false, canManage: false, canAssign: false }),
    }
  })

  const snapshotRows = normalizedPermissions.map((row) => {
    const permissionRow = rowByKey.get(row.rowKey)
    if (!permissionRow) return null
    return {
      profile_id: input.profileId,
      permission_row_id: permissionRow.id,
      can_view: row.canView,
      can_manage: row.canManage,
      can_assign: row.canAssign,
    }
  }).filter(Boolean) as any[]

  const workflowRows = workflowRoleIds.map((workflowRoleId) => ({
    profile_id: input.profileId,
    workflow_role_id: workflowRoleId,
  }))

  const updateAccessResult = await admin
    .from('internal_access')
    .update({
      permission_template_id: template.id,
      role: roleValue,
      is_admin: isAdmin,
    })
    .eq('profile_id', input.profileId)

  if (updateAccessResult.error) return { error: updateAccessResult.error.message as string }

  const deleteWorkflowsResult = await admin
    .from('user_workflow_eligibility')
    .delete()
    .eq('profile_id', input.profileId)

  if (deleteWorkflowsResult.error) return { error: deleteWorkflowsResult.error.message as string }

  if (workflowRows.length > 0) {
    const insertWorkflowResult = await admin
      .from('user_workflow_eligibility')
      .insert(workflowRows)

    if (insertWorkflowResult.error) return { error: insertWorkflowResult.error.message as string }
  }

  const deleteSnapshotsResult = await admin
    .from('user_permission_snapshots')
    .delete()
    .eq('profile_id', input.profileId)

  if (deleteSnapshotsResult.error) return { error: deleteSnapshotsResult.error.message as string }

  if (snapshotRows.length > 0) {
    const insertSnapshotsResult = await admin
      .from('user_permission_snapshots')
      .insert(snapshotRows)

    if (insertSnapshotsResult.error) return { error: insertSnapshotsResult.error.message as string }
  }

  return { success: true }
}

export async function saveTemplatePermissionMatrix(input: {
  templateKey: PermissionTemplateKey
  permissions: Array<{ rowKey: PermissionRowKey; canView: boolean; canManage: boolean; canAssign: boolean }>
}) {
  const catalog = await getAccessControlCatalog()
  if ('error' in catalog) return { error: catalog.error }

  const admin = createAdminClient()
  const template = catalog.templates.find((record) => record.key === input.templateKey)
  if (!template) return { error: 'Permission template not found' }

  const rowByKey = new Map(catalog.permissionRows.map((row) => [row.key, row]))

  const rows = PERMISSION_ROW_KEYS.map((rowKey) => {
    const found = input.permissions.find((row) => row.rowKey === rowKey)
    const permissionRow = rowByKey.get(rowKey)
    if (!permissionRow) return null
    const normalized = normalizePermissionState(rowKey, found || { canView: false, canManage: false, canAssign: false })
    return {
      permission_template_id: template.id,
      permission_row_id: permissionRow.id,
      can_view: normalized.canView,
      can_manage: normalized.canManage,
      can_assign: normalized.canAssign,
    }
  }).filter(Boolean) as any[]

  const deleteResult = await admin
    .from('template_permissions')
    .delete()
    .eq('permission_template_id', template.id)

  if (deleteResult.error) return { error: deleteResult.error.message as string }

  const insertResult = await admin
    .from('template_permissions')
    .insert(rows)

  if (insertResult.error) return { error: insertResult.error.message as string }

  return { success: true }
}
