import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomUUID } from 'crypto'

const ALLOWED_CATEGORIES = ['plans', 'photos', 'admin', 'financial', 'other'] as const
type Category = (typeof ALLOWED_CATEGORIES)[number]

const ALLOWED_VISIBILITY_SCOPES = [
  'internal_only',
  'tagged_external',
  'all_external_except_client',
  'all_external_including_client',
] as const
type VisibilityScope = (typeof ALLOWED_VISIBILITY_SCOPES)[number]

const ALLOWED_ENTITY_TYPES = ['job', 'schedule_item', 'procurement_item', 'task'] as const
type EntityType = (typeof ALLOWED_ENTITY_TYPES)[number]

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_').slice(0, 200)
}

function isAllowedCategory(value: string | null): value is Category {
  return !!value && ALLOWED_CATEGORIES.includes(value as Category)
}

function isAllowedVisibilityScope(value: string | null): value is VisibilityScope {
  return !!value && ALLOWED_VISIBILITY_SCOPES.includes(value as VisibilityScope)
}

function isAllowedEntityType(value: string | null): value is EntityType {
  return !!value && ALLOWED_ENTITY_TYPES.includes(value as EntityType)
}

function getDefaultVisibilityScope(category: Category): VisibilityScope {
  if (category === 'plans' || category === 'photos') return 'tagged_external'
  return 'internal_only'
}

function shouldIncludeInPacketByDefault(category: Category) {
  return category === 'plans' || category === 'photos'
}

function getLegacyVisibilityFields(visibilityScope: VisibilityScope) {
  switch (visibilityScope) {
    case 'internal_only':
      return {
        client_visible: false,
        companies_visible: false,
        company_scope: null,
      }
    case 'tagged_external':
      return {
        client_visible: true,
        companies_visible: true,
        company_scope: 'selected',
      }
    case 'all_external_except_client':
      return {
        client_visible: false,
        companies_visible: true,
        company_scope: 'all',
      }
    case 'all_external_including_client':
      return {
        client_visible: true,
        companies_visible: true,
        company_scope: 'all',
      }
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const form = await req.formData()

    const fileBlob = form.get('file')
    const jobId = form.get('job_id') as string | null
    const categoryRaw = form.get('category') as string | null
    const displayNameRaw = form.get('display_name') as string | null
    const visibilityScopeRaw = form.get('visibility_scope') as string | null
    const includeInPacketRaw = form.get('include_in_packet') as string | null
    const entityTypeRaw = form.get('entity_type') as string | null
    const scheduleItemId = form.get('schedule_item_id') as string | null
    const procurementItemId = form.get('procurement_item_id') as string | null
    const taskId = form.get('task_id') as string | null

    if (!fileBlob || !(fileBlob instanceof Blob)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!jobId) {
      return NextResponse.json({ error: 'job_id required' }, { status: 400 })
    }

    const category: Category = isAllowedCategory(categoryRaw) ? categoryRaw : 'other'
    const visibilityScope: VisibilityScope = isAllowedVisibilityScope(visibilityScopeRaw)
      ? visibilityScopeRaw
      : getDefaultVisibilityScope(category)

    const includeInPacket =
      includeInPacketRaw === null
        ? shouldIncludeInPacketByDefault(category) && visibilityScope !== 'internal_only'
        : includeInPacketRaw === 'true'

    const entityType: EntityType = isAllowedEntityType(entityTypeRaw) ? entityTypeRaw : 'job'

    if (entityType === 'schedule_item' && !scheduleItemId) {
      return NextResponse.json(
        { error: 'schedule_item_id required for schedule_item files' },
        { status: 400 }
      )
    }

    if (entityType === 'procurement_item' && !procurementItemId) {
      return NextResponse.json(
        { error: 'procurement_item_id required for procurement_item files' },
        { status: 400 }
      )
    }

    if (entityType === 'task' && !taskId) {
      return NextResponse.json({ error: 'task_id required for task files' }, { status: 400 })
    }

    const originalName = (fileBlob as File).name ?? 'file'
    const fileId = randomUUID()
    const storagePath = `jobs/${jobId}/${category}/${fileId}-${sanitizeFilename(originalName)}`
    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer())
    const mimeType = fileBlob.type || 'application/octet-stream'

    const admin = createAdminClient()

    const { error: storageError } = await admin.storage
      .from('job-files')
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      })

    if (storageError) {
      return NextResponse.json(
        { error: `Storage failed: ${storageError.message}` },
        { status: 500 }
      )
    }

    const legacyVisibility = getLegacyVisibilityFields(visibilityScope)

    const insertPayload = {
      id: fileId,
      job_id: jobId,
      category,
      filename: originalName,
      storage_path: storagePath,
      display_name: displayNameRaw?.trim() || originalName,
      mime_type: mimeType,
      size_bytes: fileBuffer.byteLength,
      uploaded_by: user.id,
      visibility_scope: visibilityScope,
      include_in_packet: includeInPacket,
      entity_type: entityType,
      schedule_item_id: entityType === 'schedule_item' ? scheduleItemId : null,
      procurement_item_id: entityType === 'procurement_item' ? procurementItemId : null,
      task_id: entityType === 'task' ? taskId : null,

      // legacy compatibility fields retained for now
      client_visible: legacyVisibility.client_visible,
      companies_visible: legacyVisibility.companies_visible,
      company_scope: legacyVisibility.company_scope,
    }

    const { data: inserted, error: dbError } = await admin
      .from('file_attachments')
      .insert(insertPayload)
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

    if (dbError) {
      await admin.storage.from('job-files').remove([storagePath])
      return NextResponse.json({ error: `DB failed: ${dbError.message}` }, { status: 500 })
    }

    return NextResponse.json({ file: inserted })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}