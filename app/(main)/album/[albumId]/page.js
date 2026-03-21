'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Clock, ExternalLink, ImageOff, ListMusic, RefreshCw, Share2, Star, X } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { supabase } from '@/lib/supabase'
import QRCode from 'qrcode'
import tinycolor from 'tinycolor2'
import CanvasPoster from '@/components/CanvasPoster'
import {
  buildPosterFilename,
  downloadBlob,
  isBlankImage,
  preloadImage,
  proxyImageUrl,
  renderPosterFallbackCanvas,
  renderPosterToBlob,
} from '@/lib/sharePoster'

function SectionCard({ title, children }) {
  return (
    <section className="glass-panel p-6 rounded-3xl border border-white/10">
      <h2 className="text-lg font-bold text-white mb-3">{title}</h2>
      <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{children}</div>
    </section>
  )
}

export default function AlbumDetailPage() {
  const params = useParams()
  const router = useRouter()
  const albumId = params?.albumId

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [zoomOpen, setZoomOpen] = useState(false)
  const [coverError, setCoverError] = useState(false)
  const [showAllTracks, setShowAllTracks] = useState(false)
  const [generatingPoster, setGeneratingPoster] = useState(false)
  const [posterVariant, setPosterVariant] = useState('glass')
  const [posterMounted, setPosterMounted] = useState(false)
  const [myTags, setMyTags] = useState([])
  const [myRating, setMyRating] = useState(null)
  const [qrDataURL, setQrDataURL] = useState('')
  const [accentColor, setAccentColor] = useState('')

  const posterRef = useRef(null)

  const coverUrl = data?.basic?.coverImageUrl || null
  const title = data?.basic?.title || ''
  const artistName = data?.basic?.artistName || ''

  const posterCoverUrl = useMemo(() => proxyImageUrl(coverUrl), [coverUrl])
  const year = useMemo(() => {
    const d = data?.basic?.releaseDate
    if (!d) return ''
    const m = String(d).match(/^(\d{4})/)
    return m ? m[1] : ''
  }, [data])

  const sections = useMemo(() => {
    const c = data?.content || {}
    return [
      { key: 'artistBio', title: '艺术家简介', value: c.artistBio },
      { key: 'creationBackground', title: '创作背景简介', value: c.creationBackground },
      { key: 'mediaReviews', title: '乐评 / 媒体评价', value: c.mediaReviews },
      { key: 'awards', title: '奖项 / 荣誉', value: c.awards },
    ]
  }, [data])

  const fetchDetail = async (refresh = false) => {
    if (!albumId) return
    setLoading(true)
    setError('')
    try {
      const url = `/api/album-details?albumId=${encodeURIComponent(albumId)}${refresh ? '&refresh=1' : ''}`
      const res = await fetch(url)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'failed')
      setData(json)
    } catch (e) {
      setError(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDetail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumId])

  useEffect(() => {
    try {
      const v = sessionStorage.getItem('poster:variant')
      if (v === 'glass' || v === 'vinyl') setPosterVariant(v)
    } catch {}
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem('poster:variant', posterVariant)
    } catch {}
  }, [posterVariant])

  useEffect(() => {
    const run = async () => {
      if (!albumId) return
      try {
        const { data: auth } = await supabase.auth.getUser()
        const user = auth?.user
        if (!user) {
          setMyTags([])
          setMyRating(null)
          return
        }
        const { data: row } = await supabase
          .from('user_collections')
          .select('custom_tags, personal_rating')
          .eq('user_id', user.id)
          .eq('album_id', albumId)
          .maybeSingle()

        setMyTags(Array.isArray(row?.custom_tags) ? row.custom_tags : [])
        setMyRating(typeof row?.personal_rating === 'number' ? row.personal_rating : null)
      } catch {
        setMyTags([])
        setMyRating(null)
      }
    }
    run()
  }, [albumId])

  useEffect(() => {
    const run = async () => {
      if (!albumId) return
      if (typeof window === 'undefined') return
      const url = `${window.location.origin}/album/${encodeURIComponent(albumId)}`
      try {
        const png = await QRCode.toDataURL(url, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 160,
        })
        setQrDataURL(png)
      } catch {
        setQrDataURL('')
      }
    }
    run()
  }, [albumId])

  useEffect(() => {
    const run = async () => {
      if (!posterCoverUrl) return
      try {
        await preloadImage(posterCoverUrl)
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = posterCoverUrl
        await new Promise((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('load failed'))
        })
        const canvas = document.createElement('canvas')
        const w = 64
        const h = 64
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return
        ctx.drawImage(img, 0, 0, w, h)
        const data = ctx.getImageData(0, 0, w, h).data
        let r = 0
        let g = 0
        let b = 0
        let c = 0
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3]
          if (a < 16) continue
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          c++
        }
        if (!c) return
        const col = tinycolor({ r: Math.round(r / c), g: Math.round(g / c), b: Math.round(b / c) })
        setAccentColor(col.toHexString())
      } catch {
        setAccentColor('')
      }
    }
    run()
  }, [posterCoverUrl])

  const generatePoster = async () => {
    if (generatingPoster) return
    try {
      setGeneratingPoster(true)
      setPosterMounted(true)
      if (posterCoverUrl) await preloadImage(posterCoverUrl)
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const node = posterRef.current
      let blob = await renderPosterToBlob(node, {
        width: 1080,
        pixelRatio: 2,
        backgroundColor: posterVariant === 'vinyl' ? '#0b0b0d' : '#0b0b0d',
      })

      const blank1 = await isBlankImage(blob).catch(() => false)
      if (blank1) {
        blob = await renderPosterToBlob(node, {
          width: 1080,
          pixelRatio: 1,
          backgroundColor: posterVariant === 'vinyl' ? '#0b0b0d' : '#0b0b0d',
        })
      }

      const blank2 = await isBlankImage(blob).catch(() => false)
      if (blank2) {
        blob = await renderPosterFallbackCanvas({
          album: title,
          artist: artistName,
          year,
          tags: myTags,
          rating: typeof myRating === 'number' ? myRating : null,
          coverImage: posterCoverUrl,
          qrDataURL,
          variant: posterVariant,
          accentColor,
          width: 1080,
        })
      }

      const filename = buildPosterFilename({ album: title, artist: artistName })
      downloadBlob(blob, filename)
    } catch (e) {
      console.error('poster generate failed', e)
      const msg = String(e?.message || '')
      if (/memory|out of memory|allocation/i.test(msg)) {
        alert('内存不足，请稍后再试')
      } else {
        alert('海报生成失败，请重试')
      }
    } finally {
      setGeneratingPoster(false)
      setPosterMounted(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 animate-fade-in-up">
      {zoomOpen && coverUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setZoomOpen(false)}>
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoomOpen(false)}
              className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X size={24} />
            </button>
            <img
              src={coverUrl}
              alt={title ? `${title} 封面` : '专辑封面'}
              className="w-full h-auto rounded-2xl border border-white/10 shadow-2xl"
              loading="lazy"
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <button
          type="button"
          onClick={() => {
            try {
              const from = sessionStorage.getItem('nav:from')
              if (from === 'search') {
                router.push('/search')
                return
              }
              if (from === 'library') {
                router.push('/')
                return
              }
            } catch {}
            if (typeof window !== 'undefined' && window.history.length > 1) {
              router.back()
            } else {
              router.push('/')
            }
          }}
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          返回
        </button>
        <div className="flex items-center gap-2">
          <div className="flex bg-black/20 rounded-xl p-1 border border-white/10">
            <button
              type="button"
              onClick={() => setPosterVariant('glass')}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-bold transition-all',
                posterVariant === 'glass' ? 'bg-white text-black' : 'text-secondary hover:text-white hover:bg-white/5'
              )}
            >
              玻璃
            </button>
            <button
              type="button"
              onClick={() => setPosterVariant('vinyl')}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-bold transition-all',
                posterVariant === 'vinyl' ? 'bg-white text-black' : 'text-secondary hover:text-white hover:bg-white/5'
              )}
            >
              黑胶
            </button>
          </div>

          <button
            type="button"
            onClick={generatePoster}
            disabled={loading || generatingPoster}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Share2 size={16} />
            {generatingPoster ? '生成中' : '分享'}
          </button>

          <button
            type="button"
            onClick={() => fetchDetail(true)}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            <RefreshCw size={16} />
            重新抓取
          </button>
        </div>
      </div>

      {generatingPoster && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="glass-panel px-6 py-4 rounded-2xl border border-white/10 text-white font-bold">
            正在生成海报…
          </div>
        </div>
      )}

      {posterMounted && (
        <div
          ref={posterRef}
          style={{ position: 'fixed', left: 0, top: 0, transform: 'translateX(-200vw)', pointerEvents: 'none' }}
          aria-hidden="true"
        >
          <CanvasPoster
            album={title}
            artist={artistName}
            year={year}
            tags={myTags}
            rating={typeof myRating === 'number' ? myRating : null}
            coverImage={posterCoverUrl}
            qrDataURL={qrDataURL}
            variant={posterVariant}
            accentColor={accentColor}
          />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-8">
          <div className="aspect-square rounded-3xl bg-white/5 animate-pulse" />
          <div className="space-y-4">
            <div className="h-10 w-2/3 bg-white/5 rounded-2xl animate-pulse" />
            <div className="h-5 w-1/2 bg-white/5 rounded-2xl animate-pulse" />
            <div className="h-24 w-full bg-white/5 rounded-3xl animate-pulse" />
            <div className="h-24 w-full bg-white/5 rounded-3xl animate-pulse" />
          </div>
        </div>
      ) : error ? (
        <div className="glass-panel p-8 rounded-3xl border border-white/10">
          <div className="text-white font-bold text-lg mb-2">暂时无法获取专辑信息</div>
          <div className="text-secondary text-sm mb-6">{error}</div>
          <button
            type="button"
            onClick={fetchDetail}
            className="btn-primary px-6 py-3 rounded-full font-bold"
          >
            稍后重试
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-10 items-start">
          <div className="space-y-4">
            <div
              className={cn(
                'relative aspect-square rounded-3xl overflow-hidden border border-white/10 bg-card shadow-2xl',
                coverUrl ? 'cursor-zoom-in' : ''
              )}
              onClick={() => coverUrl && setZoomOpen(true)}
              role={coverUrl ? 'button' : undefined}
              tabIndex={coverUrl ? 0 : undefined}
              onKeyDown={(e) => {
                if (!coverUrl) return
                if (e.key === 'Enter' || e.key === ' ') setZoomOpen(true)
              }}
            >
              {coverUrl && !coverError ? (
                <img
                  src={coverUrl}
                  alt={title ? `${title} 封面` : '专辑封面'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={() => setCoverError(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-secondary/60">
                  <ImageOff size={32} />
                  <div className="text-xs mt-2">封面加载失败</div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-4">
              {data?.basic?.sourceUrl && (
                <a
                  href={data.basic.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-2 text-sm text-secondary hover:text-accent transition-colors"
                >
                  数据来源
                  <ExternalLink size={14} />
                </a>
              )}
              {data?.basic?.artistImageUrl && (
                <div className="flex items-center gap-2 text-xs text-secondary">
                  <img
                    src={data.basic.artistImageUrl}
                    alt={artistName ? `${artistName} 照片` : '艺术家照片'}
                    className="w-10 h-10 rounded-full object-cover border border-white/10"
                    loading="lazy"
                  />
                  <span className="max-w-[180px] truncate">{artistName}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <header className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{title}</h1>
              <div className="text-secondary text-base font-medium">{artistName}</div>
              <div className="flex flex-wrap gap-2 pt-3">
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/80">
                  发行时间：{data?.basic?.releaseDate || '缺少信息'}
                </span>
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/80">
                  平台：{data?.basic?.platforms?.join(' / ') || data?.basic?.platform || '缺少信息'}
                </span>
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/80">
                  形式：{data?.basic?.albumType || '缺少信息'}
                </span>
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/80">
                  厂牌：{data?.basic?.publishCompany || '缺少信息'}
                </span>
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/80 inline-flex items-center gap-2">
                  <ListMusic size={14} className="text-white/60" />
                  曲目：{data?.basic?.trackCount || '缺少信息'}
                </span>
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/80 inline-flex items-center gap-2">
                  <Clock size={14} className="text-white/60" />
                  时长：{data?.basic?.durationText || '缺少信息'}
                </span>
                {data?.basic?.rating?.score ? (
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/80 inline-flex items-center gap-2">
                    <Star size={14} className="text-accent" />
                    豆瓣：{data.basic.rating.score} / {data.basic.rating.scale || 10}{data.basic.rating.votes ? `（${data.basic.rating.votes} 人）` : ''}
                  </span>
                ) : null}
                {data?.completeness?.content ? (
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/80">
                    完整度：{Math.round((data.completeness.content.filled / data.completeness.content.total) * 100)}%
                  </span>
                ) : null}
                {data?.cacheHit && (
                  <span className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-xs text-green-400">
                    已缓存
                  </span>
                )}
                {data?.stale && (
                  <span className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300">
                    回退缓存
                  </span>
                )}
              </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <section className="glass-panel p-6 rounded-3xl border border-white/10 xl:col-span-2">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <h2 className="text-lg font-bold text-white">曲目列表</h2>
                  {Array.isArray(data?.basic?.tracks) && data.basic.tracks.length > 12 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllTracks((v) => !v)}
                      className="text-xs text-secondary hover:text-white transition-colors"
                    >
                      {showAllTracks ? '收起' : '展开全部'}
                    </button>
                  ) : null}
                </div>
                {Array.isArray(data?.basic?.tracks) && data.basic.tracks.length ? (
                  <div className="divide-y divide-white/5">
                    {(showAllTracks ? data.basic.tracks : data.basic.tracks.slice(0, 12)).map((tr) => (
                      <div key={`${tr.index}-${tr.name || ''}`} className="py-2 flex items-center gap-3">
                        <div className="w-7 text-xs text-secondary/70 tabular-nums">{tr.index}</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-white/90 truncate">{tr.name || '未知曲目'}</div>
                          {tr.artists ? <div className="text-xs text-secondary truncate">{tr.artists}</div> : null}
                        </div>
                        <div className="text-xs text-secondary tabular-nums">{tr.durationText || ''}</div>
                        {tr.neteaseSongUrl ? (
                          <a
                            href={tr.neteaseSongUrl}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="text-xs text-secondary hover:text-accent transition-colors"
                          >
                            试听
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-white/60">缺少信息</div>
                )}
              </section>

              {sections.map((s) => (
                <SectionCard key={s.key} title={s.title}>
                  {s.value ? s.value : '缺少信息'}
                </SectionCard>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
