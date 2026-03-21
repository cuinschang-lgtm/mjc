import * as htmlToImage from 'html-to-image'
import tinycolor from 'tinycolor2'

export function sanitizeFilename(input) {
  const s = String(input || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return s || '分享海报'
}

export function buildPosterFilename({ album, artist }) {
  const a = sanitizeFilename(album)
  const b = sanitizeFilename(artist)
  const name = [a, b, '分享海报'].filter(Boolean).join('_')
  return `${name}.png`
}

export function proxyImageUrl(src) {
  if (!src) return null
  try {
    const u = new URL(String(src))
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return `/api/image-proxy?url=${encodeURIComponent(u.toString())}`
    }
    return String(src)
  } catch {
    return String(src)
  }
}

export async function preloadImage(src) {
  if (!src) return
  await new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width <= maxWidth) {
      line = next
    } else {
      if (line) lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function starPath(ctx, cx, cy, outerR, innerR) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const a = (Math.PI / 5) * i - Math.PI / 2
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function drawStars(ctx, x, y, rating10) {
  if (typeof rating10 !== 'number') return
  const r5 = rating10 / 2
  const size = 32
  const gap = 8
  for (let i = 0; i < 5; i++) {
    const v = r5 - i
    const fill = v >= 1 ? 1 : v >= 0.5 ? 0.5 : 0
    const cx = x + i * (size + gap) + size / 2
    const cy = y + size / 2
    starPath(ctx, cx, cy, 14, 7)
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fill()

    if (fill > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(x + i * (size + gap), y, size * fill, size)
      ctx.clip()
      starPath(ctx, cx, cy, 14, 7)
      ctx.fillStyle = '#FFD700'
      ctx.fill()
      ctx.restore()
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = '600 24px Georgia, serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${rating10.toFixed(1)} / 10`, x + 5 * (size + gap) + 8, y + size / 2)
}

export async function renderPosterFallbackCanvas({
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
  width = 1080,
}) {
  if (document?.fonts?.ready) {
    try {
      await document.fonts.ready
    } catch {}
  }

  const cover = coverImage ? await loadImage(coverImage) : null
  const qr = qrDataURL ? await loadImage(qrDataURL) : null

  const padding = 80
  const cardPadding = 64
  const coverW = 740
  const coverX = (width - coverW) / 2
  const coverY = padding + cardPadding
  const coverR = 8

  const safeTags = Array.isArray(tags) ? tags.filter(Boolean).slice(0, 5) : []
  const baseAccent = tinycolor(accentColor || '#ff4d4d')
  const accent = baseAccent.isValid() ? baseAccent.toHexString() : '#ff4d4d'

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unsupported')

  ctx.font = '600 48px Georgia, serif'
  const titleLines = wrapText(ctx, album || '未命名专辑', width - padding * 2 - cardPadding * 2)
  const titleH = titleLines.length * 58

  ctx.font = '400 36px Georgia, serif'
  const artistH = 44
  const tagsH = safeTags.length ? 54 + 24 : 0
  const footerH = 220
  const reviewH = 160

  const height =
    padding +
    cardPadding +
    52 +
    coverW +
    40 +
    titleH +
    16 +
    artistH +
    32 +
    tagsH +
    36 +
    reviewH +
    48 +
    footerH +
    cardPadding +
    padding

  canvas.width = width * 2
  canvas.height = Math.ceil(height * 2)
  ctx.scale(2, 2)

  ctx.fillStyle = '#0b0b0d'
  ctx.fillRect(0, 0, width, height)

  if (cover) {
    ctx.save()
    ctx.filter = 'blur(40px)'
    const s = 1.2
    const bw = width * s
    const bh = height * s
    ctx.globalAlpha = variant === 'vinyl' ? 0.65 : 0.55
    ctx.drawImage(cover, -(bw - width) / 2, -(bh - height) / 2, bw, bh)
    ctx.restore()
  }

  ctx.save()
  ctx.fillStyle = variant === 'vinyl' ? 'rgba(0,0,0,0.70)' : 'rgba(0,0,0,0.42)'
  ctx.fillRect(0, 0, width, height)
  ctx.restore()

  if (variant === 'vinyl') {
    const cx = width - 160
    const cy = padding + 220
    ctx.save()
    ctx.globalAlpha = 0.32
    const grd = ctx.createRadialGradient(cx, cy, 30, cx, cy, 260)
    grd.addColorStop(0, 'rgba(255,255,255,0.10)')
    grd.addColorStop(0.18, 'rgba(255,255,255,0.04)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.arc(cx, cy, 260, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  } else {
    ctx.save()
    ctx.globalAlpha = 0.9
    const cx = 160
    const cy = 160
    const grd = ctx.createRadialGradient(cx, cy, 20, cx, cy, 260)
    grd.addColorStop(0, tinycolor(accent).setAlpha(0.35).toRgbString())
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, 520, 520)
    ctx.restore()
  }

  const cardX = padding
  const cardY = padding
  const cardW = width - padding * 2
  const cardH = height - padding * 2
  ctx.save()
  roundedRect(ctx, cardX, cardY, cardW, cardH, 32)
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 40
  ctx.fillStyle = variant === 'vinyl' ? 'rgba(10,10,12,0.88)' : 'rgba(255,255,255,0.10)'
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = variant === 'vinyl' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.20)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = 'rgba(255,255,255,0.86)'
  ctx.font = '700 20px Georgia, serif'
  ctx.textBaseline = 'top'
  ctx.fillText(String(brandName || '拾音Pickup'), padding + cardPadding, padding + 18)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '600 14px Georgia, serif'
  const right = '分享海报'
  const rw = ctx.measureText(right).width
  ctx.fillText(right, width - padding - cardPadding - rw, padding + 22)

  if (cover) {
    ctx.save()
    roundedRect(ctx, coverX, coverY, coverW, coverW, coverR)
    ctx.clip()
    ctx.drawImage(cover, coverX, coverY, coverW, coverW)
    ctx.restore()
  }

  let y = coverY + coverW + 40
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = '600 48px Georgia, serif'
  ctx.textBaseline = 'top'
  for (const line of titleLines) {
    ctx.fillText(line, padding + cardPadding, y)
    y += 58
  }

  y += 16
  ctx.fillStyle = 'rgba(255,255,255,0.74)'
  ctx.font = '400 36px Georgia, serif'
  ctx.fillText(artist || '未知艺人', padding + cardPadding, y)
  if (year) {
    const w1 = ctx.measureText(artist || '未知艺人').width
    ctx.fillStyle = 'rgba(255,255,255,0.58)'
    ctx.font = '400 24px Georgia, serif'
    ctx.fillText(year, padding + cardPadding + w1 + 16, y + 10)
  }
  y += 44

  if (safeTags.length) {
    y += 32
    ctx.font = '600 20px Georgia, serif'
    const bg = tinycolor(accent).setAlpha(0.18).toRgbString()
    const border = tinycolor(accent).setAlpha(0.28).toRgbString()
    let x = padding + cardPadding
    for (const t of safeTags) {
      const text = String(t)
      const tw = ctx.measureText(text).width
      const pillW = tw + 32
      const pillH = 40
      roundedRect(ctx, x, y, pillW, pillH, 999)
      ctx.fillStyle = bg
      ctx.fill()
      ctx.strokeStyle = border
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.90)'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, x + 16, y + pillH / 2)
      x += pillW + 12
    }
    y += 64
  } else {
    y += 32
  }

  y += 36
  const reviewX = padding + cardPadding
  const reviewW = width - padding * 2 - cardPadding * 2
  const reviewBoxH = reviewH
  ctx.save()
  roundedRect(ctx, reviewX, y, reviewW, reviewBoxH, 24)
  ctx.fillStyle = variant === 'vinyl' ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.06)'
  ctx.fill()
  ctx.strokeStyle = variant === 'vinyl' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.16)'
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = '700 20px Georgia, serif'
  ctx.textBaseline = 'top'
  ctx.fillText('我的乐评', reviewX + 18, y + 16)

  const hasReview = !!(myReview?.hasListened && (myReview?.excerpt || myReview?.score))
  if (!hasReview) {
    ctx.fillStyle = 'rgba(255,255,255,0.70)'
    ctx.font = '400 18px Georgia, serif'
    ctx.fillText('快来发表第一条乐评', reviewX + 18, y + 54)
  } else {
    const nick = String(myReview?.nickname || '你')
    const excerpt = String(myReview?.excerpt || '').slice(0, 50)
    ctx.fillStyle = 'rgba(255,255,255,0.86)'
    ctx.font = '700 18px Georgia, serif'
    ctx.fillText(nick, reviewX + 18, y + 54)
    if (typeof myReview?.score === 'number') {
      const scoreText = `${myReview.score.toFixed(1)} / 10`
      ctx.fillStyle = 'rgba(255,255,255,0.80)'
      ctx.font = '700 16px Georgia, serif'
      const sw = ctx.measureText(scoreText).width
      ctx.fillText(scoreText, reviewX + reviewW - 18 - sw, y + 56)
    }
    ctx.fillStyle = 'rgba(255,255,255,0.80)'
    ctx.font = '400 18px Georgia, serif'
    ctx.fillText(excerpt || '（无文字内容）', reviewX + 18, y + 86)
  }

  y += reviewBoxH

  y += 48
  ctx.fillStyle = 'rgba(255,255,255,0.70)'
  ctx.font = '600 20px Georgia, serif'
  ctx.textBaseline = 'top'
  ctx.fillText('我的评分', padding + cardPadding, y)
  y += 36
  drawStars(ctx, padding + cardPadding, y, typeof rating === 'number' ? rating : null)

  if (qr) {
    const qrSize = 160
    const qrX = width - padding - cardPadding - qrSize
    const qrY = height - padding - cardPadding - qrSize
    ctx.save()
    roundedRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 20)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'
    ctx.stroke()
    roundedRect(ctx, qrX, qrY, qrSize, qrSize, 12)
    ctx.clip()
    ctx.drawImage(qr, qrX, qrY, qrSize, qrSize)
    ctx.restore()
  }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('render failed')
  return blob
}

async function blobToImage(blob) {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('blob image decode failed'))
      img.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function isBlankImage(blob) {
  const img = await blobToImage(blob)
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  if (!w || !h) return true

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return true
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, w, h)

  const step = Math.max(8, Math.floor(Math.min(w, h) / 80))
  let count = 0
  let sum = 0
  let sumSq = 0
  let alphaSum = 0
  let maxLum = 0
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
      sum += l
      sumSq += l * l
      alphaSum += a
      if (l > maxLum) maxLum = l
      count++
    }
  }

  if (!count) return true
  const mean = sum / count
  const variance = sumSq / count - mean * mean
  const alphaMean = alphaSum / count

  if (alphaMean < 5) return true
  if (maxLum < 18) return true
  if (variance < 8) return true
  return false
}

export async function renderPosterToBlob(
  node,
  { width = 1080, pixelRatio = 2, backgroundColor = null } = {}
) {
  if (!node) throw new Error('missing node')

  if (document?.fonts?.ready) {
    try {
      await document.fonts.ready
    } catch {}
  }

  const blob = await htmlToImage.toBlob(node, {
    width,
    backgroundColor,
    pixelRatio,
    cacheBust: true,
  })

  if (!blob) throw new Error('render failed')
  return blob
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
