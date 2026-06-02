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

export async function GET(request) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const q = String(searchParams.get('q') || '').trim()
  const status = String(searchParams.get('status') || '').trim()
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 50) || 50, 1), 200)

  let query = auth.supabase
    .from('albums')
    .select('id,title,artist,cover_url,release_date,admin_status,updated_at,updated_by,created_at')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (status && ['draft', 'published', 'offline'].includes(status)) query = query.eq('admin_status', status)
  if (q) {
    const like = `%${q.replace(/%/g, '')}%`
    query = query.or(`title.ilike.${like},artist.ilike.${like}`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ items: data || [] }, { status: 200 })
}

export async function POST(request) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body = null
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const title = String(body?.title || '').trim()
  const artist = String(body?.artist || '').trim()
  const cover_url = body?.cover_url ? String(body.cover_url).trim() : null
  const release_date = body?.release_date ? String(body.release_date).trim() : null

  if (!title) return NextResponse.json({ error: 'missing title' }, { status: 400 })
  if (!artist) return NextResponse.json({ error: 'missing artist' }, { status: 400 })
  if (title.length > 200) return NextResponse.json({ error: 'title too long' }, { status: 400 })
  if (artist.length > 200) return NextResponse.json({ error: 'artist too long' }, { status: 400 })

  const now = new Date().toISOString()
  const insert = {
    title,
    artist,
    cover_url,
    release_date,
    admin_status: 'draft',
    updated_at: now,
    updated_by: auth.user.id,
  }

  const { data, error } = await auth.supabase
    .from('albums')
    .insert(insert)
    .select('id,title,artist,cover_url,release_date,admin_status,updated_at,updated_by,created_at')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: 'create failed' }, { status: 500 })

  await auth.supabase.from('audit_logs').insert({
    entity_type: 'album',
    entity_id: data.id,
    action: 'create_album',
    actor_id: auth.user.id,
    after: { title: data.title, artist: data.artist },
    request_id: crypto.randomUUID(),
    user_agent: request.headers.get('user-agent') || null,
  })

  return NextResponse.json({ album: data }, { status: 200 })
}
