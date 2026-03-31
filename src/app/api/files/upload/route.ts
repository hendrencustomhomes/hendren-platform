import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomUUID } from 'crypto'

const CATEGORY_DEFAULTS = {
  plans:  { client_visible: true,  companies_visible: true,  company_scope: 'all' },
  photos: { client_visible: false, companies_visible: true,  company_scope: 'all' },
  admin:  { client_visible: false, companies_visible: false, company_scope: null  },
  other:  { client_visible: false, companies_visible: false, company_scope: null  },
} as const
type Category = keyof typeof CATEGORY_DEFAULTS

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_').slice(0, 200)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const form = await req.formData()
    const fileBlob = form.get('file')
    const jobId = form.get('job_id') as string | null
    const categoryRaw = form.get('category') as string | null
    const displayNameRaw = form.get('display_name') as string | null
    if (!fileBlob || !(fileBlob instanceof Blob)) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!jobId) return NextResponse.json({ error: 'job_id required' }, { status: 400 })
    const category: Category = (categoryRaw && categoryRaw in CATEGORY_DEFAULTS) ? categoryRaw as Category : 'other'
    const visibility = CATEGORY_DEFAULTS[category]
    const originalName = (fileBlob as File).name ?? 'file'
    const fileId = randomUUID()
    const storagePath = `jobs/${jobId}/${category}/${fileId}-${sanitizeFilename(originalName)}`
    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer())
    const mimeType = fileBlob.type || 'application/octet-stream'
    const admin = createAdminClient()
    const { error: storageError } = await admin.storage.from('job-files').upload(storagePath, fileBuffer, { contentType: mimeType, upsert: false })
    if (storageError) return NextResponse.json({ error: `Storage failed: ${storageError.message}` }, { status: 500 })
    const { data: inserted, error: dbError } = await admin.from('file_attachments').insert({
      id: fileId, job_id: jobId, category, filename: originalName,
      storage_path: storagePath, display_name: displayNameRaw?.trim() || originalName,
      mime_type: mimeType, size_bytes: fileBuffer.byteLength, uploaded_by: user.id,
      client_visible: visibility.client_visible, companies_visible: visibility.companies_visible,
      company_scope: visibility.company_scope,
    }).select('id, category, filename, display_name, storage_path, size_bytes, mime_type, client_visible, created_at, uploaded_by').single()
    if (dbError) { await admin.storage.from('job-files').remove([storagePath]); return NextResponse.json({ error: `DB failed: ${dbError.message}` }, { status: 500 }) }
    return NextResponse.json({ file: inserted })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
