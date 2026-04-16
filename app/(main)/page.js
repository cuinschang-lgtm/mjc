'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseBrowser'
import { Search, Plus, Filter, Tag, ExternalLink, Music, MoreHorizontal, Star, FileText, X, Trash2, ArrowUpDown } from 'lucide-react'
import Link from 'next/link'
import TagModal from '../../components/TagModal'
import ReviewModal from '../../components/ReviewModal'
import { cn } from '../../lib/utils'
import { useLanguage } from '@/contexts/LanguageContext'
import DoubanBadge from '../../components/DoubanBadge'
import { useRouter } from 'next/navigation'

export default function LibraryPage() {
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all', 'listened', 'want_to_listen'
  const [tagFilter, setTagFilter] = useState('all')
  const [sort, setSort] = useState('added_desc')
  const [editingItem, setEditingItem] = useState(null)
  const [viewingReviewItem, setViewingReviewItem] = useState(null)
  const [allTags, setAllTags] = useState([])
  const [deletingTags, setDeletingTags] = useState(new Set())
  const [deletingCollections, setDeletingCollections] = useState(new Set())
  const { t } = useLanguage()
  const router = useRouter()

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('library:state')
      if (saved) {
        const s = JSON.parse(saved)
        if (s.filter) setFilter(s.filter)
        if (s.tagFilter) setTagFilter(s.tagFilter)
        if (s.sort) setSort(s.sort)
      }
    } catch {}
    fetchLibrary()
  }, [])

  const fetchLibrary = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      const { data, error } = await supabase
        .from('user_collections')
        .select(`
          *,
          albums (
            *,
            reviews_aggregator (
              score,
              source_name
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCollections(data || [])
      
      // Extract unique tags
      const tags = new Set()
      data?.forEach(item => {
        item.custom_tags?.forEach(tag => tags.add(tag))
      })
      setAllTags(Array.from(tags))

    } catch (error) {
      console.error('Error fetching library:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTagsUpdated = (collectionId, newTags) => {
    setCollections(collections.map(item => 
      item.id === collectionId ? { ...item, custom_tags: newTags } : item
    ))
    
    // Update available tags list
    const tags = new Set(allTags)
    newTags.forEach(tag => tags.add(tag))
    setAllTags(Array.from(tags))
  }

  useEffect(() => {
    try {
      sessionStorage.setItem('library:state', JSON.stringify({ filter, tagFilter, sort }))
    } catch {}
  }, [filter, tagFilter, sort])

  const recalcAllTags = (items) => {
    const tags = new Set()
    items?.forEach((item) => {
      item.custom_tags?.forEach((tag) => tags.add(tag))
    })
    setAllTags(Array.from(tags))
  }

  const deleteFromLibrary = async (collectionId) => {
    if (!collectionId) return
    const item = collections.find((c) => c.id === collectionId)
    const title = item?.albums?.title || ''
    const artist = item?.albums?.artist || ''
    if (!confirm(`${t('library.deleteConfirm')}\n\n${title}${artist ? ` - ${artist}` : ''}`)) return

    try {
      setDeletingCollections((prev) => new Set(prev).add(collectionId))
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('user_collections')
        .delete()
        .eq('id', collectionId)
        .eq('user_id', user.id)

      if (error) throw error

      setCollections((prev) => {
        const next = prev.filter((c) => c.id !== collectionId)
        recalcAllTags(next)
        if (tagFilter !== 'all') {
          const stillExists = next.some((c) => c.custom_tags?.includes(tagFilter))
          if (!stillExists) setTagFilter('all')
        }
        return next
      })
    } catch (e) {
      console.error('Delete from library failed', e)
      alert(t('library.deleteFailed'))
    } finally {
      setDeletingCollections((prev) => {
        const n = new Set(prev)
        n.delete(collectionId)
        return n
      })
    }
  }

  const filteredCollections = collections.filter(item => {
    const statusMatch = filter === 'all' || item.status === filter
    const tagMatch = tagFilter === 'all' || item.custom_tags?.includes(tagFilter)
    return statusMatch && tagMatch
  })

  const sortedCollections = useMemo(() => {
    const getScore = (item) => {
      const score = item?.albums?.reviews_aggregator?.[0]?.score
      const n = score === null || score === undefined ? NaN : Number(score)
      return Number.isFinite(n) ? n : -Infinity
    }

    const getReleaseTs = (item) => {
      const raw = item?.albums?.release_date
      if (!raw) return -Infinity
      const ts = Date.parse(String(raw))
      return Number.isFinite(ts) ? ts : -Infinity
    }

    const getStr = (v) => String(v || '').toLowerCase()

    const list = [...filteredCollections]
    const cmp = (a, b) => {
      if (sort === 'added_desc') return Date.parse(b.created_at) - Date.parse(a.created_at)
      if (sort === 'added_asc') return Date.parse(a.created_at) - Date.parse(b.created_at)
      if (sort === 'title_asc') return getStr(a.albums?.title).localeCompare(getStr(b.albums?.title), 'zh')
      if (sort === 'title_desc') return getStr(b.albums?.title).localeCompare(getStr(a.albums?.title), 'zh')
      if (sort === 'artist_asc') return getStr(a.albums?.artist).localeCompare(getStr(b.albums?.artist), 'zh')
      if (sort === 'artist_desc') return getStr(b.albums?.artist).localeCompare(getStr(a.albums?.artist), 'zh')
      if (sort === 'release_desc') return getReleaseTs(b) - getReleaseTs(a)
      if (sort === 'release_asc') return getReleaseTs(a) - getReleaseTs(b)
      if (sort === 'score_desc') return getScore(b) - getScore(a)
      if (sort === 'score_asc') return getScore(a) - getScore(b)
      return 0
    }

    return list.sort(cmp)
  }, [filteredCollections, sort])

  const deleteTagGlobally = async (tag) => {
    if (!tag) return
    if (!confirm(`确定要删除标签 “${tag}” 吗？这会从所有专辑中移除该标签。`)) return
    try {
      setDeletingTags(prev => new Set(prev).add(tag))
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const affected = collections.filter(it => it.custom_tags?.includes(tag))
      for (const item of affected) {
        const nextTags = (item.custom_tags || []).filter(t => t !== tag)
        const { error } = await supabase.from('user_collections').update({ custom_tags: nextTags }).eq('id', item.id)
        if (error) console.error('Failed to remove tag for id', item.id, error)
      }
      // Update local state
      setCollections(prev => prev.map(it => it.custom_tags?.includes(tag) ? { ...it, custom_tags: it.custom_tags.filter(t => t !== tag) } : it))
      setAllTags(prev => prev.filter(t => t !== tag))
      if (tagFilter === tag) setTagFilter('all')
    } catch (e) {
      console.error('Global tag delete failed', e)
      alert('删除失败，请稍后重试')
    } finally {
      setDeletingTags(prev => { const n = new Set(prev); n.delete(tag); return n })
    }
  }

  return (
    <div className="space-y-12 animate-fade-in-up">
      <TagModal 
        isOpen={!!editingItem} 
        onClose={() => setEditingItem(null)} 
        collectionId={editingItem?.id}
        initialTags={editingItem?.custom_tags}
        onUpdate={handleTagsUpdated}
      />

      <ReviewModal
        isOpen={!!viewingReviewItem}
        onClose={() => setViewingReviewItem(null)}
        album={viewingReviewItem}
      />

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative">
        <div className="space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
            Overview
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight">
            {t('library.title')}<span className="text-accent">.</span>
          </h1>
          <p className="text-secondary text-lg max-w-md">
            {collections.length} {t('library.subtitle')}
          </p>
        </div>
        
        <div className="relative z-10">
           <Link href="/search" className="btn-primary px-8 py-3 rounded-full flex items-center gap-3 shadow-neon hover:scale-105 transition-transform group">
              <Plus size={20} className="group-hover:rotate-90 transition-transform" />
              <span className="font-bold">{t('library.addAlbum')}</span>
           </Link>
        </div>
        
        {/* Decorative background element for header */}
        <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-accent/5 rounded-full blur-[80px] -z-10 mix-blend-screen pointer-events-none" />
      </header>

      {/* Filter Bar - Glassmorphism Segmented Control */}
      <div className="sticky top-4 z-40 bg-background/80 backdrop-blur-xl border border-white/5 rounded-2xl p-2 flex flex-col md:flex-row justify-between items-center gap-4 shadow-glass">
        {/* Status Filter */}
        <div className="flex bg-black/20 rounded-xl p-1 w-full md:w-auto overflow-x-auto scrollbar-hide">
          <button 
            onClick={() => setFilter('all')}
            className={cn("px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex-1 md:flex-none", filter === 'all' ? 'bg-white text-black shadow-lg' : 'text-secondary hover:text-white hover:bg-white/5')}
          >
            {t('library.filterAll')}
          </button>
          <button 
            onClick={() => setFilter('listened')}
            className={cn("px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex-1 md:flex-none", filter === 'listened' ? 'bg-accent text-white shadow-neon' : 'text-secondary hover:text-white hover:bg-white/5')}
          >
            {t('library.filterListened')}
          </button>
          <button 
            onClick={() => setFilter('want_to_listen')}
            className={cn("px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex-1 md:flex-none", filter === 'want_to_listen' ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'text-secondary hover:text-white hover:bg-white/5')}
          >
            {t('library.filterWantToListen')}
          </button>
        </div>
        
        <div className="flex items-center gap-3 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-hide px-2 md:px-0">
          <div className="flex items-center gap-2 shrink-0">
            <ArrowUpDown size={16} className="text-accent" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-9 px-3 rounded-xl bg-black/20 border border-white/10 text-white text-xs font-semibold outline-none focus:border-accent/40"
              aria-label={t('library.sort')}
            >
              <option value="added_desc">{t('library.sortAddedDesc')}</option>
              <option value="added_asc">{t('library.sortAddedAsc')}</option>
              <option value="title_asc">{t('library.sortTitleAsc')}</option>
              <option value="title_desc">{t('library.sortTitleDesc')}</option>
              <option value="artist_asc">{t('library.sortArtistAsc')}</option>
              <option value="artist_desc">{t('library.sortArtistDesc')}</option>
              <option value="release_desc">{t('library.sortReleaseDesc')}</option>
              <option value="release_asc">{t('library.sortReleaseAsc')}</option>
              <option value="score_desc">{t('library.sortScoreDesc')}</option>
              <option value="score_asc">{t('library.sortScoreAsc')}</option>
            </select>
          </div>

          <Filter size={16} className="text-accent shrink-0" />
          <div className="flex gap-2">
            <button 
              onClick={() => setTagFilter('all')}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all border", tagFilter === 'all' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-transparent text-secondary border-white/5 hover:border-white/20')}
            >
              {t('library.allTags')}
            </button>
            {allTags.map(tag => (
              <div 
                key={tag}
                className={cn("inline-flex items-center gap-1 pl-3 pr-1 py-1.5 rounded-lg text-xs font-medium transition-all border whitespace-nowrap",
                  tagFilter === tag ? 'bg-accent/10 text-accent border-accent/20' : 'bg-transparent text-secondary border-white/5 hover:border-white/20')}
              >
                <button
                  onClick={() => setTagFilter(tag)}
                  className="outline-none"
                  title={`${t('library.tagFilterPrefix')}${tag}`}
                >
                  #{tag}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteTagGlobally(tag) }}
                  disabled={deletingTags.has(tag)}
                  className="ml-1 w-5 h-5 rounded-md flex items-center justify-center text-secondary hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:pointer-events-none"
                  title={`${t('library.tagDeletePrefix')}${tag}`}
                  aria-label={`${t('library.tagDeletePrefix')}${tag}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="aspect-[3/4] bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredCollections.length === 0 ? (
        <div className="text-center py-32 border border-dashed border-white/10 rounded-3xl bg-white/[0.02] flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="w-24 h-24 bg-gradient-to-br from-white/5 to-white/10 rounded-full flex items-center justify-center mb-6 border border-white/5 group-hover:scale-110 transition-transform duration-500 relative z-10 shadow-xl">
            <Search className="text-secondary group-hover:text-accent transition-colors" size={40} />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2 relative z-10">
            {collections.length === 0 ? t('library.emptyTitle') : t('library.noFilterTitle')}
          </h3>
          <p className="text-secondary max-w-sm mx-auto mb-8 relative z-10">
            {collections.length === 0 ? t('library.emptyDesc') : t('library.noFilterDesc')}
          </p>
          {collections.length === 0 && (
            <Link href="/search" className="btn-primary px-8 py-3 rounded-full font-bold shadow-neon relative z-10 hover:shadow-[0_0_30px_rgba(255,77,77,0.5)] transition-shadow">
              {t('library.searchButton')}
            </Link>
          )}
          {process.env.NODE_ENV !== 'production' && collections.length === 0 && (
            <div className="mt-10 relative z-10 w-full max-w-md">
              <div className="mx-auto w-56">
                <div
                  data-tour="album-cover"
                  className="aspect-square rounded-2xl overflow-hidden relative bg-white/5 border border-white/10 cursor-pointer hover:border-accent/30 transition-colors flex flex-col items-center justify-center gap-2"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    try {
                      sessionStorage.setItem('nav:from', 'library')
                    } catch {}
                    router.push('/album/demo')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      try {
                        sessionStorage.setItem('nav:from', 'library')
                      } catch {}
                      router.push('/album/demo')
                    }
                  }}
                >
                  <Music size={36} className="text-secondary/35" />
                  <div className="text-xs text-secondary/75 font-bold">示例专辑</div>
                  <div className="text-[10px] text-secondary/45 font-bold tracking-widest uppercase">
                    Tour Preview
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
          {sortedCollections.map((item) => {
             return (
              <div 
                key={item.id} 
                className="group relative flex flex-col"
                onMouseEnter={() => {
                  // Prefetch album details API for snappier navigation
                  if (item.album_id) {
                    const url = `/api/album-details?albumId=${encodeURIComponent(item.album_id)}`
                    fetch(url, { priority: 'low' }).catch(() => {})
                  }
                }}
              >
                <div
                  data-tour="album-cover"
                  className="aspect-square rounded-2xl overflow-hidden mb-4 relative bg-card shadow-lg border border-white/5 group-hover:border-accent/30 group-hover:shadow-card-hover transition-all duration-500 group-hover:-translate-y-2 cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => { try { sessionStorage.setItem('nav:from', 'library') } catch {}; router.push(`/album/${item.album_id}`) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { try { sessionStorage.setItem('nav:from', 'library') } catch {}; router.push(`/album/${item.album_id}`) }
                  }}
                >
                  {item.albums?.cover_url ? (
                    <img 
                      src={item.albums.cover_url} 
                      alt={item.albums.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-white/5 p-4 text-center">
                      <Music size={32} className="text-secondary/20 mb-2" />
                      <span className="text-xs text-secondary/40 font-bold uppercase tracking-widest">No Cover</span>
                    </div>
                  )}
                  
                  {/* Overlay on Hover - Clean Minimalist */}
                  <div 
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-3 backdrop-blur-[4px] p-6"
                    onClick={(e) => {
                      if (e.target === e.currentTarget) {
                        try { sessionStorage.setItem('nav:from', 'library') } catch {}
                        router.push(`/album/${item.album_id}`)
                      }
                    }}
                  >
                     <div className="grid grid-cols-2 gap-3 w-full">
                        {/* Netease Cloud Music */}
                        <a 
                          href={`https://music.163.com/#/search/m/?s=${encodeURIComponent(item.albums?.title + " " + item.albums?.artist)}&type=10`} 
                          target="_blank" 
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-center h-10 bg-[#C20C0C] rounded-xl hover:scale-105 transition-transform shadow-lg group/icon" 
                          title="Netease Cloud Music"
                        >
                          <img 
                            src="https://cdn.simpleicons.org/neteasecloudmusic/FFFFFF" 
                            alt="Netease Cloud Music" 
                            className="w-6 h-6"
                            loading="lazy"
                          />
                        </a>

                        {/* Spotify */}
                        <a 
                          href={`https://open.spotify.com/search/${encodeURIComponent(item.albums?.title + " " + item.albums?.artist)}`} 
                          target="_blank" 
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-center h-10 bg-[#1DB954] rounded-xl hover:scale-105 transition-transform shadow-lg group/icon" 
                          title="Spotify"
                        >
                          <img 
                            src="https://cdn.simpleicons.org/spotify/FFFFFF" 
                            alt="Spotify" 
                            className="w-6 h-6"
                            loading="lazy"
                          />
                        </a>

                        {/* Douban */}
                        <a 
                          href={`https://search.douban.com/music/subject_search?search_text=${encodeURIComponent(item.albums?.title + " " + item.albums?.artist)}`} 
                          target="_blank" 
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-center h-10 bg-[#007722] rounded-xl hover:scale-105 transition-transform shadow-lg group/icon" 
                          title="Douban"
                        >
                          <img 
                            src="https://cdn.simpleicons.org/douban/FFFFFF" 
                            alt="Douban" 
                            className="w-6 h-6"
                            loading="lazy"
                          />
                        </a>

                        {/* Genius */}
                        <a 
                          href={`https://genius.com/search?q=${encodeURIComponent(item.albums?.title + " " + item.albums?.artist)}`} 
                          target="_blank" 
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-center h-10 bg-[#FFFF64] rounded-xl hover:scale-105 transition-transform shadow-lg group/icon" 
                          title="Genius"
                        >
                          <img 
                            src="https://cdn.simpleicons.org/genius/000000" 
                            alt="Genius" 
                            className="w-6 h-6"
                            loading="lazy"
                          />
                        </a>
                     </div>
                     
                    <div className="w-full grid grid-cols-2 gap-3 mt-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingItem(item)
                        }}
                        className="h-10 bg-white/10 backdrop-blur-md text-white rounded-xl text-xs font-bold hover:bg-white/20 transition-colors border border-white/10"
                      >
                        {t('library.editTags')}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteFromLibrary(item.id)
                        }}
                        disabled={deletingCollections.has(item.id)}
                        className={cn(
                          "h-10 rounded-xl text-xs font-bold transition-colors border flex items-center justify-center gap-2",
                          deletingCollections.has(item.id)
                            ? 'bg-white/5 text-secondary border-white/10 cursor-not-allowed'
                            : 'bg-red-500/15 text-red-200 border-red-500/20 hover:bg-red-500/25'
                        )}
                        title={t('library.delete')}
                        aria-label={t('library.delete')}
                      >
                        <Trash2 size={14} />
                        <span>{deletingCollections.has(item.id) ? t('library.deleting') : t('library.delete')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Status Badge - Minimal Dot */}
                  <div className="absolute top-3 right-3 pointer-events-none">
                     {item.status === 'listened' && (
                       <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,1)] border border-black/20" title="Listened" />
                     )}
                     {item.status === 'want_to_listen' && (
                       <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,1)] border border-black/20" title="Want to Listen" />
                     )}
                  </div>

                  {/* Douban rating badge (fetched live) */}
                  <DoubanBadge title={item.albums?.title} artist={item.albums?.artist} />
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-white font-bold truncate group-hover:text-accent transition-colors leading-tight">{item.albums?.title}</h3>
                  <p className="text-secondary text-xs font-medium truncate">{item.albums?.artist}</p>
                  
                  {/* Tags - Pill Style */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {item.custom_tags && item.custom_tags.length > 0 ? (
                      item.custom_tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[9px] px-2 py-0.5 bg-white/5 rounded-full text-secondary/80 border border-white/5 hover:border-accent/30 hover:text-accent hover:bg-accent/5 transition-all cursor-pointer font-medium uppercase tracking-wider" onClick={() => setTagFilter(tag)}>
                          {tag}
                        </span>
                      ))
                    ) : null}
                  </div>
                </div>
              </div>
             )
          })}
        </div>
      )}
    </div>
  )
}
