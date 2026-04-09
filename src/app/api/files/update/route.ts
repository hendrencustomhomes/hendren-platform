import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_CATEGORIES = ['plans', 'photos', 'admin', 'financial', 'other'] as const
type Category = (typeof ALLOWED_CATEGORIES)[number]

const ALLOWED_VISIBILITY_SCOPES = [
  'internal_only',
  'tagged_external',
  'all_external_except_client',
  'all_external_including_client',
] as const
type VisibilityScope = (typeof ALLOWED_VISIBILITY_SCOPES)[number]

function isAllowedCategory(value: unknown): value is Category {
  return typeof value === 'string' && ALLOWED_CATEGORIES.includes(value as Category)
}

function isAllowedVisibilityScope(value: unknown): value is VisibilityScope {
  return typeof value === 'string' && ALLOWED_VISIBILITY_SCOPES.includes(value as VisibilityScope)
}

function getLegacyVisibilityFields(visibilityScope: VisibilityScope) {
  switch (visibilityScope) {
    case 'internal_only':
      return { client_visible: false, companies_visible: false, company_scope: null }
    case 'tagged_external':
      return { client_visible: true, companies_visible: true, company_scope: 'selected' }
    case 'all_external_except_client':
      return { client_visible: false, companies_visible: true, company_scope: 'all' }
    case 'all_external_including_client':
      return { client_visible: true, companies_visible: true, company_scope: 'all' }
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { file_id, display_name, category, visibility_scope, include_in_packet } = body as Record<string, unknown>

    if (typeof file_id !== 'string' || !file_id) {
      return NextResponse.json({ error: 'file_id required' }, { status: 400 })
    }

    if (!isAllowedCategory(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    if (!isAllowedVisibilityScope(visibility_scope)) {
      return NextResponse.json({ error: 'Invalid visibility_scope' }, { status: 400 })
    }

    // Verify the file exists and the user has access via RLS
    const { data: existing, error: fetchError } = await supabase
      .from('file_attachments')
      .select('id')
      .eq('id', file_id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const legacyVisibility = getLegacyVisibilityFields(visibility_scope)

    const admin = createAdminClient()

    const { data: updated, error: updateError } = await admin
      .from('file_attachments')
      .update({
        display_name: typeof display_name === 'string' ? display_name.trim() || null : null,
        category,
        visibility_scope,
        include_in_packet: include_in_packet === true,
        ...legacyVisibility,
      })
      .eq('id', file_id)
      .select(
        `
          id,
          category,
          filename,
          display_name,
          storage_path,
          size_bytes,
          mime_type,
          visibility_scope,
          include_in_packet,
          entity_type,
          client_visible,
          companies_visible,
          company_scope,
          created_at,
          uploaded_by
        `
      )
      .single()

    if (updateError) {
      return NextResponse.json({ error: `Update failed: ${updateError.message}` }, { status: 500 })
    }

    return NextResponse.json({ file: updated })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
