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

export async function POST(request, { params }) {
  const albumId = params?.albumId
  if (!albumId) return NextResponse.json({ error: 'missing albumId' }, { status: 400 })
  const auth = await requireAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body = null
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const version_no = Number(body?.version_no)
  if (!Number.isFinite(version_no) || version_no <= 0) return NextResponse.json({ error: 'invalid version_no' }, { status: 400 })

  const { data: ver } = await auth.supabase
    .from('album_versions')
    .select('id,album_id,version_no,snapshot')
    .eq('album_id', albumId)
    .eq('version_no', version_no)
    .maybeSingle()

  if (!ver) return NextResponse.json({ error: 'version not found' }, { status: 404 })

  const snapshotAlbum = ver?.snapshot?.album
  if (!snapshotAlbum || typeof snapshotAlbum !== 'object') return NextResponse.json({ error: 'bad snapshot' }, { status: 400 })

  const now = new Date().toISOString()
  const update = {
    title: snapshotAlbum.title,
    artist: snapshotAlbum.artist,
    cover_url: snapshotAlbum.cover_url || null,
    release_date: snapshotAlbum.release_date || null,
    description: snapshotAlbum.description || null,
    genres: Array.isArray(snapshotAlbum.genres) ? snapshotAlbum.genres : null,
    gallery_urls: Array.isArray(snapshotAlbum.gallery_urls) ? snapshotAlbum.gallery_urls : null,
    admin_status: snapshotAlbum.admin_status || 'draft',
    tracks_override: snapshotAlbum.tracks_override || null,
    artist_bio: snapshotAlbum.artist_bio || null,
    creation_background: snapshotAlbum.creation_background || null,
    media_reviews_items: snapshotAlbum.media_reviews_items || null,
    awards_items: snapshotAlbum.awards_items || null,
    updated_at: now,
    updated_by: auth.user.id,
  }

  const { data: afterRow, error } = await auth.supabase
    .from('albums')
    .update(update)
    .eq('id', albumId)
    .select('id,updated_at,updated_by')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!afterRow) return NextResponse.json({ error: 'not found' }, { status: 404 })

  await auth.supabase.from('audit_logs').insert({
    entity_type: 'album',
    entity_id: albumId,
    action: 'rollback',
    actor_id: auth.user.id,
    version_no,
    after: { version_no },
    request_id: crypto.randomUUID(),
    user_agent: request.headers.get('user-agent') || null,
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
