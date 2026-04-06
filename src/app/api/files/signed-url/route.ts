import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const fileId = req.nextUrl.searchParams.get('file_id')
    if (!fileId) {
      return NextResponse.json({ error: 'file_id required' }, { status: 400 })
    }

    const { data: file, error: fileError } = await supabase
      .from('file_attachments')
      .select(
        `
          id,
          storage_path,
          visibility_scope,
          job_id
        `
      )
      .eq('id', fileId)
      .single()

    if (fileError || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // 🔒 TEMP ACCESS RULE (tighten later with org + role checks)
    // Right now: authenticated users can access job files
    // Future: enforce visibility_scope + membership + trade tags

    const { data: signed, error: signedError } = await admin.storage
      .from('job-files')
      .createSignedUrl(file.storage_path, 60 * 5) // 5 minutes

    if (signedError || !signed?.signedUrl) {
      return NextResponse.json(
        { error: signedError?.message ?? 'Failed to generate URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: signed.signedUrl })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}