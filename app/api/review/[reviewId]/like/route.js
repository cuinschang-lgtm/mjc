import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getBearerToken } from '@/lib/supabaseServer'

export async function POST(request, { params }) {
  const reviewId = params?.reviewId
  if (!reviewId) return NextResponse.json({ error: 'missing reviewId' }, { status: 400 })

  const token = getBearerToken(request)
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = createSupabaseServerClient(token)
  const { data: userData } = await supabase.auth.getUser(token)
  const user = userData?.user
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: existing } = await supabase
    .from('review_likes')
    .select('id')
    .eq('user_id', user.id)
    .eq('review_id', reviewId)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase.from('review_likes').delete().eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ liked: false }, { status: 200 })
  }

  const { error } = await supabase.from('review_likes').insert({ user_id: user.id, review_id: reviewId })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ liked: true }, { status: 200 })
}

