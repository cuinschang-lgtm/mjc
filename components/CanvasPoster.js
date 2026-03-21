'use client'

import { useMemo } from 'react'
import tinycolor from 'tinycolor2'

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function StarIcon({ fill = 0, size = 32, color = '#FFD700', emptyColor = 'rgba(255,255,255,0.25)' }) {
  const id = useMemo(() => `grad_${Math.random().toString(16).slice(2)}`, [])
  const pct = clamp(fill, 0, 1) * 100
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

function Stars({ rating10 }) {
  const r5 = typeof rating10 === 'number' ? rating10 / 2 : null
  const stars = Array.from({ length: 5 }).map((_, i) => {
    if (r5 === null) return 0
    const v = r5 - i
    if (v >= 1) return 1
    if (v >= 0.5) return 0.5
    return 0
  })

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {stars.map((f, idx) => (
        <StarIcon key={idx} fill={f} />
      ))}
      {typeof rating10 === 'number' ? (
        <div style={{ marginLeft: 8, fontSize: 24, color: 'rgba(255,255,255,0.85)', fontVariantNumeric: 'tabular-nums' }}>
          {rating10.toFixed(1)} / 10
        </div>
      ) : null}
    </div>
  )
}

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
  brandName = '拾音Pickup',
  myReview,
}) {
  const safeTags = Array.isArray(tags) ? tags.filter(Boolean).slice(0, 5) : []
  const moreCount = Array.isArray(tags) && tags.length > 5 ? tags.length - 5 : 0
  const baseAccent = tinycolor(accentColor || '#ff4d4d')
  const accent = baseAccent.isValid() ? baseAccent.toHexString() : '#ff4d4d'
  const bgMask =
    variant === 'vinyl'
      ? 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.06), rgba(0,0,0,0) 50%), rgba(0,0,0,0.68)'
      : 'radial-gradient(circle at 20% 15%, rgba(255,255,255,0.10), rgba(0,0,0,0) 55%), rgba(0,0,0,0.42)'
  const panelBg =
    variant === 'vinyl'
      ? 'linear-gradient(180deg, rgba(10,10,12,0.94), rgba(10,10,12,0.82))'
      : 'linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06))'
  const panelBorder = variant === 'vinyl' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.22)'
  const textPrimary = variant === 'vinyl' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.92)'
  const textSecondary = variant === 'vinyl' ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.74)'

  const containerStyle = {
    width: 1080,
    padding: 80,
    borderRadius: 32,
    position: 'relative',
    overflow: 'hidden',
    fontFamily: '"Noto Serif SC", "Source Han Serif SC", var(--font-serif), Georgia, serif',
    color: textPrimary,
  }

  const bgStyle = {
    position: 'absolute',
    inset: 0,
    transform: 'scale(1.2)',
    filter: 'blur(40px)',
    opacity: variant === 'vinyl' ? 0.7 : 0.6,
    objectFit: 'cover',
    width: '100%',
    height: '100%',
  }

  const maskStyle = {
    position: 'absolute',
    inset: 0,
    background: bgMask,
  }

  const panelStyle = {
    position: 'relative',
    borderRadius: 32,
    padding: 64,
    background: panelBg,
    border: `1px solid ${panelBorder}`,
    boxShadow:
      variant === 'vinyl'
        ? '0 24px 60px rgba(0,0,0,0.55)'
        : '0 24px 60px rgba(0,0,0,0.35)',
    backdropFilter: variant === 'glass' ? 'blur(22px) saturate(1.25)' : undefined,
  }

  const coverWrapStyle = {
    width: 740,
    margin: '0 auto',
    borderRadius: 8,
    overflow: 'hidden',
    border: `1px solid rgba(255,255,255,0.14)`,
    boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
  }

  const titleStyle = {
    marginTop: 40,
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
  }

  const artistRowStyle = {
    marginTop: 16,
    display: 'flex',
    gap: 16,
    alignItems: 'baseline',
    flexWrap: 'wrap',
  }

  const artistStyle = {
    fontSize: 36,
    fontWeight: 400,
    color: textSecondary,
    lineHeight: 1.2,
  }

  const yearStyle = {
    fontSize: 24,
    fontWeight: 400,
    color: 'rgba(255,255,255,0.58)',
    lineHeight: 1.2,
  }

  const tagRowStyle = {
    marginTop: 32,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
  }

  const tagStyle = {
    padding: '10px 16px',
    borderRadius: 999,
    fontSize: 20,
    fontWeight: 600,
    background: tinycolor(accent).setAlpha(0.18).toRgbString(),
    border: `1px solid ${tinycolor(accent).setAlpha(0.28).toRgbString()}`,
    color: 'rgba(255,255,255,0.9)',
  }

  const footerStyle = {
    marginTop: 48,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 24,
  }

  const reviewWrapStyle = {
    marginTop: 36,
    padding: 24,
    borderRadius: 24,
    background: variant === 'vinyl' ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.06)',
    border: `1px solid ${variant === 'vinyl' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.16)'}`,
  }

  const qrWrapStyle = {
    width: 160,
    height: 160,
    padding: 12,
    borderRadius: 20,
    background: 'rgba(255,255,255,0.08)',
    border: `1px solid rgba(255,255,255,0.14)`,
  }

  const vinylTexture = variant === 'vinyl'
    ? {
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.08), rgba(0,0,0,0) 42%), repeating-radial-gradient(circle at 50% 45%, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, rgba(0,0,0,0) 6px, rgba(0,0,0,0) 12px)',
        opacity: 0.45,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
      }
    : null

  const vinylDisc = variant === 'vinyl'
    ? {
        position: 'absolute',
        right: -140,
        top: 120,
        width: 520,
        height: 520,
        borderRadius: 9999,
        background:
          'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 18%, rgba(0,0,0,0) 19%), repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, rgba(0,0,0,0) 7px, rgba(0,0,0,0) 14px)',
        opacity: 0.35,
        filter: 'blur(0.2px)',
        pointerEvents: 'none',
      }
    : null

  const glassHighlight = variant === 'glass'
    ? {
        position: 'absolute',
        left: -120,
        top: -120,
        width: 520,
        height: 520,
        borderRadius: 9999,
        background: `radial-gradient(circle at 40% 40%, ${tinycolor(accent).setAlpha(0.30).toRgbString()}, rgba(0,0,0,0) 62%)`,
        filter: 'blur(8px)',
        opacity: 0.9,
        pointerEvents: 'none',
      }
    : null

  return (
    <div style={containerStyle}>
      {coverImage ? <img src={coverImage} alt="" style={bgStyle} crossOrigin="anonymous" /> : null}
      <div style={maskStyle} />
      {vinylTexture ? <div style={vinylTexture} /> : null}
      {vinylDisc ? <div style={vinylDisc} /> : null}
      {glassHighlight ? <div style={glassHighlight} /> : null}

      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.86)', letterSpacing: '0.02em' }}>{brandName}</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>分享海报</div>
        </div>

        <div style={coverWrapStyle}>
          {coverImage ? (
            <img
              src={coverImage}
              alt={album ? `${album} 封面` : '专辑封面'}
              style={{ width: '100%', height: 'auto', display: 'block' }}
              crossOrigin="anonymous"
            />
          ) : (
            <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'rgba(255,255,255,0.06)' }} />
          )}
        </div>

        <div style={titleStyle}>{album || '未命名专辑'}</div>
        <div style={artistRowStyle}>
          <div style={artistStyle}>{artist || '未知艺人'}</div>
          {year ? <div style={yearStyle}>{year}</div> : null}
        </div>

        {safeTags.length || moreCount ? (
          <div style={tagRowStyle}>
            {safeTags.map((t) => (
              <div key={t} style={tagStyle}>{t}</div>
            ))}
            {moreCount ? <div style={tagStyle}>{`+${moreCount}`}</div> : null}
          </div>
        ) : null}

        <div style={reviewWrapStyle}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 12 }}>我的乐评</div>
          {myReview?.hasListened && (myReview?.excerpt || myReview?.score) ? (
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              {myReview?.avatarUrl ? (
                <img
                  src={myReview.avatarUrl}
                  alt=""
                  style={{ width: 56, height: 56, borderRadius: 9999, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.14)' }}
                  crossOrigin="anonymous"
                />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 9999, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)' }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.86)' }}>{myReview?.nickname || '你'}</div>
                  {typeof myReview?.score === 'number' ? (
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.80)', fontVariantNumeric: 'tabular-nums' }}>
                      {myReview.score.toFixed(1)} / 10
                    </div>
                  ) : null}
                </div>
                <div style={{ marginTop: 10, fontSize: 18, lineHeight: 1.45, color: 'rgba(255,255,255,0.80)' }}>
                  {String(myReview?.excerpt || '').slice(0, 50) || '（无文字内容）'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.70)', lineHeight: 1.5 }}>快来发表第一条乐评</div>
          )}
        </div>

        <div style={footerStyle}>
          <div>
            <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>
              我的评分
            </div>
            <Stars rating10={typeof rating === 'number' ? rating : null} />
          </div>

          <div style={qrWrapStyle}>
            {qrDataURL ? (
              <img
                src={qrDataURL}
                alt="二维码"
                style={{ width: '100%', height: '100%', display: 'block', borderRadius: 12 }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: 12 }} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
