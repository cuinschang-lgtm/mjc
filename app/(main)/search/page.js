'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import debounce from 'lodash/debounce'
import { Search as SearchIcon, Plus, Check, Loader2, ExternalLink, Star, Users, Mic2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseBrowser'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/contexts/LanguageContext'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('album')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [addingId, setAddingId] = useState(null)
  const inputRef = useRef(null)
  const router = useRouter()
  const { t } = useLanguage()

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('search:last')
      if (cached) {
        const s = JSON.parse(cached)
        if (s.query) setQuery(s.query)
        if (s.category) setCategory(s.category)
        if (Array.isArray(s.results) && s.results.length) setResults(s.results)
      }
    } catch {}
  }, [])

  useEffect(() => {
    const onEvt = async (e) => {
      const detail = e?.detail || {}
      if (detail.type !== 'search:prefill') return
      const term = String(detail.term || '').trim()
      if (!term) return
      setQuery(term)
      if (detail.category) setCategory(String(detail.category))
      try {
        inputRef.current?.focus()
      } catch {}

      try {
        const next = await doSearch({ term, nextCategory: detail.category || category, immediate: true })
        window.dispatchEvent(new CustomEvent('pickup:onboarding', { detail: { type: 'search:results_ready', count: next.length } }))
      } catch {
        window.dispatchEvent(new CustomEvent('pickup:onboarding', { detail: { type: 'search:results_ready', count: 0 } }))
      } finally {
        setLoading(false)
      }
    }

    window.addEventListener('pickup:onboarding', onEvt)
    return () => window.removeEventListener('pickup:onboarding', onEvt)
  }, [])

  const doSearch = async ({ term, nextCategory, immediate }) => {
    const q = String(term || '').trim()
    const c = String(nextCategory || category)
    if (!q) return []

    // 客户端缓存检查
    const cacheKey = `search:${c}:${q.toLowerCase()}`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const { data, timestamp } = JSON.parse(cached)
        const age = Date.now() - timestamp
        // 缓存10分钟有效
        if (age < 10 * 60 * 1000) {
          console.log('Using cached search results')
          setResults(data)
          return data
        }
      }
    } catch (e) {
      console.error('Cache read error:', e)
    }

    setLoading(true)
    setResults([])

    try {
      if (c === 'user') {
        let token = null
        try {
          const { data } = await supabase.auth.getSession()
          token = data?.session?.access_token || null
        } catch {}
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 8000)
        const res = await fetch(`/api/search/users?q=${encodeURIComponent(q)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        }).finally(() => clearTimeout(timer))
        const data = await res.json().catch(() => null)
        if (immediate && data?.error === 'email_search_requires_service_role') {
          alert('邮箱搜索需要服务端能力：配置 SUPABASE_SERVICE_ROLE_KEY，或执行 Supabase 数据库迁移以启用邮箱搜索函数。')
        } else if (immediate && data?.error === 'email_search_requires_login') {
          alert('请先登录后再使用邮箱搜索。')
        }
        const next = Array.isArray(data?.users) ? data.users : []
        setResults(next)

        // 保存到客户端缓存
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ data: next, timestamp: Date.now() }))
        } catch {}

        return next
      }

      if (c === 'artist') {
        const res = await fetch(`/api/search?term=${encodeURIComponent(q)}&type=artist`)
        const data = await res.json().catch(() => null)
        const next = Array.isArray(data?.results) ? data.results : []
        setResults(next)

        // 保存到客户端缓存
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ data: next, timestamp: Date.now() }))
        } catch {}

        return next
      }

      const res = await fetch(`/api/search?term=${encodeURIComponent(q)}`)
      const data = await res.json().catch(() => null)
      const next = Array.isArray(data?.results)
        ? data.results.map((album) => ({
            ...album,
            mockScore: album.mockScore || (Math.random() * (9.8 - 8.0) + 8.0).toFixed(1),
          }))
        : []
      setResults(next)

      // 保存到客户端缓存
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ data: next, timestamp: Date.now() }))
      } catch {}

      return next
    } catch (error) {
      if (immediate) console.error('Search failed:', error)
      return []
    } finally {
      setLoading(false)
    }
  }

  const searchAlbums = async (e) => {
    e.preventDefault()
    if (!query.trim() || loading) return

    try {
      const next = await doSearch({ term: query, nextCategory: category, immediate: true })
      try {
        window.dispatchEvent(new CustomEvent('pickup:onboarding', { detail: { type: 'search:results_ready', count: next.length } }))
      } catch {}
    } catch (error) {
      console.error('Search failed:', error)
    }
  }

  const debouncedSearch = useMemo(
    () =>
      debounce((term, c) => {
        doSearch({ term, nextCategory: c, immediate: false })
      }, 350),
    [category]
  )

  useEffect(() => {
    const q = String(query || '').trim()
    if (!q) return
    if (q.length < 2) return
    debouncedSearch(q, category)
    return () => debouncedSearch.cancel()
  }, [query, category, debouncedSearch])

  const addToLibrary = async (album, status = 'want_to_listen') => {
    setAddingId(album.collectionId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/auth?mode=signup&returnTo=${encodeURIComponent('/search')}`)
        return
      }

      // 1. Check if album exists or insert it
      let albumId
      // Try resolve external ids
      let neteaseId = null
      if (album?.source === 'Netease') {
        if (typeof album.collectionId === 'string' && album.collectionId.startsWith('ne_')) {
          neteaseId = album.collectionId.slice(3)
        } else if (typeof album.collectionViewUrl === 'string') {
          const m = album.collectionViewUrl.match(/album\\?id=(\\d+)/)
          if (m) neteaseId = m[1]
        }
      }

      // Query by external id first (if present), else by title+artist
      let existingAlbum = null
      if (neteaseId) {
        try {
          const q1 = await supabase
            .from('albums')
            .select('id')
            .eq('netease_album_id', neteaseId)
            .maybeSingle()
          if (!q1.error) existingAlbum = q1.data
        } catch (e) {}
      }
      if (!existingAlbum) {
        const q2 = await supabase
          .from('albums')
          .select('id')
          .eq('title', album.collectionName)
          .eq('artist', album.artistName)
          .maybeSingle()
        if (q2.error) throw q2.error
        existingAlbum = q2.data
      }

      if (existingAlbum) {
        albumId = existingAlbum.id
        if (neteaseId) {
          try {
            await supabase
              .from('albums')
              .update({ netease_album_id: neteaseId })
              .eq('id', albumId)
              .is('netease_album_id', null)
          } catch {}
        }
      } else {
        // Prepare cover URL safely
        let coverUrl = album.artworkUrl100
        if (coverUrl && typeof coverUrl === 'string' && coverUrl.includes('100x100')) {
             coverUrl = coverUrl.replace('100x100', '600x600')
        }

        let newAlbum = null
        let insertError = null
        try {
          const r1 = await supabase
            .from('albums')
            .insert({
              title: album.collectionName,
              artist: album.artistName,
              cover_url: coverUrl,
              release_date: album.releaseDate ? new Date(album.releaseDate).toISOString().split('T')[0] : null,
              netease_album_id: neteaseId || null,
            })
            .select()
            .single()
          newAlbum = r1.data
          insertError = r1.error
        } catch (e) {
          insertError = e
        }
        if (insertError) {
          if (neteaseId) {
            try {
              const q = await supabase
                .from('albums')
                .select('id')
                .eq('netease_album_id', neteaseId)
                .maybeSingle()
              if (!q.error && q.data?.id) {
                newAlbum = q.data
                insertError = null
              }
            } catch {}
          }
        }
        if (insertError) {
          try {
            const r2 = await supabase
              .from('albums')
              .insert({
                title: album.collectionName,
                artist: album.artistName,
                cover_url: coverUrl,
                release_date: album.releaseDate ? new Date(album.releaseDate).toISOString().split('T')[0] : null,
              })
              .select()
              .single()
            newAlbum = r2.data
            insertError = r2.error
          } catch (e) {
            insertError = e
          }
        }
        if (insertError) throw new Error(`Failed to save album details: ${insertError.message || insertError}`)
        albumId = newAlbum.id

        // Add Mock Aggregated Review
        // Check if reviews already exist? No, simplistic for now.
        const { error: reviewError } = await supabase.from('reviews_aggregator').insert({
          album_id: albumId,
          source_name: 'Metacritic',
          score: album.mockScore || 8.5,
          expert_review_summary: 'A masterpiece of modern production...'
        })
        if (reviewError) console.warn('Review insert failed (non-fatal):', reviewError)
      }

      // 2. Add to user collection
      const { error: collectionError } = await supabase
        .from('user_collections')
        .insert({
          user_id: user.id,
          album_id: albumId,
          status: status,
          custom_tags: [],
          personal_rating: null
        })

      if (collectionError) {
        if (collectionError.code === '23505') { // Unique violation
          alert(t('search.alreadyExists'))
          try {
            window.dispatchEvent(new CustomEvent('pickup:onboarding', { detail: { type: 'search:album_added', albumId } }))
          } catch {}
        } else {
          console.error('Collection insert error:', collectionError)
          throw new Error(`${t('search.errorAdd')}: ${collectionError.message}`)
        }
      } else {
        console.log(t('search.successAdd'))
        try {
          window.dispatchEvent(new CustomEvent('pickup:onboarding', { detail: { type: 'search:album_added', albumId } }))
        } catch {}
      }

    } catch (error) {
      console.error('Error adding album:', error)
      alert(error.message || t('search.errorAdd'))
    } finally {
      setAddingId(null)
    }
  }

  const ensureAlbumId = async (album) => {
    // Resolve external id first
    let neteaseId = null
    if (album?.source === 'Netease') {
      if (typeof album.collectionId === 'string' && album.collectionId.startsWith('ne_')) {
        neteaseId = album.collectionId.slice(3)
      } else if (typeof album.collectionViewUrl === 'string') {
        const m = album.collectionViewUrl.match(/album\\?id=(\\d+)/)
        if (m) neteaseId = m[1]
      }
    }

    // Try find by external id
    if (neteaseId) {
      try {
        const q1 = await supabase
          .from('albums')
          .select('id')
          .eq('netease_album_id', neteaseId)
          .maybeSingle()
        if (!q1.error && q1.data) return q1.data.id
      } catch (e) {}
    }

    // Fallback to title + artist
    const q2 = await supabase
      .from('albums')
      .select('id')
      .eq('title', album.collectionName)
      .eq('artist', album.artistName)
      .maybeSingle()

    if (q2.error) throw q2.error
    if (q2.data) return q2.data.id

    let coverUrl = album.artworkUrl100
    if (coverUrl && typeof coverUrl === 'string' && coverUrl.includes('100x100')) {
      coverUrl = coverUrl.replace('100x100', '600x600')
    }

    let newAlbum = null
    let insertError = null
    try {
      const r1 = await supabase
        .from('albums')
        .insert({
          title: album.collectionName,
          artist: album.artistName,
          cover_url: coverUrl,
          release_date: album.releaseDate ? new Date(album.releaseDate).toISOString().split('T')[0] : null,
          netease_album_id: neteaseId || null,
        })
        .select()
        .single()
      newAlbum = r1.data
      insertError = r1.error
    } catch (e) {
      insertError = e
    }
    if (insertError) {
      try {
        const r2 = await supabase
          .from('albums')
          .insert({
            title: album.collectionName,
            artist: album.artistName,
            cover_url: coverUrl,
            release_date: album.releaseDate ? new Date(album.releaseDate).toISOString().split('T')[0] : null,
          })
          .select()
          .single()
        newAlbum = r2.data
        insertError = r2.error
      } catch (e) {
        insertError = e
      }
    }
    if (insertError) throw insertError
    return newAlbum.id
  }

  const openAlbumDetail = async (album) => {
    try {
      try {
        sessionStorage.setItem('nav:from', 'search')
        sessionStorage.setItem('search:last', JSON.stringify({ query, category, results }))
      } catch {}
      // 立即跳转，在详情页加载数据
      const albumId = await ensureAlbumId(album)
      router.push(`/album/${albumId}`)
    } catch (e) {
      console.error('Open album detail failed:', e)
      alert('打开专辑详情失败，请稍后重试')
    }
  }

  const placeholder =
    category === 'user'
      ? '输入 UID 或邮箱进行精确搜索'
      : category === 'artist'
        ? '搜索艺人'
        : t('search.placeholder')

  return (
    <div className="max-w-7xl mx-auto relative animate-fade-in-up">
      {/* Search Header */}
      <div className="mb-16 text-center max-w-3xl mx-auto">
        <h1 className="text-5xl font-bold text-white mb-6 tracking-tight">
          {t('search.title')}<span className="text-accent">.</span>
        </h1>
        <p className="text-secondary mb-8 text-lg">Find your favorite albums from Netease Cloud Music & iTunes.</p>
        
        <form onSubmit={searchAlbums} className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-accent to-orange-500 rounded-full blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500" />
          <div className="relative flex items-center">
            <div className="relative flex w-full items-center gap-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full pl-3 pr-2 py-2 shadow-glass focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/50 transition-all">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-secondary">
                  {category === 'user' ? <Users size={18} /> : category === 'artist' ? <Mic2 size={18} /> : <SearchIcon size={18} />}
                </div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-10 max-w-[96px] sm:max-w-none bg-black/30 backdrop-blur-xl border border-white/10 rounded-full px-3 text-xs font-bold text-white focus:outline-none focus:border-accent/50"
                  aria-label="搜索分类"
                >
                  <option value="album">专辑</option>
                  <option value="artist">艺术家</option>
                  <option value="user">用户</option>
                </select>
              </div>

              <input
                ref={inputRef}
                data-tour="search-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-transparent py-3 px-3 pr-28 text-white placeholder-secondary/50 focus:outline-none text-lg min-w-0"
              />

              <button
                type="submit"
                disabled={loading}
                className="absolute right-2 top-2 bottom-2 btn-primary px-8 rounded-full font-bold text-sm shadow-lg hover:scale-105 transition-transform"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : t('common.search')}
              </button>
            </div>
          </div>
        </form>
      </div>

      {category === 'album' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
          {results.map((album, index) => (
            <div
              key={album.collectionId}
              className="group relative flex flex-col"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div
                className="aspect-square rounded-2xl overflow-hidden mb-4 relative bg-card shadow-lg border border-white/5 group-hover:border-accent/30 group-hover:shadow-card-hover transition-all duration-500 group-hover:-translate-y-2 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => openAlbumDetail(album)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') openAlbumDetail(album)
                }}
              >
                <img
                  src={String(album.artworkUrl100 || '').replace('100x100', '400x400')}
                  alt={album.collectionName}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  loading="lazy"
                />

                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg px-2 py-1 flex items-center gap-1 z-10 shadow-lg">
                  <Star size={12} className="text-yellow-400 fill-yellow-400" />
                  <span className="text-xs font-bold text-white">{album.mockScore}</span>
                </div>

                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-3 backdrop-blur-[4px] p-6">
                  <button
                    data-tour={index === 0 ? 'search-want' : undefined}
                    onClick={(e) => {
                      e.stopPropagation()
                      addToLibrary(album, 'want_to_listen')
                    }}
                    disabled={addingId === album.collectionId}
                    className="w-full py-3 btn-primary rounded-xl font-bold text-sm shadow-lg hover:scale-105 transition-transform flex items-center justify-center gap-2"
                  >
                    {addingId === album.collectionId ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                    {t('search.wantToListen')}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      addToLibrary(album, 'listened')
                    }}
                    disabled={addingId === album.collectionId}
                    className="w-full py-3 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-xl font-bold text-sm hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                  >
                    {addingId === album.collectionId ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                    {t('search.listened')}
                  </button>
                </div>
              </div>

              <div className="px-1">
                <h3
                  className="text-white font-bold truncate mb-1 text-base group-hover:text-accent transition-colors"
                  title={album.collectionName}
                >
                  {album.collectionName}
                </h3>
                <p className="text-secondary text-sm truncate mb-2 font-medium">{album.artistName}</p>

                <div className="flex items-center justify-between text-xs text-secondary/60 font-medium uppercase tracking-wide">
                  <span>{album.releaseDate ? new Date(album.releaseDate).getFullYear() : ''}</span>
                  {album.collectionViewUrl ? (
                    <a
                      href={album.collectionViewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-accent flex items-center gap-1 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Link <ExternalLink size={10} />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {category === 'artist' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {results.map((a) => (
            <a
              key={a.artistId}
              href={a.artistViewUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-panel p-6 rounded-3xl border border-white/10 hover:border-accent/30 transition-colors flex items-center gap-4"
            >
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                {a?.artworkUrl100 ? (
                  <img src={a.artworkUrl100} alt={a.artistName} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <Mic2 size={22} className="text-secondary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-white font-bold truncate">{a.artistName}</div>
                <div className="text-xs text-secondary mt-1">{a.source || ''}</div>
              </div>
              <ExternalLink size={16} className="text-secondary" />
            </a>
          ))}
        </div>
      ) : null}

      {category === 'user' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {results.map((u) => (
            <button
              key={u.userId}
              type="button"
              onClick={() => router.push(`/user/${u.userId}`)}
              className="glass-panel p-6 rounded-3xl border border-white/10 hover:border-accent/30 transition-colors flex items-center gap-4 text-left"
            >
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                {u?.avatarUrl ? (
                  <img src={u.avatarUrl} alt={u.nickname || 'user'} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <Users size={22} className="text-secondary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-white font-bold truncate">{u.nickname || '未设置昵称'}</div>
                <div className="text-xs text-secondary break-all mt-1">UID: {u.userId}</div>
              </div>
              <ExternalLink size={16} className="text-secondary" />
            </button>
          ))}
        </div>
      ) : null}
      
      {results.length === 0 && !loading && query && (
         <div className="text-center py-32">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
              <SearchIcon className="text-secondary" size={24} />
            </div>
            <p className="text-secondary text-lg">{t('search.noResults')}</p>
         </div>
      )}
    </div>
  )
}
