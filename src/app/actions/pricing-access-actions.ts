'use server'

import { createClient } from '@/utils/supabase/server'
import { requireModuleAccess } from '@/lib/access-control-server'
import type { PermissionRowKey } from '@/lib/access-control'

type SupportedPricingPermissionRowKey = Extract<PermissionRowKey, 'pricing_sources' | 'bids' | 'catalog'>

type PricingAccessResult = {
  canView: boolean
  canManage: boolean
  canAssign: boolean
  error?: string
}

// Returns the full permission state for the current user on the given pricing row.
// This is a query function, not a guard: it exposes {canView, canManage, canAssign}
// so callers can render appropriate UI or apply fine-grained access decisions.
//
// Delegates all permission resolution to requireModuleAccess, which handles the admin
// bypass, active-user check, snapshot resolution, and template fallback consistently
// with all other modules. Three parallel calls (view, edit, manage) produce the full
// state with the same DB overhead as a single call.
//
// Error is propagated only when the view check fails, which signals a fundamental
// failure (not authenticated, DB error, inactive user). A user who can view but not
// manage simply gets canManage = false; no error is set in that case.
export async function getCurrentPricingAccess(
  rowKey: SupportedPricingPermissionRowKey,
): Promise<PricingAccessResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { canView: false, canManage: false, canAssign: false, error: 'Not authenticated' }
  }

  const [viewResult, editResult, manageResult] = await Promise.all([
    requireModuleAccess(user.id, rowKey, 'view'),
    requireModuleAccess(user.id, rowKey, 'edit'),
    requireModuleAccess(user.id, rowKey, 'manage'),
  ])

  return {
    canView: viewResult === null,
    canManage: editResult === null,
    canAssign: manageResult === null,
    ...(viewResult !== null && { error: viewResult.error }),
  }
}
