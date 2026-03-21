'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import CanvasPoster from '@/components/CanvasPoster'
import { isBlankImage, proxyImageUrl, renderPosterFallbackCanvas, renderPosterToBlob } from '@/lib/sharePoster'

export default function PosterPreviewPage() {
  const ref = useRef(null)
  const [variant, setVariant] = useState('glass')
  const [qr, setQr] = useState('')
  const [imgUrl, setImgUrl] = useState('')
  const [status, setStatus] = useState('')

  const cover = useMemo(
    () => proxyImageUrl('https://p4.music.126.net/YNiXGF64S5GPWQteqILYXQ==/109951172027020970.jpg'),
    []
  )

  useEffect(() => {
    const run = async () => {
      const url = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
      const png = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 160 })
      setQr(png)
    }
    run().catch(() => {})
  }, [])

  useEffect(() => {
    const run = async () => {
      if (!ref.current) return
      setStatus('rendering')
      try {
        let blob = await renderPosterToBlob(ref.current, {
          width: 1080,
          pixelRatio: 2,
          backgroundColor: '#0b0b0d',
        })
        const blank = await isBlankImage(blob).catch(() => false)
        if (blank) {
          blob = await renderPosterFallbackCanvas({
            album: 'Wish You Were Here',
            artist: 'Pink Floyd',
            year: '1975',
            tags: ['#摇滚', '#经典', '#收藏'],
            rating: 9.0,
            coverImage: cover,
            qrDataURL: qr,
            variant,
            width: 1080,
          })
        }
        const u = URL.createObjectURL(blob)
        setImgUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return u
        })
        setStatus(blank ? 'fallback' : 'ok')
      } catch (e) {
        setStatus(`error:${String(e?.message || e)}`)
      }
    }
    run()
    return () => {
      setImgUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return ''
      })
    }
  }, [variant, qr, cover])

  return (
    <div className="max-w-6xl mx-auto p-10 space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80"
          onClick={() => setVariant('glass')}
        >
          玻璃
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80"
          onClick={() => setVariant('vinyl')}
        >
          黑胶
        </button>
        <div className="text-xs text-secondary">{status}</div>
      </div>

      <div ref={ref} style={{ position: 'fixed', left: 0, top: 0, transform: 'translateX(-200vw)', pointerEvents: 'none' }}>
        <CanvasPoster
          album="Wish You Were Here"
          artist="Pink Floyd"
          year="1975"
          tags={['#摇滚', '#经典', '#收藏']}
          rating={9.0}
          coverImage={cover}
          qrDataURL={qr}
          variant={variant}
        />
      </div>

      {imgUrl ? (
        <img src={imgUrl} alt="poster" className="w-full rounded-2xl border border-white/10" />
      ) : (
        <div className="h-40 bg-white/5 rounded-2xl" />
      )}
    </div>
  )
}

