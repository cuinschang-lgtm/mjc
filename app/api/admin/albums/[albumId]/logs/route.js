import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createSupabaseServerClient, getBearerToken } from '@/lib/supabaseServer'

async function requireAdmin(request) {
  const token = getBearerToken(request)
  if (!token) return { ok: false, status: 401, error: 'unauthorized' }
  const supabase = createSupabaseServerClient(token)
  const { data: userData } = await supabase.auth.getUser(token)
  const user = userData?.user
  if (!user) return { ok: false, status: 401, error: 'unauthorized' }
  const { data: adminRow } = await supabase.from('app_admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!adminRow) return { ok: false, status: 403, error: 'forbidden' }
  return { ok: true, supabase, user }
}

export async function GET(request, { params }) {
  const albumId = params?.albumId
  if (!albumId) return NextResponse.json({ error: 'missing albumId' }, { status: 400 })
  const auth = await requireAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.supabase
    .from('audit_logs')
    .select('id,entity_type,entity_id,action,actor_id,version_no,before,after,request_id,user_agent,created_at')
    .eq('entity_type', 'album')
    .eq('entity_id', albumId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ items: data || [] }, { status: 200 })
}
