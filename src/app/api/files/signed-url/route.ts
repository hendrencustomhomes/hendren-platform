import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const fileId = req.nextUrl.searchParams.get('file_id')
    if (!fileId) return NextResponse.json({ error: 'file_id required' }, { status: 400 })
    const admin = createAdminClient()
    const { data: fileRow, error: dbError } = await admin
      .from('file_attachments').select('storage_path').eq('id', fileId).single()
    if (dbError || !fileRow) return NextResponse.json({ error: 'File not found' }, { status: 404 })
    const { data: signedData, error: signError } = await admin.storage
      .from('job-files').createSignedUrl(fileRow.storage_path, 60 * 60)
    if (signError || !signedData?.signedUrl) return NextResponse.json({ error: 'Could not generate URL' }, { status: 500 })
    return NextResponse.json({ url: signedData.signedUrl })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
