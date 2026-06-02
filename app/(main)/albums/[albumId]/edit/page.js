'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseBrowser'
import { ArrowLeft, Loader2, Save, History, ListMusic, Award, Newspaper, User, RefreshCw, RotateCcw, MessageCircle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import RichTextEditor from '@/components/RichTextEditor'

const TABS = [
  { key: 'tracks', name: '曲目列表', icon: ListMusic },
  { key: 'artistBio', name: '艺术家简介', icon: User },
  { key: 'creation', name: '创作背景', icon: RefreshCw },
  { key: 'media', name: '乐评 / 媒体评价', icon: Newspaper },
  { key: 'awards', name: '奖项 / 荣誉', icon: Award },
  { key: 'reviews', name: '用户乐评', icon: MessageCircle },
]

export default function AlbumEditPage() {
  const params = useParams()
  const router = useRouter()
  const albumId = params?.albumId

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [album, setAlbum] = useState(null)
  const [tab, setTab] = useState('tracks')

  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState('idle')
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [versions, setVersions] = useState([])
  const [logs, setLogs] = useState([])

  const [reviews, setReviews] = useState([])
  const [reviewsCursor, setReviewsCursor] = useState(null)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsMoreLoading, setReviewsMoreLoading] = useState(false)

  const lastSentRef = useRef('')
  const debounceRef = useRef(null)

  const getToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token || null
  }

  const ensureAdmin = async () => {
    const token = await getToken()
    if (!token) {
      router.push('/login')
      return null
    }
    const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
    const json = await res.json()
    if (!json?.isAdmin) {
      router.push('/')
      return null
    }
    return token
  }

  const fetchAll = async () => {
    setError('')
    setLoading(true)
    try {
      const token = await ensureAdmin()
      if (!token) return
      const r1 = await fetch(`/api/admin/albums/${encodeURIComponent(albumId)}`, { headers: { Authorization: `Bearer ${token}` } })
      const j1 = await r1.json()
      if (!r1.ok) throw new Error(j1?.error || 'failed')
      setAlbum(j1?.album || null)
      lastSentRef.current = JSON.stringify(pickDraft(j1?.album || {}))

      const r2 = await fetch(`/api/admin/albums/${encodeURIComponent(albumId)}/versions`, { headers: { Authorization: `Bearer ${token}` } })
      const j2 = await r2.json()
      setVersions(Array.isArray(j2?.items) ? j2.items : [])

      const r3 = await fetch(`/api/admin/albums/${encodeURIComponent(albumId)}/logs`, { headers: { Authorization: `Bearer ${token}` } })
      const j3 = await r3.json()
      setLogs(Array.isArray(j3?.items) ? j3.items : [])
    } catch (e) {
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!albumId) return
    fetchAll()
  }, [albumId])

  const fetchReviews = async (more = false) => {
    if (!albumId) return
    if (more) setReviewsMoreLoading(true)
    else setReviewsLoading(true)
    try {
      const url = `/api/album/${encodeURIComponent(albumId)}/reviews${more && reviewsCursor ? `?cursor=${encodeURIComponent(reviewsCursor)}` : ''}`
      const res = await fetch(url)
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'failed')
      const next = Array.isArray(json?.reviews) ? json.reviews : []
      setReviews((prev) => (more ? [...prev, ...next] : next))
      setReviewsCursor(json?.nextCursor || null)
    } finally {
      if (more) setReviewsMoreLoading(false)
      else setReviewsLoading(false)
    }
  }

  useEffect(() => {
    if (tab !== 'reviews') return
    fetchReviews(false)
  }, [tab])

  const pickDraft = (a) => {
    return {
      title: a?.title || '',
      artist: a?.artist || '',
      cover_url: a?.cover_url || '',
      release_date: a?.release_date || '',
      netease_album_id: a?.netease_album_id || '',
      description: a?.description || '',
      genres: Array.isArray(a?.genres) ? a.genres : [],
      gallery_urls: Array.isArray(a?.gallery_urls) ? a.gallery_urls : [],
      admin_status: a?.admin_status || 'draft',
      tracks: Array.isArray(a?.tracks_override) ? a.tracks_override : [],
      artist_bio: a?.artist_bio || '',
      creation_background: a?.creation_background || '',
      media_reviews_items: Array.isArray(a?.media_reviews_items) ? a.media_reviews_items : [],
      awards_items: Array.isArray(a?.awards_items) ? a.awards_items : [],
    }
  }

  const draft = useMemo(() => pickDraft(album || {}), [album])

  const patchAlbum = async (payload) => {
    const token = await ensureAdmin()
    if (!token) return
    const res = await fetch(`/api/admin/albums/${encodeURIComponent(albumId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json?.error || 'failed')
    setAlbum((prev) => ({ ...(prev || {}), ...(json?.album || {}) }))
    return json?.album
  }

  const deleteReview = async (reviewId) => {
    const token = await ensureAdmin()
    if (!token) return
    const reason = prompt('请输入删除原因（必填）')
    if (!reason) return
    const res = await fetch(`/api/admin/reviews/${encodeURIComponent(reviewId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.error || 'failed')
    await fetchReviews(false)
  }

  const scheduleAutosave = (nextAlbum) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSaveState('saving')
    debounceRef.current = setTimeout(async () => {
      try {
        const payload = { ...pickDraft(nextAlbum), autosave: true }
        const key = JSON.stringify(payload)
        if (key === lastSentRef.current) {
          setSaveState('saved')
          return
        }
        setSaving(true)
        const saved = await patchAlbum(payload)
        lastSentRef.current = JSON.stringify(payload)
        setLastSavedAt(saved?.updated_at || new Date().toISOString())
        setSaveState('saved')
      } catch {
        setSaveState('error')
      } finally {
        setSaving(false)
      }
    }, 800)
  }

  const updateAlbumLocal = (patch) => {
    setAlbum((prev) => {
      const next = { ...(prev || {}), ...patch }
      scheduleAutosave(next)
      return next
    })
  }

  const addTrack = () => {
    const list = Array.isArray(album?.tracks_override) ? [...album.tracks_override] : []
    list.push({ name: '新曲目', durationText: '', lyricist: '', composer: '' })
    updateAlbumLocal({ tracks_override: list })
  }

  const moveTrack = (idx, dir) => {
    const list = Array.isArray(album?.tracks_override) ? [...album.tracks_override] : []
    const next = idx + dir
    if (next < 0 || next >= list.length) return
    const a = list[idx]
    list[idx] = list[next]
    list[next] = a
    updateAlbumLocal({ tracks_override: list })
  }

  const removeTrack = (idx) => {
    const list = Array.isArray(album?.tracks_override) ? [...album.tracks_override] : []
    list.splice(idx, 1)
    updateAlbumLocal({ tracks_override: list })
  }

  const updateTrack = (idx, patch) => {
    const list = Array.isArray(album?.tracks_override) ? [...album.tracks_override] : []
    list[idx] = { ...(list[idx] || {}), ...patch }
    updateAlbumLocal({ tracks_override: list })
  }

  const addMedia = () => {
    const list = Array.isArray(album?.media_reviews_items) ? [...album.media_reviews_items] : []
    list.push({ id: crypto.randomUUID(), source: '', score: null, content: '', published_at: '', url: '' })
    updateAlbumLocal({ media_reviews_items: list })
  }

  const updateMedia = (idx, patch) => {
    const list = Array.isArray(album?.media_reviews_items) ? [...album.media_reviews_items] : []
    list[idx] = { ...(list[idx] || {}), ...patch }
    updateAlbumLocal({ media_reviews_items: list })
  }

  const removeMedia = (idx) => {
    const list = Array.isArray(album?.media_reviews_items) ? [...album.media_reviews_items] : []
    list.splice(idx, 1)
    updateAlbumLocal({ media_reviews_items: list })
  }

  const addAward = () => {
    const list = Array.isArray(album?.awards_items) ? [...album.awards_items] : []
    list.push({ id: crypto.randomUUID(), name: '', org: '', year: '', category: '' })
    updateAlbumLocal({ awards_items: list })
  }

  const updateAward = (idx, patch) => {
    const list = Array.isArray(album?.awards_items) ? [...album.awards_items] : []
    list[idx] = { ...(list[idx] || {}), ...patch }
    updateAlbumLocal({ awards_items: list })
  }

  const removeAward = (idx) => {
    const list = Array.isArray(album?.awards_items) ? [...album.awards_items] : []
    list.splice(idx, 1)
    updateAlbumLocal({ awards_items: list })
  }

  const createVersion = async () => {
    try {
      const reason = prompt('版本备注（可选）')
      const token = await ensureAdmin()
      if (!token) return
      const res = await fetch(`/api/admin/albums/${encodeURIComponent(albumId)}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reason || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'failed')
      await fetchAll()
    } catch (e) {
      setError(String(e?.message || e))
    }
  }

  const rollback = async (versionNo) => {
    if (!confirm(`确定回滚到版本 ${versionNo} 吗？当前内容将被覆盖。`)) return
    try {
      const token = await ensureAdmin()
      if (!token) return
      const res = await fetch(`/api/admin/albums/${encodeURIComponent(albumId)}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ version_no: versionNo }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'failed')
      await fetchAll()
    } catch (e) {
      setError(String(e?.message || e))
    }
  }

  const saveBadge = () => {
    if (saveState === 'saving') return '保存中…'
    if (saveState === 'saved') return lastSavedAt ? `已保存 ${new Date(lastSavedAt).toLocaleTimeString()}` : '已保存'
    if (saveState === 'error') return '保存失败（稍后将重试）'
    return '未保存'
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-secondary">
        <Loader2 size={16} className="animate-spin" />
        加载中...
      </div>
    )
  }

  if (error && !album) {
    return (
      <div className="glass-panel p-6 rounded-3xl border border-white/10">
        <div className="text-white font-bold mb-2">加载失败</div>
        <div className="text-secondary text-sm">{error}</div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => router.push('/albums')}
              className="inline-flex items-center gap-2 text-sm text-secondary hover:text-white transition"
            >
              <ArrowLeft size={16} />
              返回列表
            </button>
            <div className="mt-3 flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                {album?.cover_url ? <img src={album.cover_url} alt="" className="w-full h-full object-cover" /> : null}
              </div>
              <div className="min-w-0">
                <div className="text-white font-bold text-2xl truncate">{album?.title}</div>
                <div className="text-secondary text-sm truncate">{album?.artist}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className={cn('text-xs', saveState === 'error' ? 'text-red-300' : 'text-secondary')}>{saveBadge()}</div>
            <button
              type="button"
              onClick={createVersion}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition flex items-center gap-2"
            >
              <Save size={16} />
              创建保存点
            </button>
          </div>
        </div>

        {error ? <div className="text-sm text-red-300">{error}</div> : null}

        <div className="glass-panel p-5 rounded-3xl border border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-secondary">专辑名 *</div>
              <input
                value={album?.title || ''}
                onChange={(e) => updateAlbumLocal({ title: e.target.value })}
                className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none focus:border-accent/40"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-secondary">艺人 *</div>
              <input
                value={album?.artist || ''}
                onChange={(e) => updateAlbumLocal({ artist: e.target.value })}
                className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none focus:border-accent/40"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <div className="text-xs text-secondary">封面 URL</div>
              <input
                value={album?.cover_url || ''}
                onChange={(e) => updateAlbumLocal({ cover_url: e.target.value })}
                className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none focus:border-accent/40"
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-secondary">发行日期</div>
              <input
                value={album?.release_date || ''}
                onChange={(e) => updateAlbumLocal({ release_date: e.target.value })}
                className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none focus:border-accent/40"
                placeholder="YYYY-MM-DD"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-secondary">网易云专辑 ID</div>
              <input
                value={album?.netease_album_id || ''}
                onChange={(e) => updateAlbumLocal({ netease_album_id: e.target.value })}
                className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none focus:border-accent/40"
                placeholder="例如：123456"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-secondary">状态</div>
              <select
                value={album?.admin_status || 'draft'}
                onChange={(e) => updateAlbumLocal({ admin_status: e.target.value })}
                className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none"
              >
                <option value="draft">草稿</option>
                <option value="published">已发布</option>
                <option value="offline">已下线</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'px-4 py-2 rounded-full border text-sm font-medium transition inline-flex items-center gap-2',
                  active ? 'bg-accent text-black border-transparent' : 'bg-white/5 border-white/10 text-white/80 hover:text-white hover:bg-white/10'
                )}
              >
                <Icon size={16} />
                {t.name}
              </button>
            )
          })}
        </div>

        {tab === 'tracks' ? (
          <div className="glass-panel p-6 rounded-3xl border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="text-white font-bold">曲目列表</div>
              <button
                type="button"
                onClick={addTrack}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition"
              >
                添加曲目
              </button>
            </div>

            <div className="space-y-3">
              {(Array.isArray(album?.tracks_override) ? album.tracks_override : []).map((tr, idx) => (
                <div key={idx} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-secondary">#{idx + 1}</div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => moveTrack(idx, -1)} className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70 hover:text-white hover:bg-white/10 transition">上移</button>
                      <button type="button" onClick={() => moveTrack(idx, 1)} className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70 hover:text-white hover:bg-white/10 transition">下移</button>
                      <button type="button" onClick={() => removeTrack(idx)} className="px-3 py-1 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 hover:bg-red-500/15 transition">删除</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div className="space-y-1">
                      <div className="text-xs text-secondary">标题 *</div>
                      <input
                        value={tr?.name || ''}
                        onChange={(e) => updateTrack(idx, { name: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-secondary">时长（mm:ss）</div>
                      <input
                        value={tr?.durationText || ''}
                        onChange={(e) => updateTrack(idx, { durationText: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none"
                        placeholder="03:45"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-secondary">作词</div>
                      <input
                        value={tr?.lyricist || ''}
                        onChange={(e) => updateTrack(idx, { lyricist: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-secondary">作曲</div>
                      <input
                        value={tr?.composer || ''}
                        onChange={(e) => updateTrack(idx, { composer: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {(Array.isArray(album?.tracks_override) ? album.tracks_override : []).length === 0 ? (
                <div className="text-sm text-white/60">暂无曲目</div>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === 'artistBio' ? (
          <div className="space-y-3">
            <div className="text-white font-bold">艺术家简介</div>
            <RichTextEditor
              value={album?.artist_bio || ''}
              onChange={(html) => updateAlbumLocal({ artist_bio: html })}
              placeholder="输入艺术家简介，支持加粗/斜体/下划线/链接/图片..."
            />
          </div>
        ) : null}

        {tab === 'creation' ? (
          <div className="space-y-3">
            <div className="text-white font-bold">创作背景简介</div>
            <RichTextEditor
              value={album?.creation_background || ''}
              onChange={(html) => updateAlbumLocal({ creation_background: html })}
              placeholder="输入创作背景、灵感来源，支持链接与图片..."
            />
          </div>
        ) : null}

        {tab === 'media' ? (
          <div className="glass-panel p-6 rounded-3xl border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="text-white font-bold">乐评 / 媒体评价</div>
              <button
                type="button"
                onClick={addMedia}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition"
              >
                添加记录
              </button>
            </div>

            <div className="space-y-3">
              {(Array.isArray(album?.media_reviews_items) ? album.media_reviews_items : []).map((m, idx) => (
                <div key={m?.id || idx} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-secondary">记录 {idx + 1}</div>
                    <button type="button" onClick={() => removeMedia(idx)} className="px-3 py-1 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 hover:bg-red-500/15 transition">删除</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div className="space-y-1">
                      <div className="text-xs text-secondary">来源</div>
                      <input
                        value={m?.source || ''}
                        onChange={(e) => updateMedia(idx, { source: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none"
                        placeholder="豆瓣 / Pitchfork / ..."
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-secondary">评分（0-10）</div>
                      <input
                        value={m?.score ?? ''}
                        onChange={(e) => updateMedia(idx, { score: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none"
                        placeholder="8.5"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-secondary">发布日期</div>
                      <input
                        value={m?.published_at || ''}
                        onChange={(e) => updateMedia(idx, { published_at: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none"
                        placeholder="YYYY-MM-DD"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-secondary">链接</div>
                      <input
                        value={m?.url || ''}
                        onChange={(e) => updateMedia(idx, { url: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none"
                        placeholder="https://..."
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <div className="text-xs text-secondary">评价内容</div>
                      <textarea
                        value={m?.content || ''}
                        onChange={(e) => updateMedia(idx, { content: e.target.value })}
                        className="w-full min-h-[120px] p-3 rounded-2xl bg-black/20 border border-white/10 text-white text-sm outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {(Array.isArray(album?.media_reviews_items) ? album.media_reviews_items : []).length === 0 ? (
                <div className="text-sm text-white/60">暂无记录</div>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === 'awards' ? (
          <div className="glass-panel p-6 rounded-3xl border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="text-white font-bold">奖项 / 荣誉</div>
              <button
                type="button"
                onClick={addAward}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition"
              >
                添加记录
              </button>
            </div>
            <div className="space-y-3">
              {(Array.isArray(album?.awards_items) ? album.awards_items : []).map((a, idx) => (
                <div key={a?.id || idx} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-secondary">记录 {idx + 1}</div>
                    <button type="button" onClick={() => removeAward(idx)} className="px-3 py-1 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 hover:bg-red-500/15 transition">删除</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div className="space-y-1">
                      <div className="text-xs text-secondary">奖项名称 *</div>
                      <input
                        value={a?.name || ''}
                        onChange={(e) => updateAward(idx, { name: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-secondary">颁发机构</div>
                      <input
                        value={a?.org || ''}
                        onChange={(e) => updateAward(idx, { org: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-secondary">获奖年份</div>
                      <input
                        value={a?.year ?? ''}
                        onChange={(e) => updateAward(idx, { year: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none"
                        placeholder="2020"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-secondary">奖项类别</div>
                      <input
                        value={a?.category || ''}
                        onChange={(e) => updateAward(idx, { category: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none"
                        placeholder="最佳专辑 / ..."
                      />
                    </div>
                  </div>
                </div>
              ))}

              {(Array.isArray(album?.awards_items) ? album.awards_items : []).length === 0 ? (
                <div className="text-sm text-white/60">暂无记录</div>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === 'reviews' ? (
          <div className="glass-panel p-6 rounded-3xl border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="text-white font-bold">用户乐评</div>
              <button
                type="button"
                onClick={() => fetchReviews(false)}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition"
              >
                刷新
              </button>
            </div>

            {reviewsLoading ? (
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <Loader2 size={16} className="animate-spin" />
                加载中…
              </div>
            ) : reviews.length ? (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-white font-bold">{r.title || '（无标题）'}</div>
                        <div className="text-xs text-white/60 mt-1">
                          {r.author?.nickname || '用户'} · 评分 {Number(r.score)}/10 · {r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteReview(r.id).catch((e) => alert(e?.message || '删除失败'))}
                        className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300"
                        aria-label="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="mt-3 text-sm text-white/80 leading-relaxed prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: String(r.content || '') }} />
                  </div>
                ))}

                {reviewsCursor ? (
                  <button
                    type="button"
                    disabled={reviewsMoreLoading}
                    onClick={() => fetchReviews(true)}
                    className="h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80"
                  >
                    {reviewsMoreLoading ? '加载中…' : '加载更多（20条/页）'}
                  </button>
                ) : (
                  <div className="text-xs text-white/40">没有更多了</div>
                )}
              </div>
            ) : (
              <div className="text-sm text-white/60">暂无乐评</div>
            )}
          </div>
        ) : null}
      </div>

      <div className="space-y-6 xl:sticky xl:top-10">
        <div className="glass-panel p-5 rounded-3xl border border-white/10">
          <div className="flex items-center gap-2 text-white font-bold mb-3">
            <History size={16} className="text-accent" />
            版本历史
          </div>
          <div className="space-y-2">
            {versions.map((v) => (
              <div key={v.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-white">v{v.version_no}</div>
                  <button
                    type="button"
                    onClick={() => rollback(v.version_no)}
                    className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70 hover:text-white hover:bg-white/10 transition inline-flex items-center gap-1"
                  >
                    <RotateCcw size={12} />
                    回滚
                  </button>
                </div>
                <div className="text-[11px] text-secondary mt-1">{v.created_at ? new Date(v.created_at).toLocaleString() : '-'}</div>
                {v.reason ? <div className="text-xs text-white/70 mt-2 whitespace-pre-wrap">{v.reason}</div> : null}
              </div>
            ))}
            {versions.length === 0 ? <div className="text-sm text-white/60">暂无版本</div> : null}
          </div>
        </div>

        <div className="glass-panel p-5 rounded-3xl border border-white/10">
          <div className="text-white font-bold mb-3">操作日志</div>
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {logs.map((l) => (
              <div key={l.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-white/80">{l.action}</div>
                  <div className="text-[10px] text-secondary">{l.created_at ? new Date(l.created_at).toLocaleString() : '-'}</div>
                </div>
                {l.version_no ? <div className="text-[11px] text-secondary mt-1">v{l.version_no}</div> : null}
              </div>
            ))}
            {logs.length === 0 ? <div className="text-sm text-white/60">暂无日志</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
