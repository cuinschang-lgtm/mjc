import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getBearerToken } from '@/lib/supabaseServer'
import { sanitizeReviewHtml, validateReviewPayload } from '@/lib/reviewContent'

function parseNumber(n) {
  const v = Number(n)
  return Number.isFinite(v) ? v : null
}

export async function PATCH(request, { params }) {
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

  const score = parseNumber(body?.score)
  const title = body?.title
  const contentHtml = body?.contentHtml ?? body?.content
  const imageUrls = Array.isArray(body?.imageUrls) ? body.imageUrls.map(String).filter(Boolean) : []

  const v = validateReviewPayload({ title, contentHtml })
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  if (score === null || score < 1 || score > 10) return NextResponse.json({ error: 'invalid score' }, { status: 400 })
  if (Math.round(score * 2) !== score * 2) return NextResponse.json({ error: 'score step must be 0.5' }, { status: 400 })
  if (imageUrls.length > 9) return NextResponse.json({ error: 'too many images' }, { status: 400 })

  const { data: row } = await supabase
    .from('album_reviews')
    .select('id,album_id,user_id')
    .eq('id', reviewId)
    .maybeSingle()
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (row.user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { data: col } = await supabase
    .from('user_collections')
    .select('status,personal_rating')
    .eq('user_id', user.id)
    .eq('album_id', row.album_id)
    .maybeSingle()
  if (!col || col.status !== 'listened') return NextResponse.json({ error: 'must be listened to review' }, { status: 400 })
  const pr = col.personal_rating === null || col.personal_rating === undefined ? null : Number(col.personal_rating)
  if (!Number.isFinite(pr)) return NextResponse.json({ error: 'must rate before review' }, { status: 400 })

  const { data: updated, error } = await supabase
    .from('album_reviews')
    .update({
      title: String(v.title),
      score,
      has_listened: true,
      content: sanitizeReviewHtml(v.contentHtml),
      image_urls: imageUrls.length ? imageUrls : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reviewId)
    .select('id,album_id,user_id,title,score,has_listened,content,image_urls,created_at,updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ review: updated }, { status: 200 })
}

export async function DELETE(request, { params }) {
  const reviewId = params?.reviewId
  if (!reviewId) return NextResponse.json({ error: 'missing reviewId' }, { status: 400 })

  const token = getBearerToken(request)
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = createSupabaseServerClient(token)
  const { data: userData } = await supabase.auth.getUser(token)
  const user = userData?.user
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: row } = await supabase
    .from('album_reviews')
    .select('id,album_id,user_id')
    .eq('id', reviewId)
    .maybeSingle()
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (row.user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('album_reviews')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', reviewId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true }, { status: 200 })
}
