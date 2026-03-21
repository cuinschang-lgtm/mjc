import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getBearerToken } from '@/lib/supabaseServer'

function parseNumber(n) {
  const v = Number(n)
  return Number.isFinite(v) ? v : null
}

export async function PUT(request, { params }) {
  const albumId = params?.albumId
  if (!albumId) return NextResponse.json({ error: 'missing albumId' }, { status: 400 })

  const token = getBearerToken(request)
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = createSupabaseServerClient(token)
  const { data: userData } = await supabase.auth.getUser(token)
  const user = userData?.user
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body = null
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const score = body?.score === null || body?.score === undefined ? null : parseNumber(body.score)
  const hasListened = body?.hasListened !== false

  if (!hasListened) {
    const { error } = await supabase
      .from('user_collections')
      .upsert({ user_id: user.id, album_id: albumId, status: 'want_to_listen', personal_rating: null }, { onConflict: 'user_id,album_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  if (score === null || score < 1 || score > 10) return NextResponse.json({ error: 'invalid score' }, { status: 400 })
  if (Math.round(score * 2) !== score * 2) return NextResponse.json({ error: 'score step must be 0.5' }, { status: 400 })

  const { error } = await supabase
    .from('user_collections')
    .upsert({ user_id: user.id, album_id: albumId, status: 'listened', personal_rating: score }, { onConflict: 'user_id,album_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true }, { status: 200 })
}

