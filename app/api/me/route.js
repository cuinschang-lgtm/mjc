import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getBearerToken } from '@/lib/supabaseServer'

export async function GET(request) {
  const token = getBearerToken(request)
  if (!token) {
    return NextResponse.json({ user: null, isAdmin: false }, { status: 200 })
  }

  const supabase = createSupabaseServerClient(token)
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  const user = userData?.user || null
  if (userError || !user) {
    return NextResponse.json({ user: null, isAdmin: false }, { status: 200 })
  }

  const { data: adminRow } = await supabase
    .from('app_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ user: { id: user.id, email: user.email }, isAdmin: !!adminRow }, { status: 200 })
}

