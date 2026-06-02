import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getBearerToken } from '@/lib/supabaseServer'

const PAGE_SIZE = 50

export async function GET(request, { params }) {
  const reviewId = params?.reviewId
  if (!reviewId) return NextResponse.json({ error: 'missing reviewId' }, { status: 400 })

  const token = getBearerToken(request)
  const supabase = createSupabaseServerClient(token)

  const { data: rows, error } = await supabase
    .from('review_replies')
    .select('id,review_id,parent_reply_id,depth,user_id,content,created_at,updated_at')
    .eq('review_id', reviewId)
    .order('created_at', { ascending: true })
    .limit(PAGE_SIZE)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const ids = (rows || []).map((r) => r.id)
  const userIds = Array.from(new Set((rows || []).map((r) => r.user_id).filter(Boolean)))
  let likeCounts = {}
  let likedByMe = new Set()
  let profiles = {}

  if (userIds.length) {
    const { data: ps } = await supabase.from('profiles').select('user_id,nickname,avatar_url').in('user_id', userIds)
    profiles = (ps || []).reduce((acc, p) => {
      acc[p.user_id] = { nickname: p.nickname, avatarUrl: p.avatar_url }
      return acc
    }, {})
  }

  if (ids.length) {
    const { data: likes } = await supabase.from('review_likes').select('reply_id').in('reply_id', ids)
    likeCounts = (likes || []).reduce((acc, x) => {
      const k = x.reply_id
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
          .select('reply_id')
          .eq('user_id', me.id)
          .in('reply_id', ids)
        likedByMe = new Set((myLikes || []).map((x) => x.reply_id).filter(Boolean))
      }
    }
  }

  const replies = (rows || []).map((r) => ({
    id: r.id,
    reviewId: r.review_id,
    parentReplyId: r.parent_reply_id,
    depth: r.depth,
    userId: r.user_id,
    content: r.content,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    author: { nickname: profiles[r.user_id]?.nickname || '用户', avatarUrl: profiles[r.user_id]?.avatarUrl || null },
    likeCount: likeCounts[r.id] || 0,
    likedByMe: likedByMe.has(r.id),
  }))

  return NextResponse.json({ replies }, { status: 200 })
}

export async function POST(request, { params }) {
  const reviewId = params?.reviewId
  if (!reviewId) return NextResponse.json({ error: 'missing reviewId' }, { status: 400 })

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

  const content = String(body?.content || '').trim()
  const parentReplyId = body?.parentReplyId ? String(body.parentReplyId) : null
  if (content.length < 5) return NextResponse.json({ error: 'content too short' }, { status: 400 })
  if (content.length > 2000) return NextResponse.json({ error: 'content too long' }, { status: 400 })

  let depth = 1
  if (parentReplyId) {
    const { data: parent } = await supabase
      .from('review_replies')
      .select('id,depth')
      .eq('id', parentReplyId)
      .eq('review_id', reviewId)
      .maybeSingle()
    if (!parent) return NextResponse.json({ error: 'parent not found' }, { status: 404 })
    if (parent.depth !== 1) return NextResponse.json({ error: 'max depth reached' }, { status: 400 })
    depth = 2
  }

  const { data: inserted, error } = await supabase
    .from('review_replies')
    .insert({
      review_id: reviewId,
      parent_reply_id: parentReplyId,
      depth,
      user_id: user.id,
      content,
    })
    .select('id,review_id,parent_reply_id,depth,user_id,content,created_at,updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(
    {
      reply: {
        id: inserted.id,
        reviewId: inserted.review_id,
        parentReplyId: inserted.parent_reply_id,
        depth: inserted.depth,
        userId: inserted.user_id,
        content: inserted.content,
        createdAt: inserted.created_at,
        updatedAt: inserted.updated_at,
        author: { nickname: '我', avatarUrl: null },
        likeCount: 0,
        likedByMe: false,
      },
    },
    { status: 200 }
  )
}
