'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseBrowser'
import { Plus, Search, Loader2, Shield, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AdminAlbumsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [creating, setCreating] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ title: '', artist: '', cover_url: '', release_date: '' })

  const qRef = useRef('')
  const statusRef = useRef('')

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

  const fetchList = async ({ nextQ, nextStatus } = {}) => {
    setError('')
    setLoading(true)
    try {
      const token = await ensureAdmin()
      if (!token) return
      const qs = new URLSearchParams()
      const realQ = (nextQ ?? qRef.current) || ''
      const realStatus = (nextStatus ?? statusRef.current) || ''
      if (realQ.trim()) qs.set('q', realQ.trim())
      if (realStatus) qs.set('status', realStatus)
      const res = await fetch(`/api/admin/albums?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'failed')
      setItems(Array.isArray(json?.items) ? json.items : [])
    } catch (e) {
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchList()
  }, [])

  useEffect(() => {
    qRef.current = q
    const id = setTimeout(() => fetchList({ nextQ: q }), 350)
    return () => clearTimeout(id)
  }, [q])

  useEffect(() => {
    statusRef.current = status
    fetchList({ nextStatus: status })
  }, [status])

  const openCreate = () => {
    setForm({ title: '', artist: '', cover_url: '', release_date: '' })
    setCreateOpen(true)
  }

  const createAlbum = async () => {
    if (creating) return
    setCreating(true)
    setError('')
    try {
      const token = await ensureAdmin()
      if (!token) return
      const res = await fetch('/api/admin/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: form.title,
          artist: form.artist,
          cover_url: form.cover_url || null,
          release_date: form.release_date || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'failed')
      const album = json?.album
      setCreateOpen(false)
      if (album?.id) router.push(`/albums/${album.id}/edit`)
      await fetchList()
    } catch (e) {
      setError(String(e?.message || e))
    } finally {
      setCreating(false)
    }
  }

  const statusBadge = (s) => {
    const v = String(s || 'draft')
    if (v === 'published') return 'bg-green-500/10 border-green-500/20 text-green-300'
    if (v === 'offline') return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300'
    return 'bg-white/5 border-white/10 text-white/70'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-accent" />
            <h1 className="text-2xl font-bold text-white">专辑管理</h1>
          </div>
          <div className="text-secondary text-sm mt-1">仅管理员可访问</div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 rounded-xl bg-accent text-black font-bold hover:brightness-110 transition flex items-center gap-2"
        >
          <Plus size={16} />
          新建专辑
        </button>
      </div>

      <div className="glass-panel p-5 rounded-3xl border border-white/10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-3">
          <div className="flex items-center gap-2 h-11 px-3 rounded-2xl bg-black/20 border border-white/10">
            <Search size={16} className="text-white/50" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="flex-1 bg-transparent outline-none text-white text-sm"
              placeholder="搜索专辑名 / 艺人..."
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-11 px-3 rounded-2xl bg-black/20 border border-white/10 text-white text-sm outline-none"
          >
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="offline">已下线</option>
          </select>
        </div>

        {error ? <div className="mt-4 text-sm text-red-300">{error}</div> : null}

        {loading ? (
          <div className="mt-8 flex items-center gap-2 text-secondary">
            <Loader2 size={16} className="animate-spin" />
            加载中...
          </div>
        ) : (
          <div className="mt-6 divide-y divide-white/5">
            {items.map((a) => (
              <div
                key={a.id}
                className="py-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 rounded-2xl px-3 transition"
                onClick={() => router.push(`/albums/${a.id}/edit`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') router.push(`/albums/${a.id}/edit`)
                }}
              >
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 overflow-hidden flex-shrink-0">
                  {a.cover_url ? <img src={a.cover_url} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-white font-bold truncate">{a.title}</div>
                    <span className={cn('px-2 py-0.5 text-[10px] rounded-full border', statusBadge(a.admin_status))}>{a.admin_status || 'draft'}</span>
                  </div>
                  <div className="text-secondary text-sm truncate">{a.artist}</div>
                  <div className="text-[11px] text-secondary/60 mt-1">更新：{a.updated_at ? new Date(a.updated_at).toLocaleString() : '-'}</div>
                </div>
                <a
                  href={`/album/${a.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-secondary hover:text-accent transition inline-flex items-center gap-1"
                >
                  详情页
                  <ExternalLink size={12} />
                </a>
              </div>
            ))}
            {items.length === 0 ? <div className="py-12 text-center text-secondary">暂无数据</div> : null}
          </div>
        )}
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="w-full max-w-[560px] glass-panel rounded-3xl border border-white/10 p-6">
            <div className="text-white font-bold text-lg mb-4">新建专辑</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-xs text-secondary">专辑名 *</div>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none"
                />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-secondary">艺人 *</div>
                <input
                  value={form.artist}
                  onChange={(e) => setForm((p) => ({ ...p, artist: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <div className="text-xs text-secondary">封面 URL</div>
                <input
                  value={form.cover_url}
                  onChange={(e) => setForm((p) => ({ ...p, cover_url: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none"
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-secondary">发行日期（YYYY-MM-DD）</div>
                <input
                  value={form.release_date}
                  onChange={(e) => setForm((p) => ({ ...p, release_date: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm outline-none"
                  placeholder="2020-01-01"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition"
                disabled={creating}
              >
                取消
              </button>
              <button
                type="button"
                onClick={createAlbum}
                className="px-4 py-2 rounded-xl bg-accent text-black font-bold hover:brightness-110 transition disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                disabled={creating}
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : null}
                {creating ? '创建中' : '创建'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

