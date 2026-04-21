export const PERMISSION_TEMPLATE_KEYS = [
  'admin',
  'operations',
  'sales',
  'estimator',
  'project_manager',
  'bookkeeper',
  'accountant',
  'media',
] as const

export type PermissionTemplateKey = (typeof PERMISSION_TEMPLATE_KEYS)[number]

export const PERMISSION_TEMPLATE_LABELS: Record<PermissionTemplateKey, string> = {
  admin: 'Admin',
  operations: 'Operations',
  sales: 'Sales',
  estimator: 'Estimator',
  project_manager: 'Project Manager',
  bookkeeper: 'Bookkeeper',
  accountant: 'Accountant',
  media: 'Media',
}

export const WORKFLOW_ROLE_KEYS = [
  'operations',
  'sales',
  'estimator',
  'project_manager',
  'bookkeeper',
  'media',
] as const

export type WorkflowRoleKey = (typeof WORKFLOW_ROLE_KEYS)[number]

export const WORKFLOW_ROLE_LABELS: Record<WorkflowRoleKey, string> = {
  operations: 'Operations',
  sales: 'Sales',
  estimator: 'Estimator',
  project_manager: 'Project Manager',
  bookkeeper: 'Bookkeeper',
  media: 'Media',
}

export const PERMISSION_ROW_KEYS = [
  'jobs',
  'takeoffs',
  'estimates',
  'pricing_sources',
  'schedule',
  'procurement',
  'selections',
  'bids',
  'files',
  'logs',
  'financials',
  'companies',
  'internal_users',
  'catalog',
  'reports',
] as const

export type PermissionRowKey = (typeof PERMISSION_ROW_KEYS)[number]

export const PERMISSION_ROW_LABELS: Record<PermissionRowKey, string> = {
  jobs: 'Jobs',
  takeoffs: 'Takeoffs',
  estimates: 'Estimates',
  pricing_sources: 'Pricing Sources',
  schedule: 'Schedule',
  procurement: 'Procurement',
  selections: 'Selections',
  bids: 'Bids',
  files: 'Files',
  logs: 'Logs',
  financials: 'Financials',
  companies: 'Companies',
  internal_users: 'Internal Users',
  catalog: 'Catalog',
  reports: 'Reports',
}

export const LOCKED_BASELINE_VIEW_ROWS: PermissionRowKey[] = [
  'jobs',
  'internal_users',
  'companies',
  'files',
]

export const DEFAULT_WORKFLOWS_BY_TEMPLATE: Partial<Record<PermissionTemplateKey, WorkflowRoleKey[]>> = {
  operations: ['operations'],
  sales: ['sales'],
  estimator: ['estimator'],
  project_manager: ['project_manager'],
  bookkeeper: ['bookkeeper'],
  media: ['media'],
}

export type PermissionMatrixCell = {
  rowKey: PermissionRowKey
  canView: boolean
  canManage: boolean
  canAssign: boolean
}

export type PermissionTemplateRecord = {
  id: string
  key: PermissionTemplateKey
  label: string
}

export type WorkflowRoleRecord = {
  id: string
  key: WorkflowRoleKey
  label: string
}

export type PermissionRowRecord = {
  id: string
  key: PermissionRowKey
  label: string
}

export function isPermissionTemplateKey(value: string): value is PermissionTemplateKey {
  return (PERMISSION_TEMPLATE_KEYS as readonly string[]).includes(value)
}

export function isWorkflowRoleKey(value: string): value is WorkflowRoleKey {
  return (WORKFLOW_ROLE_KEYS as readonly string[]).includes(value)
}

export function isPermissionRowKey(value: string): value is PermissionRowKey {
  return (PERMISSION_ROW_KEYS as readonly string[]).includes(value)
}

export function titleCaseFromKey(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getNormalizedKey(record: any): string {
  return String(record?.key ?? record?.code ?? record?.slug ?? record?.name ?? '').trim()
}

export function getNormalizedLabel(record: any, fallbackKey: string): string {
  return String(record?.label ?? record?.name ?? titleCaseFromKey(fallbackKey)).trim()
}

export function sortPermissionRows<T extends { key: PermissionRowKey }>(rows: T[]) {
  const order = new Map(PERMISSION_ROW_KEYS.map((key, index) => [key, index]))
  return [...rows].sort((a, b) => (order.get(a.key) ?? 999) - (order.get(b.key) ?? 999))
}

export function normalizePermissionState(rowKey: PermissionRowKey, input: {
  canView?: boolean | null
  canManage?: boolean | null
  canAssign?: boolean | null
  can_view?: boolean | null
  can_manage?: boolean | null
  can_assign?: boolean | null
}) {
  let canView = input.canView === true || input.can_view === true
  let canManage = input.canManage === true || input.can_manage === true
  let canAssign = input.canAssign === true || input.can_assign === true

  if (LOCKED_BASELINE_VIEW_ROWS.includes(rowKey)) {
    canView = true
  }

  if (canAssign) {
    canManage = true
    canView = true
  }

  if (canManage) {
    canView = true
  }

  if (!canView) {
    canManage = false
    canAssign = false
  }

  if (!canManage) {
    canAssign = false
  }

  return { canView, canManage, canAssign }
}

export function buildDefaultPermissionMatrix() {
  return PERMISSION_ROW_KEYS.map((rowKey) => ({
    rowKey,
    ...normalizePermissionState(rowKey, { canView: LOCKED_BASELINE_VIEW_ROWS.includes(rowKey) }),
  }))
}

export function mergeWorkflowEligibility(templateKey: PermissionTemplateKey, input: string[]) {
  const selected = input.filter(isWorkflowRoleKey)
  const defaults = DEFAULT_WORKFLOWS_BY_TEMPLATE[templateKey] || []
  return Array.from(new Set<WorkflowRoleKey>([...defaults, ...selected]))
}

export function deriveLegacyRoleState(templateKey: PermissionTemplateKey, workflowKeys: WorkflowRoleKey[]) {
  const normalized = Array.from(new Set(workflowKeys.filter((key) => key !== 'media')))
  const isAdmin = templateKey === 'admin'
  const roleValue = normalized.length > 0 ? normalized.join(',') : 'viewer'
  return { isAdmin, roleValue }
}

export function formatWorkflowSummary(workflowKeys: WorkflowRoleKey[]) {
  const unique = Array.from(new Set(workflowKeys))
  if (unique.length === 0) return 'No workflow'
  return unique.map((key) => WORKFLOW_ROLE_LABELS[key]).join(', ')
}
