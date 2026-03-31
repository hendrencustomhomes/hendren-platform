import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const jobId = req.nextUrl.searchParams.get('job_id')
    if (!jobId) return NextResponse.json({ error: 'job_id required' }, { status: 400 })
    const { data, error } = await supabase.rpc('get_job_files', { p_job_id: jobId })
    if (error) throw error
    return NextResponse.json({ files: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
