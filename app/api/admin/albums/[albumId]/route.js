import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createSupabaseServerClient, getBearerToken } from '@/lib/supabaseServer'

function isSafeUrl(u) {
  if (!u) return true
  try {
    const url = new URL(String(u))
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function rejectDangerousHtml(html) {
  const s = String(html || '')
  const lower = s.toLowerCase()
  if (lower.includes('<script')) return false
  if (lower.includes('javascript:')) return false
  if (lower.includes('onerror=')) return false
  if (lower.includes('onload=')) return false
  return true
}

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
    .from('albums')
    .select(
      'id,title,artist,cover_url,release_date,description,genres,gallery_urls,admin_status,tracks_override,artist_bio,creation_background,media_reviews_items,awards_items,updated_at,updated_by,created_at'
    )
    .eq('id', albumId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ album: data }, { status: 200 })
}

export async function PATCH(request, { params }) {
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

  const autosave = body?.autosave === true
  const now = new Date().toISOString()

  const { data: beforeRow } = await auth.supabase
    .from('albums')
    .select(
      'id,title,artist,cover_url,release_date,description,genres,gallery_urls,admin_status,tracks_override,artist_bio,creation_background,media_reviews_items,awards_items,updated_at,updated_by'
    )
    .eq('id', albumId)
    .maybeSingle()
  if (!beforeRow) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const update = {}

  if (body?.title !== undefined) {
    const v = String(body.title || '').trim()
    if (!v) return NextResponse.json({ error: 'missing title' }, { status: 400 })
    if (v.length > 200) return NextResponse.json({ error: 'title too long' }, { status: 400 })
    update.title = v
  }
  if (body?.artist !== undefined) {
    const v = String(body.artist || '').trim()
    if (!v) return NextResponse.json({ error: 'missing artist' }, { status: 400 })
    if (v.length > 200) return NextResponse.json({ error: 'artist too long' }, { status: 400 })
    update.artist = v
  }
  if (body?.cover_url !== undefined) {
    const v = body.cover_url ? String(body.cover_url).trim() : null
    if (v && !isSafeUrl(v)) return NextResponse.json({ error: 'invalid cover_url' }, { status: 400 })
    update.cover_url = v
  }
  if (body?.release_date !== undefined) {
    const v = body.release_date ? String(body.release_date).trim() : null
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return NextResponse.json({ error: 'invalid release_date' }, { status: 400 })
    update.release_date = v
  }
  if (body?.description !== undefined) {
    const v = body.description == null ? null : String(body.description)
    if (v && v.length > 5000) return NextResponse.json({ error: 'description too long' }, { status: 400 })
    update.description = v && v.trim() ? v : null
  }
  if (body?.genres !== undefined) {
    if (body.genres == null) {
      update.genres = null
    } else {
      if (!Array.isArray(body.genres)) return NextResponse.json({ error: 'invalid genres' }, { status: 400 })
      const cleaned = body.genres.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 20)
      if (cleaned.some((g) => g.length > 40)) return NextResponse.json({ error: 'genre too long' }, { status: 400 })
      update.genres = cleaned.length ? cleaned : null
    }
  }
  if (body?.gallery_urls !== undefined) {
    if (body.gallery_urls == null) {
      update.gallery_urls = null
    } else {
      if (!Array.isArray(body.gallery_urls)) return NextResponse.json({ error: 'invalid gallery_urls' }, { status: 400 })
      const cleaned = body.gallery_urls.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 20)
      if (cleaned.some((u) => !isSafeUrl(u))) return NextResponse.json({ error: 'invalid gallery_urls' }, { status: 400 })
      update.gallery_urls = cleaned.length ? cleaned : null
    }
  }
  if (body?.admin_status !== undefined) {
    const v = String(body.admin_status || '').trim()
    if (!['draft', 'published', 'offline'].includes(v)) return NextResponse.json({ error: 'invalid admin_status' }, { status: 400 })
    update.admin_status = v
  }

  const htmlFields = ['artist_bio', 'creation_background']
  for (const k of htmlFields) {
    if (body?.[k] === undefined) continue
    const raw = body[k] == null ? '' : String(body[k])
    if (raw && raw.length > 20000) return NextResponse.json({ error: `${k} too long` }, { status: 400 })
    if (raw && !rejectDangerousHtml(raw)) return NextResponse.json({ error: `unsafe ${k}` }, { status: 400 })
    update[k] = raw.trim() ? raw : null
  }

  if (body?.tracks !== undefined) {
    if (body.tracks == null) {
      update.tracks_override = null
    } else {
      if (!Array.isArray(body.tracks)) return NextResponse.json({ error: 'invalid tracks' }, { status: 400 })
      const cleaned = body.tracks
        .filter((x) => x && typeof x === 'object')
        .map((x, i) => {
          const name = String(x.name || '').trim()
          const durationText = x.durationText == null ? '' : String(x.durationText).trim()
          const lyricist = x.lyricist == null ? '' : String(x.lyricist).trim()
          const composer = x.composer == null ? '' : String(x.composer).trim()
          return {
            index: i + 1,
            name: name.slice(0, 200),
            durationText: durationText ? durationText.slice(0, 20) : null,
            lyricist: lyricist ? lyricist.slice(0, 200) : null,
            composer: composer ? composer.slice(0, 200) : null,
          }
        })
        .filter((x) => x.name)
        .slice(0, 200)
      update.tracks_override = cleaned.length ? cleaned : null
    }
  }

  if (body?.media_reviews_items !== undefined) {
    if (body.media_reviews_items == null) {
      update.media_reviews_items = null
    } else {
      if (!Array.isArray(body.media_reviews_items)) return NextResponse.json({ error: 'invalid media_reviews_items' }, { status: 400 })
      const cleaned = body.media_reviews_items
        .filter((x) => x && typeof x === 'object')
        .map((x) => {
          const source = String(x.source || '').trim()
          const content = String(x.content || '').trim()
          const score = x.score === null || x.score === undefined || x.score === '' ? null : Number(x.score)
          const published_at = x.published_at ? String(x.published_at).trim() : null
          return {
            id: String(x.id || crypto.randomUUID()),
            source: source.slice(0, 120),
            score: Number.isFinite(score) ? Math.max(0, Math.min(10, score)) : null,
            content: content.slice(0, 8000),
            published_at: published_at && /^\d{4}-\d{2}-\d{2}$/.test(published_at) ? published_at : null,
            url: x.url && isSafeUrl(x.url) ? String(x.url).trim().slice(0, 500) : null,
          }
        })
        .filter((x) => x.source || x.content)
        .slice(0, 100)
      update.media_reviews_items = cleaned.length ? cleaned : null
    }
  }

  if (body?.awards_items !== undefined) {
    if (body.awards_items == null) {
      update.awards_items = null
    } else {
      if (!Array.isArray(body.awards_items)) return NextResponse.json({ error: 'invalid awards_items' }, { status: 400 })
      const cleaned = body.awards_items
        .filter((x) => x && typeof x === 'object')
        .map((x) => {
          const name = String(x.name || '').trim()
          const org = String(x.org || '').trim()
          const category = String(x.category || '').trim()
          const year = x.year === null || x.year === undefined || x.year === '' ? null : Number(x.year)
          return {
            id: String(x.id || crypto.randomUUID()),
            name: name.slice(0, 200),
            org: org ? org.slice(0, 200) : null,
            category: category ? category.slice(0, 120) : null,
            year: Number.isFinite(year) ? Math.max(1900, Math.min(2100, Math.floor(year))) : null,
          }
        })
        .filter((x) => x.name)
        .slice(0, 200)
      update.awards_items = cleaned.length ? cleaned : null
    }
  }

  update.updated_at = now
  update.updated_by = auth.user.id

  const { data: afterRow, error } = await auth.supabase
    .from('albums')
    .update(update)
    .eq('id', albumId)
    .select(
      'id,title,artist,cover_url,release_date,description,genres,gallery_urls,admin_status,tracks_override,artist_bio,creation_background,media_reviews_items,awards_items,updated_at,updated_by'
    )
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!afterRow) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const changedKeys = Object.keys(update).filter((k) => k !== 'updated_at' && k !== 'updated_by')
  const before = {}
  const after = {}
  for (const k of changedKeys) {
    before[k] = beforeRow[k]
    after[k] = afterRow[k]
  }

  await auth.supabase.from('audit_logs').insert({
    entity_type: 'album',
    entity_id: afterRow.id,
    action: autosave ? 'autosave' : 'update',
    actor_id: auth.user.id,
    before,
    after,
    request_id: crypto.randomUUID(),
    user_agent: request.headers.get('user-agent') || null,
  })

  return NextResponse.json({ album: afterRow }, { status: 200 })
}
