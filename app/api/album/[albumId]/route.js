import { NextResponse } from 'next/server'
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

export async function PUT(request, { params }) {
  const albumId = params?.albumId
  if (!albumId) return NextResponse.json({ error: 'missing albumId' }, { status: 400 })

  const token = getBearerToken(request)
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = createSupabaseServerClient(token)
  const { data: userData } = await supabase.auth.getUser(token)
  if (!userData?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let payload = null
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const cover_url = payload?.cover_url ?? null
  const release_date = payload?.release_date ?? null
  const description = payload?.description ?? null
  const genres = payload?.genres ?? null
  const gallery_urls = payload?.gallery_urls ?? null

  if (cover_url && !isSafeUrl(cover_url)) return NextResponse.json({ error: 'invalid cover_url' }, { status: 400 })
  if (Array.isArray(gallery_urls) && gallery_urls.some((u) => !isSafeUrl(u))) {
    return NextResponse.json({ error: 'invalid gallery_urls' }, { status: 400 })
  }
  if (description && String(description).length > 5000) return NextResponse.json({ error: 'description too long' }, { status: 400 })
  if (Array.isArray(genres) && genres.some((g) => String(g).length > 40)) return NextResponse.json({ error: 'genre too long' }, { status: 400 })

  const update = {
    cover_url,
    release_date,
    description,
    genres: Array.isArray(genres) ? genres.filter(Boolean) : null,
    gallery_urls: Array.isArray(gallery_urls) ? gallery_urls.filter(Boolean) : null,
  }

  const { data, error } = await supabase
    .from('albums')
    .update(update)
    .eq('id', albumId)
    .select('id,title,artist,cover_url,release_date,description,genres,gallery_urls')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json({ album: data }, { status: 200 })
}
