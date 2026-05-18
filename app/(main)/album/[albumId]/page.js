'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Clock, ExternalLink, ImageOff, ListMusic, RefreshCw, Share2, Sparkles, Star, X, Loader2 } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { supabase } from '@/lib/supabase'
import QRCode from 'qrcode'
import tinycolor from 'tinycolor2'
import CanvasPoster from '@/components/CanvasPoster'
import AlbumReviewsPanel from '@/components/AlbumReviewsPanel'
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
  const [aiGenerating, setAiGenerating] = useState(false)
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
      // 先快速加载基本信息
      const url = `/api/album-details?albumId=${encodeURIComponent(albumId)}${refresh ? '&refresh=1' : ''}${!refresh ? '&fast=1' : ''}`
      const res = await fetch(url)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'failed')
      setData(json)
      setLoading(false)

      // 如果是快速模式且内容不完整，后台加载完整数据
      if (!refresh && json?.partial) {
        const fullRes = await fetch(`/api/album-details?albumId=${encodeURIComponent(albumId)}`)
        const fullJson = await fullRes.json()
        if (fullRes.ok) setData(fullJson)
      }

      return json
    } catch (e) {
      setError(e?.message || '加载失败')
      return null
    } finally {
      setLoading(false)
    }
  }

  const refetchUntilReady = async () => {
    const first = await fetchDetail(true)
    const hasTracks = Array.isArray(first?.basic?.tracks) && first.basic.tracks.length > 0
    const hasContent =
      !!first?.content?.artistBio || !!first?.content?.creationBackground || !!first?.content?.mediaReviews || !!first?.content?.awards
    if (hasTracks || hasContent) return

    for (let i = 0; i < 2; i += 1) {
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)))
      const next = await fetchDetail(true)
      const okTracks = Array.isArray(next?.basic?.tracks) && next.basic.tracks.length > 0
      const okContent =
        !!next?.content?.artistBio || !!next?.content?.creationBackground || !!next?.content?.mediaReviews || !!next?.content?.awards
      if (okTracks || okContent) return
    }

    setError('抓取仍未成功。建议配置 `NETEASE_API_BASE_URL`（见 docs/NETEASE_API_SETUP.md），或稍后重试。')
  }

  const handleAiGenerate = async () => {
    if (aiGenerating || !albumId) return
    setAiGenerating(true)
    try {
      const res = await fetch(`/api/album-details?albumId=${encodeURIComponent(albumId)}&ai=1`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'AI 生成失败')
      // AI 生成成功后，带 useAi=1 参数刷新，确保显示 AI 内容
      const url = `/api/album-details?albumId=${encodeURIComponent(albumId)}&refresh=1&useAi=1`
      const refreshRes = await fetch(url)
      const refreshJson = await refreshRes.json()
      if (refreshRes.ok) {
        setData(refreshJson)
      } else {
        await fetchDetail(true)
      }
    } catch (e) {
      alert(e?.message || 'AI 生成失败，请稍后重试')
    } finally {
      setAiGenerating(false)
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
            data-tour="album-refetch"
            type="button"
            onClick={refetchUntilReady}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            <RefreshCw size={16} />
            重新抓取
          </button>

          <button
            type="button"
            onClick={handleAiGenerate}
            disabled={loading || aiGenerating}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 text-purple-300 hover:text-white hover:from-purple-500/30 hover:to-blue-500/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            {aiGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {aiGenerating ? 'AI 生成中…' : 'AI 抓取'}
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

      {aiGenerating && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="glass-panel px-8 py-6 rounded-2xl border border-purple-500/20 text-white text-center">
            <Loader2 size={32} className="animate-spin mx-auto mb-3 text-purple-400" />
            <div className="font-bold mb-1">AI 正在生成专辑信息</div>
            <div className="text-sm text-secondary">通常需要 10-30 秒，请稍候…</div>
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
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          <div className="aspect-square rounded-2xl bg-white/5 animate-pulse" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 bg-white/5 rounded-xl animate-pulse" />
            <div className="h-5 w-1/3 bg-white/5 rounded-xl animate-pulse" />
            <div className="h-4 w-1/2 bg-white/5 rounded-xl animate-pulse" />
            <div className="h-20 w-full bg-white/5 rounded-xl animate-pulse mt-4" />
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
        <div className="space-y-8">
          {/* 顶部：封面 + 基本信息 */}
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
            <div
              className={cn(
                'relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-card shadow-2xl',
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

            <div className="space-y-3">
              <div className="text-xs text-secondary uppercase tracking-wider font-medium">专辑</div>
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{title}</h1>
              <div className="text-white/80 text-lg font-medium">{artistName}</div>
              <div className="text-sm text-secondary">
                {data?.basic?.releaseDate || ''}{data?.basic?.releaseDate && data?.basic?.trackCount ? ' · ' : ''}
                {data?.basic?.trackCount ? `${data.basic.trackCount} 首歌` : ''}
                {data?.basic?.durationText ? ` · ${data.basic.durationText}` : ''}
              </div>

              {/* 标签 */}
              <div className="flex flex-wrap gap-2 pt-2">
                {data?.basic?.albumType && (
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70">{data.basic.albumType}</span>
                )}
                {data?.basic?.publishCompany && (
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70">{data.basic.publishCompany}</span>
                )}
                {data?.aiGenerated && (
                  <span className="px-3 py-1 rounded-full bg-gradient-to-r from-accent/20 to-purple-500/20 border border-accent/30 text-xs text-accent inline-flex items-center gap-1">
                    <Sparkles size={12} />
                    AI 增强
                  </span>
                )}
              </div>

              {/* 简介 */}
              {data?.content?.creationBackground && (
                <p className="text-sm text-white/60 leading-relaxed line-clamp-3 pt-1">
                  {data.content.creationBackground.slice(0, 200)}
                </p>
              )}

              {/* 评分 */}
              {data?.basic?.rating?.score ? (
                <div className="flex items-center gap-3 pt-2">
                  <span className="text-3xl font-bold text-white">{data.basic.rating.score}</span>
                  <div className="flex flex-col">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          className={i < Math.round(data.basic.rating.score / 2) ? 'text-accent fill-accent' : 'text-white/20'}
                        />
                      ))}
                    </div>
                    {data.basic.rating.votes && (
                      <span className="text-xs text-secondary mt-0.5">{data.basic.rating.votes} 人评分</span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* 曲目列表 */}
          <section data-tour="album-tracklist" className="glass-panel p-6 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between gap-4 mb-4">
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
                  <div key={`${tr.index}-${tr.name || ''}`} className="py-3 flex items-center gap-4">
                    <div className="w-8 text-sm text-secondary/50 tabular-nums text-center">{tr.index}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white/90 truncate">{tr.name || '未知曲目'}</div>
                      {tr.artists ? <div className="text-xs text-secondary truncate mt-0.5">{tr.artists}</div> : null}
                    </div>
                    <div className="text-xs text-secondary/60 tabular-nums">{tr.durationText || ''}</div>
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
              <div className="text-sm text-white/40 py-4 text-center">暂无曲目信息</div>
            )}
          </section>

          {/* 发行信息 + 详情内容 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 发行信息 */}
            <section className="glass-panel p-6 rounded-2xl border border-white/10">
              <h2 className="text-lg font-bold text-white mb-4">发行信息</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-secondary">发行时间</span>
                  <span className="text-white/80">{data?.basic?.releaseDate || '未知'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">唱片公司</span>
                  <span className="text-white/80">{data?.basic?.publishCompany || '未知'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">专辑类型</span>
                  <span className="text-white/80">{data?.basic?.albumType || '未知'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">平台</span>
                  <span className="text-white/80">{data?.basic?.platforms?.join(' / ') || '未知'}</span>
                </div>
                {data?.basic?.sourceUrl && (
                  <div className="flex justify-between">
                    <span className="text-secondary">数据来源</span>
                    <a href={data.basic.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-accent hover:underline inline-flex items-center gap-1">
                      查看 <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>
            </section>

            {/* 艺术家简介 */}
            <SectionCard title="艺术家简介">
              {sections.find(s => s.key === 'artistBio')?.value || '缺少信息'}
            </SectionCard>
          </div>

          {/* 创作背景 + 乐评 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="创作背景简介">
              {sections.find(s => s.key === 'creationBackground')?.value || '缺少信息'}
            </SectionCard>
            <SectionCard title="乐评 / 媒体评价">
              {sections.find(s => s.key === 'mediaReviews')?.value || '缺少信息'}
            </SectionCard>
          </div>

          {/* 奖项 + 用户评论 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="奖项 / 荣誉">
              {sections.find(s => s.key === 'awards')?.value || '缺少信息'}
            </SectionCard>
            <div data-tour="album-reviews">
              <AlbumReviewsPanel albumId={albumId} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
