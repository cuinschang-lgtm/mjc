import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getBearerToken } from '@/lib/supabaseServer'

function normalizeNickname(n) {
  return String(n || '').trim().replace(/\s+/g, ' ')
}

export async function GET(request) {
  const token = getBearerToken(request)
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = createSupabaseServerClient(token)
  const { data: userData } = await supabase.auth.getUser(token)
  const user = userData?.user
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const nickname = normalizeNickname(searchParams.get('nickname'))
  if (!nickname) return NextResponse.json({ available: false }, { status: 200 })

  const { data: dup } = await supabase
    .from('profiles')
    .select('user_id')
    .ilike('nickname', nickname)
    .neq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ available: !dup?.user_id }, { status: 200 })
}

