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
      .select('id, storage_path')
      .eq('id', fileId)
      .single()

    if (fileError || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const { data, error } = await admin.storage
      .from('job-files')
      .createSignedUrl(file.storage_path, 60 * 5)

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: error?.message || 'Could not generate signed URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: data.signedUrl })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}