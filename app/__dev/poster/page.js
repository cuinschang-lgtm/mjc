'use client'

import { useMemo, useRef, useState } from 'react'
import CanvasPoster from '@/components/CanvasPoster'
import { downloadBlob, proxyImageUrl, renderPosterToBlob, buildPosterFilename } from '@/lib/sharePoster'
import QRCode from 'qrcode'

export default function PosterDevPage() {
  const ref = useRef(null)
  const [variant, setVariant] = useState('glass')
  const [qr, setQr] = useState('')
  const [loading, setLoading] = useState(false)

  const cover = useMemo(
    () => proxyImageUrl('https://p4.music.126.net/YNiXGF64S5GPWQteqILYXQ==/109951172027020970.jpg'),
    []
  )

  const ensureQr = async () => {
    if (qr) return qr
    const url = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    const png = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 160 })
    setQr(png)
    return png
  }

  const onDownload = async () => {
    try {
      setLoading(true)
      await ensureQr()
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const blob = await renderPosterToBlob(ref.current, { width: 1080, pixelRatio: 2 })
      downloadBlob(blob, buildPosterFilename({ album: 'Poster Demo', artist: 'Pickup' }))
    } finally {
      setLoading(false)
    }
  }

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
        <button
          type="button"
          className="btn-primary px-5 py-2 rounded-xl"
          onClick={onDownload}
          disabled={loading}
        >
          {loading ? '生成中' : '下载 PNG'}
        </button>
      </div>

      <div ref={ref} style={{ width: 1080 }}>
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
    </div>
  )
}

