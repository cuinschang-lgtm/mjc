import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getBearerToken } from '@/lib/supabaseServer'

function isPureDigits(s) {
  return /^\d+$/.test(String(s || ''))
}

function hasBannedWord(s) {
  const v = String(s || '').toLowerCase()
  const banned = ['admin', '管理员', '官方', '客服', 'support', 'mod', 'pickup', 'supabase', 'vercel']
  return banned.some((w) => v.includes(String(w).toLowerCase()))
}

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

  await supabase.from('profiles').upsert({ user_id: user.id }, { onConflict: 'user_id' })

  const { data: row, error } = await supabase
    .from('profiles')
    .select('user_id,nickname,avatar_url,bio,signature,created_at,updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(
    {
      profile: {
        userId: row?.user_id || user.id,
        nickname: row?.nickname || null,
        avatarUrl: row?.avatar_url || null,
        bio: row?.bio || null,
        signature: row?.signature || null,
        createdAt: row?.created_at || null,
        updatedAt: row?.updated_at || null,
      },
    },
    { status: 200 }
  )
}

export async function PUT(request) {
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

  const nicknameRaw = body?.nickname
  const bioRaw = body?.bio
  const signatureRaw = body?.signature
  const avatarUrl = body?.avatarUrl ? String(body.avatarUrl) : null

  const nickname = nicknameRaw === null || nicknameRaw === undefined ? null : normalizeNickname(nicknameRaw)
  const bio = bioRaw === null || bioRaw === undefined ? null : String(bioRaw)
  const signature = signatureRaw === null || signatureRaw === undefined ? null : String(signatureRaw)

  if (nickname !== null) {
    if (nickname.length < 2 || nickname.length > 20) return NextResponse.json({ error: 'invalid nickname length' }, { status: 400 })
    if (isPureDigits(nickname)) return NextResponse.json({ error: 'nickname cannot be pure digits' }, { status: 400 })
    if (hasBannedWord(nickname)) return NextResponse.json({ error: 'nickname contains banned words' }, { status: 400 })

    const { data: dup } = await supabase
      .from('profiles')
      .select('user_id')
      .ilike('nickname', nickname)
      .neq('user_id', user.id)
      .maybeSingle()

    if (dup?.user_id) return NextResponse.json({ error: 'nickname already taken' }, { status: 400 })
  }

  if (bio !== null && bio.length > 200) return NextResponse.json({ error: 'bio too long' }, { status: 400 })
  if (signature !== null && signature.length > 60) return NextResponse.json({ error: 'signature too long' }, { status: 400 })
  if (avatarUrl !== null && avatarUrl.length > 500) return NextResponse.json({ error: 'avatar url too long' }, { status: 400 })

  const now = new Date().toISOString()
  const { data: updated, error } = await supabase
    .from('profiles')
    .upsert(
      {
        user_id: user.id,
        nickname,
        avatar_url: avatarUrl,
        bio,
        signature,
        updated_at: now,
      },
      { onConflict: 'user_id' }
    )
    .select('user_id,nickname,avatar_url,bio,signature,created_at,updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(
    {
      profile: {
        userId: updated.user_id,
        nickname: updated.nickname,
        avatarUrl: updated.avatar_url,
        bio: updated.bio,
        signature: updated.signature,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    },
    { status: 200 }
  )
}

