import { NextResponse } from 'next/server'

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
  let score = 0

  if (title && q && title === q) score += 120
  if (title && q && title.startsWith(`${q} `)) score += 70
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
    return NextResponse.json({ results: [] })
  }

  try {
    // 1. Netease Cloud Music Search (Album)
    // type=10 means Album
    // This is a legacy public API endpoint often used for testing
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout

    const neteasePromise = fetch(`https://music.163.com/api/search/get/web?csrf_token=`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://music.163.com/',
        'Cookie': 'os=pc'
      },
      body: `s=${encodeURIComponent(term)}&type=10&offset=0&total=true&limit=50`,
      signal: controller.signal
    }).then(res => res.json()).catch(e => {
        console.error('Netease error:', e)
        return null
    })

    // 2. iTunes Search (Server-side)
    const itunesPromise = fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&limit=50&country=us`, {
        signal: controller.signal
    })
      .then(res => res.json())
      .catch(e => {
        console.error('iTunes error:', e)
        return null
      })

    const [neteaseData, itunesData] = await Promise.all([neteasePromise, itunesPromise])
    clearTimeout(timeoutId)

    let results = []

    // Process Netease Data
    if (neteaseData?.result?.albums) {
       const neteaseAlbums = neteaseData.result.albums.map(album => ({
          collectionId: `ne_${album.id}`,
          collectionName: album.name,
          artistName: album.artist.name,
          artworkUrl100: album.picUrl,
          releaseDate: new Date(album.publishTime).toISOString(),
          trackCount: album.size,
          collectionViewUrl: `https://music.163.com/#/album?id=${album.id}`,
          source: 'Netease'
       }))
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

    return NextResponse.json({ results: scored.map((r) => r.x).slice(0, 50) })
    
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ results: [], error: error.message })
  }
}
