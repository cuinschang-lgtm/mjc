import { NextResponse } from 'next/server'

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
      body: `s=${encodeURIComponent(term)}&type=10&offset=0&total=true&limit=20`,
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
        // Basic filtering for iTunes to match previous logic
        const forbidden = ['tribute', 'cover', 'lofi', 'karaoke', 'musical', 'piano', 'lullaby', 'the music of', 'various artists']
        
        const itunesAlbums = itunesData.results.filter(album => {
            const title = album.collectionName?.toLowerCase() || ''
            const artist = album.artistName?.toLowerCase() || ''
            
            if (forbidden.some(word => title.includes(word) || artist.includes(word))) return false
            if (album.trackCount && album.trackCount < 5) return false
            return true
        }).map(album => ({
            ...album,
            source: 'iTunes'
        }))
        
        results = [...results, ...itunesAlbums]
    }

    // Sort Logic
    // Prioritize Netease for exact matches as user requested
    results.sort((a, b) => {
        const q = term.toLowerCase()
        const aTitle = a.collectionName.toLowerCase()
        const bTitle = b.collectionName.toLowerCase()
        const aArtist = a.artistName.toLowerCase()
        const bArtist = b.artistName.toLowerCase()

        // 1. Exact Artist Match
        if (aArtist === q && bArtist !== q) return -1
        if (bArtist === q && aArtist !== q) return 1

        // 2. Exact Title Match
        if (aTitle === q && bTitle !== q) return -1
        if (bTitle === q && aTitle !== q) return 1
        
        // 3. Source Priority (Netease first if user prefers domestic for accuracy)
        if (a.source === 'Netease' && b.source !== 'Netease') return -1
        if (b.source === 'Netease' && a.source !== 'Netease') return 1

        return 0
    })

    return NextResponse.json({ results: results.slice(0, 50) })
    
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ results: [], error: error.message })
  }
}