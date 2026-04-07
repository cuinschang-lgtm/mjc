'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bookmark, Heart, Loader2, Trash2 } from 'lucide-react'
import RichTextEditor from '@/components/RichTextEditor'
import StarRating10 from '@/components/StarRating10'
import { supabase } from '@/lib/supabaseBrowser'

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token || null
}

export default function AlbumReviewsPanel({ albumId }) {
  const [me, setMe] = useState(null)
  const [loadingMe, setLoadingMe] = useState(true)
  const [token, setToken] = useState(null)
  const [listened, setListened] = useState(false)
  const [score, setScore] = useState(0)

  const [title, setTitle] = useState('')
  const [contentHtml, setContentHtml] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [items, setItems] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const [admin, setAdmin] = useState(false)
  const bodyLen = useMemo(() => stripTags(contentHtml).length, [contentHtml])

  useEffect(() => {
    const run = async () => {
      setLoadingMe(true)
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const session = sessionData?.session || null
        const user = session?.user || null
        setMe(user)
        setToken(session?.access_token || null)
        if (!user || !session?.access_token) {
          setListened(false)
          setScore(0)
          setAdmin(false)
          return
        }
        const { data: row } = await supabase
          .from('user_collections')
          .select('status,personal_rating')
          .eq('user_id', user.id)
          .eq('album_id', albumId)
          .maybeSingle()

        setListened(row?.status === 'listened')
        const pr = row?.personal_rating === null || row?.personal_rating === undefined ? 0 : Number(row.personal_rating)
        setScore(Number.isFinite(pr) ? Math.round(pr * 2) / 2 : 0)

        const meRes = await fetch('/api/me', { headers: { Authorization: `Bearer ${session.access_token}` } })
        const meJson = await meRes.json().catch(() => null)
        setAdmin(Boolean(meJson?.isAdmin))
      } finally {
        setLoadingMe(false)
      }
    }
    if (albumId) run()
  }, [albumId])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setMe(session?.user || null)
      setToken(session?.access_token || null)
    })
    return () => data?.subscription?.unsubscribe()
  }, [])

  const fetchPage = async (more = false) => {
    if (!albumId) return
    if (more) setLoadingMore(true)
    else setLoadingList(true)
    try {
      const url = `/api/album/${encodeURIComponent(albumId)}/reviews${more && cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
      const res = await fetch(url)
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || '加载失败')
      const next = Array.isArray(json?.reviews) ? json.reviews : []
      setItems((prev) => (more ? [...prev, ...next] : next))
      setCursor(json?.nextCursor || null)
    } catch {
      if (!more) setItems([])
    } finally {
      if (more) setLoadingMore(false)
      else setLoadingList(false)
    }
  }

  useEffect(() => {
    fetchPage(false)
  }, [albumId])

  const saveListened = async (next) => {
    if (!albumId) return
    const t = token || (await getAccessToken())
    const res = await fetch(`/api/album/${encodeURIComponent(albumId)}/rating`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ hasListened: next, score: next ? null : null }),
    })
    const j = await res.json().catch(() => null)
    if (!res.ok) throw new Error(j?.error || '更新失败')
  }

  const saveScore = async (nextScore) => {
    if (!albumId) return
    const t = token || (await getAccessToken())
    const res = await fetch(`/api/album/${encodeURIComponent(albumId)}/rating`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ hasListened: true, score: nextScore }),
    })
    const j = await res.json().catch(() => null)
    if (!res.ok) throw new Error(j?.error || '评分失败')
  }

  const onToggleListened = async () => {
    if (!me || loadingMe) return
    const next = !listened
    setListened(next)
    try {
      await saveListened(next)
      if (!next) setScore(0)
    } catch (e) {
      setListened(!next)
      alert(e?.message || '更新失败')
    }
  }

  const onPickScore = async (v) => {
    if (!me || loadingMe) return
    const next = Math.round(Number(v) * 2) / 2
    if (!Number.isFinite(next)) return
    if (!listened) setListened(true)
    setScore(next)
    try {
      await saveScore(next)
    } catch (e) {
      alert(e?.message || '评分失败')
    }
  }

  const canSubmit = me && listened && score >= 1 && title.trim().length > 0 && title.trim().length <= 50 && bodyLen >= 15 && bodyLen <= 2000

  const submitReview = async () => {
    if (!canSubmit || submitting) return
    try {
      setSubmitting(true)
      const t = token || (await getAccessToken())
      const res = await fetch(`/api/album/${encodeURIComponent(albumId)}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify({ title: title.trim(), contentHtml, score, hasListened: true }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || '发布失败')
      setTitle('')
      setContentHtml('')
      await fetchPage(false)
    } catch (e) {
      alert(e?.message || '发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleLike = async (reviewId) => {
    if (!me) {
      alert('请先登录')
      return
    }
    setItems((prev) =>
      prev.map((r) => {
        if (r.id !== reviewId) return r
        const liked = !r.likedByMe
        return { ...r, likedByMe: liked, likeCount: Math.max(0, (r.likeCount || 0) + (liked ? 1 : -1)) }
      })
    )
    const t = token || (await getAccessToken())
    const res = await fetch(`/api/review/${encodeURIComponent(reviewId)}/like`, {
      method: 'POST',
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      setItems((prev) =>
        prev.map((r) => {
          if (r.id !== reviewId) return r
          const liked = !r.likedByMe
          return { ...r, likedByMe: liked, likeCount: Math.max(0, (r.likeCount || 0) + (liked ? 1 : -1)) }
        })
      )
      alert(json?.error || '点赞失败')
    }
  }

  const toggleFavorite = async (reviewId) => {
    if (!me) {
      alert('请先登录')
      return
    }
    setItems((prev) =>
      prev.map((r) => {
        if (r.id !== reviewId) return r
        const next = !r.favoritedByMe
        return {
          ...r,
          favoritedByMe: next,
          favoriteCount: Math.max(0, (r.favoriteCount || 0) + (next ? 1 : -1)),
        }
      })
    )
    const t = token || (await getAccessToken())
    const res = await fetch(`/api/review/${encodeURIComponent(reviewId)}/favorite`, {
      method: 'POST',
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      setItems((prev) =>
        prev.map((r) => {
          if (r.id !== reviewId) return r
          const next = !r.favoritedByMe
          return {
            ...r,
            favoritedByMe: next,
            favoriteCount: Math.max(0, (r.favoriteCount || 0) + (next ? 1 : -1)),
          }
        })
      )
      alert(json?.error || '收藏失败')
    }
  }

  const adminDelete = async (reviewId) => {
    const reason = prompt('请输入删除原因（必填）')
    if (!reason) return
    const res = await fetch(`/api/admin/reviews/${encodeURIComponent(reviewId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      alert(json?.error || '删除失败')
      return
    }
    await fetchPage(false)
  }

  return (
    <section className="glass-panel p-6 rounded-3xl border border-white/10">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold text-white">评分与乐评</h2>
        <button
          type="button"
          onClick={() => fetchPage(false)}
          className="h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80"
        >
          刷新
        </button>
      </div>

      {!me && !loadingMe && <div className="text-sm text-white/70">登录后可评分、撰写乐评与点赞。</div>}

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-white/80">已听过</div>
            <button
              type="button"
              disabled={!me || loadingMe}
              onClick={onToggleListened}
              className={
                listened
                  ? 'h-9 px-3 rounded-xl bg-green-500/15 border border-green-500/20 text-xs text-green-300'
                  : 'h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70'
              }
            >
              {listened ? '已听过' : '未听过'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-white/80">我的评分</div>
            <StarRating10 value={score} onChange={onPickScore} disabled={!me || loadingMe} />
          </div>

          <div className="space-y-2">
            <div className="text-sm text-white/80">乐评标题（50字内）</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none focus:border-accent/40"
              maxLength={50}
              placeholder="例如：青春、躁动、反叛的完美合体"
            />
            <div className="text-xs text-white/45">{title.trim().length}/50</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/80">正文（2000字内，支持富文本）</div>
              <div className={bodyLen > 2000 ? 'text-xs text-red-300' : 'text-xs text-white/45'}>
                {bodyLen}/2000
              </div>
            </div>
            <RichTextEditor value={contentHtml} onChange={setContentHtml} placeholder="写下你的感受、观点与推荐理由…" />
          </div>

          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={submitReview}
            className={
              canSubmit
                ? 'h-11 px-4 rounded-xl bg-accent text-black font-bold'
                : 'h-11 px-4 rounded-xl bg-white/10 text-white/40 font-bold cursor-not-allowed'
            }
          >
            {submitting ? '发布中…' : '发布乐评'}
          </button>
          {!listened && me && <div className="text-xs text-white/50">提示：只有标记为已听过并完成评分后才能发布乐评。</div>}
        </div>

        <div className="space-y-4">
          <div className="text-sm text-white/80">最新乐评</div>
          {loadingList ? (
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <Loader2 size={16} className="animate-spin" />
              加载中…
            </div>
          ) : items.length ? (
            <div className="space-y-3">
              {items.map((r) => (
                <div key={r.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden">
                          {r.author?.avatarUrl ? (
                            <img src={r.author.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm text-white font-semibold truncate">{r.author?.nickname || '用户'}</div>
                          <div className="text-xs text-white/45">{formatTime(r.createdAt)}</div>
                        </div>
                      </div>
                      <div className="mt-3 text-white font-bold">{r.title || '（无标题）'}</div>
                      <div className="mt-2 text-xs text-yellow-300">评分：{Number(r.score)}/10</div>
                    </div>

                    <div className="flex items-center gap-2">
                      {admin ? (
                        <button
                          type="button"
                          onClick={() => adminDelete(r.id)}
                          className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300"
                          aria-label="删除"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => toggleLike(r.id)}
                        className={
                          r.likedByMe
                            ? 'h-9 px-3 rounded-xl bg-pink-500/15 border border-pink-500/20 text-pink-200 inline-flex items-center gap-2'
                            : 'h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-white/70 inline-flex items-center gap-2'
                        }
                      >
                        <Heart size={16} fill={r.likedByMe ? 'currentColor' : 'none'} />
                        <span className="text-xs">{r.likeCount || 0}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleFavorite(r.id)}
                        className={
                          r.favoritedByMe
                            ? 'h-9 px-3 rounded-xl bg-yellow-500/15 border border-yellow-500/20 text-yellow-200 inline-flex items-center gap-2'
                            : 'h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-white/70 inline-flex items-center gap-2'
                        }
                      >
                        <Bookmark size={16} fill={r.favoritedByMe ? 'currentColor' : 'none'} />
                        <span className="text-xs">{r.favoriteCount || 0}</span>
                      </button>
                    </div>
                  </div>
                  <div
                    className="mt-3 text-sm text-white/80 leading-relaxed prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: String(r.content || '') }}
                  />
                </div>
              ))}
              {cursor ? (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => fetchPage(true)}
                  className="h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80"
                >
                  {loadingMore ? '加载中…' : '加载更多（20条/页）'}
                </button>
              ) : (
                <div className="text-xs text-white/40">没有更多了</div>
              )}
            </div>
          ) : (
            <div className="text-sm text-white/50">还没有人发表乐评。</div>
          )}
        </div>
      </div>
    </section>
  )
}
