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
    .from('album_versions')
    .select('id,album_id,version_no,reason,created_by,created_at')
    .eq('album_id', albumId)
    .order('version_no', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ items: data || [] }, { status: 200 })
}

export async function POST(request, { params }) {
  const albumId = params?.albumId
  if (!albumId) return NextResponse.json({ error: 'missing albumId' }, { status: 400 })
  const auth = await requireAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body = null
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const reason = body?.reason ? String(body.reason).trim().slice(0, 200) : null

  const { data: albumRow } = await auth.supabase
    .from('albums')
    .select(
      'id,title,artist,cover_url,release_date,description,genres,gallery_urls,admin_status,tracks_override,artist_bio,creation_background,media_reviews_items,awards_items,updated_at,updated_by'
    )
    .eq('id', albumId)
    .maybeSingle()
  if (!albumRow) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { data: latest } = await auth.supabase
    .from('album_versions')
    .select('version_no')
    .eq('album_id', albumId)
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextNo = (Number(latest?.version_no) || 0) + 1
  const snapshot = { album: albumRow }

  const { data: ver, error } = await auth.supabase
    .from('album_versions')
    .insert({ album_id: albumId, version_no: nextNo, reason, snapshot, created_by: auth.user.id })
    .select('id,album_id,version_no,reason,created_by,created_at')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!ver) return NextResponse.json({ error: 'create version failed' }, { status: 500 })

  await auth.supabase.from('audit_logs').insert({
    entity_type: 'album',
    entity_id: albumId,
    action: 'create_version',
    actor_id: auth.user.id,
    version_no: nextNo,
    after: { version_no: nextNo, reason },
    request_id: crypto.randomUUID(),
    user_agent: request.headers.get('user-agent') || null,
  })

  return NextResponse.json({ version: ver }, { status: 200 })
}
