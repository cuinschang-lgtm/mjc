import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const NETEASE_API_BASE_URL = (process.env.NETEASE_API_BASE_URL || '').trim().replace(/\/+$/, '')
const NETEASE_API_COOKIE = (process.env.NETEASE_API_COOKIE || '').trim()

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, '')
    .replace(/[\(\)\[\]\{\}]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasForbidden(title, artist) {
  const t = normalizeText(title)
  const a = normalizeText(artist)
  const forbidden = [
    'tribute',
    'cover',
    'covers',
    'karaoke',
    'lofi',
    'lullaby',
    'piano',
    'instrumental',
    'the music of',
    'various artists',
    '致敬',
    '翻唱',
    '卡拉 ok',
    '卡拉ok',
    '纯音乐',
    '伴奏',
    '合集',
    '精选',
    '纪念',
  ]
  return forbidden.some((w) => t.includes(w) || a.includes(w))
}

function scoreAlbum(term, album) {
  const q = normalizeText(term)
  const qTokens = q ? q.split(' ') : []
  const title = normalizeText(album?.collectionName)
  const artist = normalizeText(album?.artistName)
  const poolTA = `${title} ${artist}`.trim()
  const poolAT = `${artist} ${title}`.trim()
  let score = 0

  if ((poolTA && q && poolTA === q) || (poolAT && q && poolAT === q)) score += 160
  if (title && q && title === q) score += 120
  if (title && q && title.startsWith(`${q} `)) score += 70

  if (qTokens.length >= 2) {
    const unionHits = qTokens.filter((t) => t && poolTA.includes(t)).length
    const titleHits = qTokens.filter((t) => t && title.includes(t)).length
    const artistHits = qTokens.filter((t) => t && artist.includes(t)).length
    const coverage = qTokens.length ? unionHits / qTokens.length : 0

    score += Math.round(90 * coverage)
    if (titleHits > 0 && artistHits > 0) score += 40
    if (title && artist && titleHits >= 1 && artistHits >= 2) score += 25
  }

  if (qTokens.length >= 2) {
    if (artist && q && artist === q) score += 80
    if (artist && q && artist.includes(q)) score += 20
  } else {
    if (artist && q && artist === q && title !== q) score -= 35
  }

  const trackCount = Number(album?.trackCount) || 0
  if (trackCount >= 9) score += 8
  if (trackCount > 0 && trackCount < 5) score -= 25

  if (album?.source === 'Netease') score += 5

  if (hasForbidden(album?.collectionName, album?.artistName) && title !== q) score -= 90

  const lenPenalty = Math.max(0, title.length - q.length)
  score -= Math.min(15, lenPenalty)
  return score
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const term = searchParams.get('term')
  
  if (!term) {
    return NextResponse.json({ results: [] }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    // 1. Netease Cloud Music Search (Album)
    // type=10 means Album
    // This is a legacy public API endpoint often used for testing
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout

    const neteasePromise = (async () => {
      try {
        if (NETEASE_API_BASE_URL) {
          const u = new URL(`${NETEASE_API_BASE_URL}/search`)
          u.searchParams.set('keywords', term)
          u.searchParams.set('type', '10')
          u.searchParams.set('limit', '50')
          const res = await fetch(u.toString(), {
            headers: NETEASE_API_COOKIE ? { Cookie: NETEASE_API_COOKIE } : {},
            signal: controller.signal,
          })
          if (!res.ok) return null
          return await res.json()
        }

        const res = await fetch(`https://music.163.com/api/search/get/web?csrf_token=`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: 'https://music.163.com/',
            Cookie: 'os=pc',
          },
          body: `s=${encodeURIComponent(term)}&type=10&offset=0&total=true&limit=50`,
          signal: controller.signal,
        })
        if (!res.ok) return null
        return await res.json()
      } catch (e) {
        console.error('Netease error:', e)
        return null
      }
    })()

    // 2. iTunes Search (Server-side)
    const itunesPromise = fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&limit=50&country=us`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch((e) => {
        console.error('iTunes error:', e)
        return null
      })

    const [neteaseData, itunesData] = await Promise.all([neteasePromise, itunesPromise])
    clearTimeout(timeoutId)

    let results = []

    // Process Netease Data
    if (neteaseData?.result?.albums) {
       const neteaseAlbums = neteaseData.result.albums
         .map((album) => ({
          collectionId: `ne_${album.id}`,
          collectionName: album.name,
          artistName: album.artist.name,
          artworkUrl100: album.picUrl,
          releaseDate: new Date(album.publishTime).toISOString(),
          trackCount: album.size,
          collectionViewUrl: `https://music.163.com/#/album?id=${album.id}`,
          source: 'Netease'
         }))
         .filter((album) => {
           const title = normalizeText(album.collectionName)
           const artist = normalizeText(album.artistName)
           if (hasForbidden(title, artist) && title !== normalizeText(term)) return false
           if (Number(album.trackCount) > 0 && Number(album.trackCount) < 5) return false
           return true
         })
       results = [...results, ...neteaseAlbums]
    }

    // Process iTunes Data
    if (itunesData?.results) {
        const itunesAlbums = itunesData.results.filter(album => {
            const title = album.collectionName?.toLowerCase() || ''
            const artist = album.artistName?.toLowerCase() || ''
            
            if (hasForbidden(title, artist) && normalizeText(title) !== normalizeText(term)) return false
            if (album.trackCount && album.trackCount < 5) return false
            return true
        }).map(album => ({
            ...album,
            source: 'iTunes'
        }))
        
        results = [...results, ...itunesAlbums]
    }

    const scored = results
      .map((x) => ({ x, s: scoreAlbum(term, x) }))
      .filter(({ x, s }) => s > -80 || normalizeText(x?.collectionName) === normalizeText(term))

    scored.sort((a, b) => {
      if (b.s !== a.s) return b.s - a.s
      const aSrc = a.x?.source === 'Netease' ? 1 : 0
      const bSrc = b.x?.source === 'Netease' ? 1 : 0
      if (bSrc !== aSrc) return bSrc - aSrc
      const aTracks = Number(a.x?.trackCount) || 0
      const bTracks = Number(b.x?.trackCount) || 0
      return bTracks - aTracks
    })

    const seen = new Set()
    const deduped = []
    for (const r of scored) {
      const k = `${normalizeText(r.x?.collectionName)}|${normalizeText(r.x?.artistName)}`
      if (seen.has(k)) continue
      seen.add(k)
      deduped.push(r)
    }

    return NextResponse.json(
      { results: deduped.map((r) => r.x).slice(0, 50) },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
    
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ results: [], error: error.message }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  }
}
