export const APP_ROLES = [
  'admin',
  'estimator',
  'project_manager',
  'bookkeeper',
  'viewer',
] as const

export type AppRole = (typeof APP_ROLES)[number]

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  estimator: 'Estimator',
  project_manager: 'Project Manager',
  bookkeeper: 'Bookkeeper',
  viewer: 'Viewer',
}

export const MODULE_CAPABILITIES = {
  internal_users: ['view', 'add', 'edit', 'deactivate'],
  jobs: ['view', 'add', 'edit', 'delete'],
  takeoffs: ['view', 'add', 'edit', 'delete'],
  schedule: ['view', 'add', 'edit', 'delete'],
  companies: ['view', 'add', 'edit', 'delete'],
} as const

export type PermissionModule = keyof typeof MODULE_CAPABILITIES
export type PermissionAction<M extends PermissionModule = PermissionModule> =
  (typeof MODULE_CAPABILITIES)[M][number]

export const ROLE_CAPABILITIES: Record<AppRole, Partial<Record<PermissionModule, string[]>>> = {
  admin: {
    internal_users: ['view', 'add', 'edit', 'deactivate'],
    jobs: ['view', 'add', 'edit', 'delete'],
    takeoffs: ['view', 'add', 'edit', 'delete'],
    schedule: ['view', 'add', 'edit', 'delete'],
    companies: ['view', 'add', 'edit', 'delete'],
  },
  estimator: {
    internal_users: ['view'],
    jobs: ['view'],
    takeoffs: ['view', 'add', 'edit'],
    schedule: ['view'],
    companies: ['view'],
  },
  project_manager: {
    internal_users: ['view'],
    jobs: ['view', 'add', 'edit'],
    takeoffs: ['view'],
    schedule: ['view', 'add', 'edit'],
    companies: ['view'],
  },
  bookkeeper: {
    internal_users: ['view'],
    jobs: ['view'],
    takeoffs: ['view'],
    schedule: ['view'],
    companies: ['view'],
  },
  viewer: {
    internal_users: ['view'],
    jobs: ['view'],
    takeoffs: ['view'],
    schedule: ['view'],
    companies: ['view'],
  },
}

export function normalizeRoles(input: string[]): AppRole[] {
  const seen = new Set<AppRole>()
  for (const value of input) {
    if ((APP_ROLES as readonly string[]).includes(value)) {
      seen.add(value as AppRole)
    }
  }
  return Array.from(seen)
}

export function parseStoredRoles(roleValue: string | null, isAdmin: boolean): AppRole[] {
  const roles = roleValue
    ? roleValue
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : []

  if (isAdmin) roles.unshift('admin')

  const normalized = normalizeRoles(roles)
  return normalized.length > 0 ? normalized : isAdmin ? ['admin'] : ['viewer']
}

export function serializeRoles(roles: AppRole[]): { roleValue: string; isAdmin: boolean } {
  const normalized = normalizeRoles(roles)
  const isAdmin = normalized.includes('admin')
  const stored = normalized.filter((role) => role !== 'admin')
  return {
    roleValue: stored.length > 0 ? stored.join(',') : 'viewer',
    isAdmin,
  }
}

export function canUser(roles: AppRole[], module: PermissionModule, action: string): boolean {
  return normalizeRoles(roles).some((role) => ROLE_CAPABILITIES[role]?.[module]?.includes(action))
}

export function rolesSummary(roles: AppRole[]): string {
  return normalizeRoles(roles)
    .map((role) => APP_ROLE_LABELS[role])
    .join(', ')
}
