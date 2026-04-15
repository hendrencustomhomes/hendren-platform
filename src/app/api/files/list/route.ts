import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jobId = req.nextUrl.searchParams.get('job_id')
    if (!jobId) {
      return NextResponse.json({ error: 'job_id required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('file_attachments')
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
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ files: data ?? [] })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}