'use client'

import { useMemo } from 'react'
import tinycolor from 'tinycolor2'

function StarIcon({ fill = 0, size = 20, color = '#FFD700', emptyColor = 'rgba(255,255,255,0.25)' }) {
  const id = useMemo(() => `grad_${Math.random().toString(16).slice(2)}`, [])
  const pct = Math.max(0, Math.min(1, fill)) * 100
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset={`${pct}%`} stopColor={color} />
          <stop offset={`${pct}%`} stopColor={emptyColor} />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
      />
    </svg>
  )
}

// PLACEHOLDER_CONTINUE

export default function CanvasPoster({
  album,
  artist,
  year,
  tags,
  rating,
  coverImage,
  qrDataURL,
  variant = 'glass',
  accentColor,
  brandName = '拾音 Pickup',
  posterText = '',
  userName = '',
}) {
  const baseAccent = tinycolor(accentColor || '#ff4d4d')
  const accent = baseAccent.isValid() ? baseAccent.toHexString() : '#ff4d4d'

  const containerStyle = {
    width: 1080,
    minHeight: 1400,
    position: 'relative',
    overflow: 'hidden',
    fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
    color: '#fff',
    background: '#2c2c2e',
  }

  const bgBlurStyle = {
    position: 'absolute',
    inset: 0,
    transform: 'scale(1.3)',
    filter: 'blur(60px) brightness(0.5)',
    opacity: 0.8,
    objectFit: 'cover',
    width: '100%',
    height: '100%',
  }

  const headerStyle = {
    position: 'relative',
    padding: '48px 60px 40px',
    textAlign: 'center',
    fontSize: 28,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: '0.05em',
  }

  const cardStyle = {
    position: 'relative',
    margin: '0 48px',
    borderRadius: 24,
    overflow: 'hidden',
    background: 'rgba(60,60,65,0.85)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.08)',
  }

  const coverWrapStyle = {
    display: 'flex',
    justifyContent: 'center',
    padding: '48px 48px 0',
  }

  const coverStyle = {
    width: 480,
    height: 480,
    borderRadius: 12,
    objectFit: 'cover',
    boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
  }

  const infoStyle = {
    padding: '32px 48px 40px',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 24,
  }

  const ratingBoxStyle = {
    background: 'rgba(30,30,32,0.9)',
    borderRadius: 16,
    padding: '16px 24px',
    textAlign: 'center',
    border: '1px solid rgba(255,255,255,0.12)',
    minWidth: 120,
  }

  const reviewCardStyle = {
    position: 'relative',
    margin: '24px 48px 0',
    padding: '40px 48px',
    borderRadius: 24,
    background: 'rgba(60,60,65,0.85)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.08)',
  }

  const footerStyle = {
    position: 'relative',
    margin: '24px 48px 48px',
    padding: '24px 32px',
    borderRadius: 20,
    background: 'rgba(50,50,55,0.9)',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    gap: 24,
  }

  const today = new Date().toISOString().slice(0, 10)
  const r5 = typeof rating === 'number' ? rating / 2 : null

  return (
    <div style={containerStyle}>
      {coverImage && <img src={coverImage} alt="" style={bgBlurStyle} crossOrigin="anonymous" />}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />

      {/* Header */}
      <div style={headerStyle}>{brandName}</div>

      {/* Main Card */}
      <div style={cardStyle}>
        <div style={coverWrapStyle}>
          {coverImage ? (
            <img src={coverImage} alt={album} style={coverStyle} crossOrigin="anonymous" />
          ) : (
            <div style={{ ...coverStyle, background: 'rgba(255,255,255,0.06)' }} />
          )}
        </div>

        <div style={infoStyle}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.3 }}>{album || '未命名专辑'}</div>
            <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>
              {artist || '未知艺人'}{year ? ` / ${year}` : ''}
            </div>
            {tags && tags.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                {tags.slice(0, 4).map(t => (
                  <span key={t} style={{ padding: '4px 12px', borderRadius: 999, fontSize: 16, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}>{t}</span>
                ))}
              </div>
            )}
          </div>

          {typeof rating === 'number' && (
            <div style={ratingBoxStyle}>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>我的评分</div>
              <div style={{ fontSize: 36, fontWeight: 700 }}>{rating.toFixed(1)}</div>
              <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 4 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarIcon key={i} fill={r5 !== null ? Math.min(1, Math.max(0, r5 - i)) : 0} size={16} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Review / User Text */}
      <div style={reviewCardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 9999, background: `linear-gradient(135deg, ${accent}, ${tinycolor(accent).darken(20).toHexString()})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }}>
            {(userName || '我').slice(0, 1)}
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{userName || '我'}</div>
            <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }}>{today} 听过这张专辑</div>
          </div>
        </div>
        <div style={{ fontSize: 26, lineHeight: 1.7, color: 'rgba(255,255,255,0.88)', whiteSpace: 'pre-wrap' }}>
          {posterText ? `「${posterText}」` : '「这张专辑值得被更多人听到。」'}
        </div>
      </div>

      {/* Footer with QR */}
      <div style={footerStyle}>
        {qrDataURL ? (
          <img src={qrDataURL} alt="QR" style={{ width: 96, height: 96, borderRadius: 12 }} />
        ) : (
          <div style={{ width: 96, height: 96, borderRadius: 12, background: 'rgba(255,255,255,0.06)' }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)' }}>扫码查看专辑详情</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>pickupmusic.xyz</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{brandName}</div>
      </div>
    </div>
  )
}
