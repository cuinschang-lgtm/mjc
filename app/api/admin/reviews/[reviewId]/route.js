import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createSupabaseServerClient, getBearerToken } from '@/lib/supabaseServer'

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

export async function DELETE(request, { params }) {
  const reviewId = params?.reviewId
  if (!reviewId) return NextResponse.json({ error: 'missing reviewId' }, { status: 400 })

  const auth = await requireAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body = null
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const reason = String(body?.reason || '').trim()
  if (!reason) return NextResponse.json({ error: 'missing reason' }, { status: 400 })
  if (reason.length > 200) return NextResponse.json({ error: 'reason too long' }, { status: 400 })

  const { data: beforeRow } = await auth.supabase
    .from('album_reviews')
    .select('id,album_id,user_id,title,score,deleted_at')
    .eq('id', reviewId)
    .maybeSingle()

  if (!beforeRow) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (beforeRow.deleted_at) return NextResponse.json({ ok: true }, { status: 200 })

  const now = new Date().toISOString()
  const { error } = await auth.supabase
    .from('album_reviews')
    .update({ deleted_at: now, deleted_by: auth.user.id, deleted_reason: reason, updated_at: now })
    .eq('id', reviewId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const requestId = crypto.randomUUID()
  const ip = request.headers.get('x-forwarded-for') || null
  const userAgent = request.headers.get('user-agent') || null

  await auth.supabase.from('audit_logs').insert({
    entity_type: 'album_review',
    entity_id: reviewId,
    action: 'admin_delete',
    actor_id: auth.user.id,
    before: { album_id: beforeRow.album_id, user_id: beforeRow.user_id, title: beforeRow.title, score: beforeRow.score },
    after: { deleted_at: now, deleted_reason: reason },
    request_id: requestId,
    ip: ip ? String(ip).split(',')[0].trim() : null,
    user_agent: userAgent,
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}

