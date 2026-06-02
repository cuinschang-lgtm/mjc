import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getBearerToken } from '@/lib/supabaseServer'

const PAGE_SIZE = 20

function parseNumber(n) {
  const v = Number(n)
  return Number.isFinite(v) ? v : null
}

export async function GET(request, { params }) {
  const albumId = params?.albumId
  if (!albumId) return NextResponse.json({ error: 'missing albumId' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const token = getBearerToken(request)
  const supabase = createSupabaseServerClient(token)

  const base = supabase
    .from('album_reviews')
    .select('id,album_id,user_id,score,has_listened,content,image_urls,created_at,updated_at')
    .eq('album_id', albumId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)

  const q = cursor ? base.lt('created_at', cursor) : base
  const { data: rows, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const reviewIds = (rows || []).map((r) => r.id)
  const userIds = Array.from(new Set((rows || []).map((r) => r.user_id).filter(Boolean)))
  let likeCounts = {}
  let replyCounts = {}
  let likedByMe = new Set()
  let profiles = {}

  if (userIds.length) {
    const { data: ps } = await supabase.from('profiles').select('user_id,nickname,avatar_url').in('user_id', userIds)
    profiles = (ps || []).reduce((acc, p) => {
      acc[p.user_id] = { nickname: p.nickname, avatarUrl: p.avatar_url }
      return acc
    }, {})
  }

  if (reviewIds.length) {
    const { data: likes } = await supabase
      .from('review_likes')
      .select('review_id')
      .in('review_id', reviewIds)

    likeCounts = (likes || []).reduce((acc, x) => {
      const k = x.review_id
      if (!k) return acc
      acc[k] = (acc[k] || 0) + 1
      return acc
    }, {})

    const { data: replies } = await supabase
      .from('review_replies')
      .select('review_id')
      .in('review_id', reviewIds)

    replyCounts = (replies || []).reduce((acc, x) => {
      const k = x.review_id
      if (!k) return acc
      acc[k] = (acc[k] || 0) + 1
      return acc
    }, {})

    if (token) {
      const { data: userData } = await supabase.auth.getUser(token)
      const me = userData?.user
      if (me) {
        const { data: myLikes } = await supabase
          .from('review_likes')
          .select('review_id')
          .eq('user_id', me.id)
          .in('review_id', reviewIds)
        likedByMe = new Set((myLikes || []).map((x) => x.review_id).filter(Boolean))
      }
    }
  }

  const reviews = (rows || []).map((r) => ({
    id: r.id,
    albumId: r.album_id,
    userId: r.user_id,
    score: r.score,
    hasListened: r.has_listened,
    content: r.content,
    imageUrls: r.image_urls || [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    author: {
      nickname: profiles[r.user_id]?.nickname || '用户',
      avatarUrl: profiles[r.user_id]?.avatarUrl || null,
    },
    likeCount: likeCounts[r.id] || 0,
    replyCount: replyCounts[r.id] || 0,
    likedByMe: likedByMe.has(r.id),
  }))

  const nextCursor = reviews.length ? reviews[reviews.length - 1].createdAt : null
  return NextResponse.json({ reviews, nextCursor }, { status: 200 })
}

export async function POST(request, { params }) {
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

  const score = parseNumber(body?.score)
  const hasListened = body?.hasListened !== false
  const content = String(body?.content || '').trim()
  const imageUrls = Array.isArray(body?.imageUrls) ? body.imageUrls.map(String).filter(Boolean) : []

  if (!hasListened) return NextResponse.json({ error: 'must be listened to review' }, { status: 400 })
  if (score === null || score < 1 || score > 10) return NextResponse.json({ error: 'invalid score' }, { status: 400 })
  if (Math.round(score * 2) !== score * 2) return NextResponse.json({ error: 'score step must be 0.5' }, { status: 400 })
  if (content.length < 15) return NextResponse.json({ error: 'content too short' }, { status: 400 })
  if (content.length > 8000) return NextResponse.json({ error: 'content too long' }, { status: 400 })
  if (imageUrls.length > 9) return NextResponse.json({ error: 'too many images' }, { status: 400 })

  const { data: inserted, error } = await supabase
    .from('album_reviews')
    .insert({
      album_id: albumId,
      user_id: user.id,
      score,
      has_listened: true,
      content,
      image_urls: imageUrls.length ? imageUrls : null,
    })
    .select('id,album_id,user_id,score,has_listened,content,image_urls,created_at,updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabase
    .from('user_collections')
    .upsert(
      {
        user_id: user.id,
        album_id: albumId,
        status: 'listened',
        personal_rating: score,
      },
      { onConflict: 'user_id,album_id' }
    )

  return NextResponse.json(
    {
      review: {
        id: inserted.id,
        albumId: inserted.album_id,
        userId: inserted.user_id,
        score: inserted.score,
        hasListened: inserted.has_listened,
        content: inserted.content,
        imageUrls: inserted.image_urls || [],
        createdAt: inserted.created_at,
        updatedAt: inserted.updated_at,
        author: { nickname: '我', avatarUrl: null },
        likeCount: 0,
        replyCount: 0,
        likedByMe: false,
      },
    },
    { status: 200 }
  )
}
