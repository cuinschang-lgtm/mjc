import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { generateAlbumDetails, isDeepSeekConfigured } from '@/lib/deepseekService'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const CACHE_DIR = path.join(process.cwd(), '.cache', 'album-details')
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const HOST_MIN_INTERVAL_MS = 900
const NETEASE_API_BASE_URL = (process.env.NETEASE_API_BASE_URL || '').trim().replace(/\/+$/, '')
const NETEASE_API_COOKIE = (process.env.NETEASE_API_COOKIE || '').trim()
const MUSICBRAINZ_ENABLED = (process.env.MUSICBRAINZ_ENABLED || '').trim() !== '0'

const hostLastAt = new Map()

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function stripHtml(text) {
  const s = String(text || '')
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|\u00a0/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function safeId(id) {
  return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '')
}

async function fetchRateLimited(url, opts = {}, timeoutMs = 9000, retries = 2) {
  const u = new URL(url)
  const host = u.host

  const last = hostLastAt.get(host) || 0
  const now = Date.now()
  const wait = last + HOST_MIN_INTERVAL_MS - now
  if (wait > 0) await sleep(wait)
  hostLastAt.set(host, Date.now())

  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        ...(opts.headers || {}),
      },
    })
    
    if (!res.ok && retries > 0 && res.status >= 500) {
      clearTimeout(id)
      await sleep(500)
      return fetchRateLimited(url, opts, timeoutMs, retries - 1)
    }
    
    return res
  } catch (e) {
    if (retries > 0 && (e.name === 'AbortError' || e.name === 'TypeError')) {
      clearTimeout(id)
      await sleep(500)
      return fetchRateLimited(url, opts, timeoutMs, retries - 1)
    }
    throw e
  } finally {
    clearTimeout(id)
  }
}

async function withRetry(fn, { retries = 2, baseDelayMs = 600 } = {}) {
  let lastErr = null
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fn(i)
    } catch (e) {
      lastErr = e
      if (i >= retries) break
      const ms = baseDelayMs * Math.pow(1.7, i)
      await sleep(ms)
    }
  }
  throw lastErr
}

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true })
}

async function readCache(albumId) {
  try {
    const p = path.join(CACHE_DIR, `${safeId(albumId)}.json`)
    const raw = await fs.readFile(p, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

async function writeCache(albumId, payload) {
  await ensureCacheDir()
  const p = path.join(CACHE_DIR, `${safeId(albumId)}.json`)
  await fs.writeFile(p, JSON.stringify(payload, null, 2), 'utf8')
}

async function neteaseSearchAlbumId(title, artist, timeoutMs = 9000) {
  const q = [title, artist].filter(Boolean).join(' ').trim()
  if (!q) return null

  if (NETEASE_API_BASE_URL) {
    const u = new URL(`${NETEASE_API_BASE_URL}/search`)
    u.searchParams.set('keywords', q)
    u.searchParams.set('type', '10')
    u.searchParams.set('limit', '5')
    const res = await fetchRateLimited(
      u.toString(),
      { headers: NETEASE_API_COOKIE ? { Cookie: NETEASE_API_COOKIE } : {} },
      timeoutMs
    )
    if (!res.ok) return null
    const json = await res.json()
    const albums = json?.result?.albums
    if (!Array.isArray(albums) || albums.length === 0) return null
    return albums[0]?.id ? String(albums[0].id) : null
  }

  const body = `s=${encodeURIComponent(q)}&type=10&offset=0&total=true&limit=5`
  const res = await fetchRateLimited(
    'https://music.163.com/api/search/get/web?csrf_token=',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: 'https://music.163.com/',
        Cookie: process.env.NETEASE_COOKIE || 'os=pc',
      },
      body,
    },
    timeoutMs
  )
  if (!res.ok) return null
  const json = await res.json()
  const albums = json?.result?.albums
  if (!Array.isArray(albums) || albums.length === 0) return null
  return albums[0]?.id ? String(albums[0].id) : null
}

async function neteaseAlbumDetail(neteaseAlbumId, timeoutMs = 9000) {
  if (NETEASE_API_BASE_URL) {
    const u = new URL(`${NETEASE_API_BASE_URL}/album`)
    u.searchParams.set('id', String(neteaseAlbumId))
    const res = await fetchRateLimited(
      u.toString(),
      { headers: NETEASE_API_COOKIE ? { Cookie: NETEASE_API_COOKIE } : {} },
      timeoutMs
    )
    if (!res.ok) return null
    const json = await res.json()
    return json?.album ? json : null
  }

  const res = await fetchRateLimited(
    `https://music.163.com/api/album/${encodeURIComponent(neteaseAlbumId)}`,
    {
      headers: {
        Referer: 'https://music.163.com/',
        Cookie: process.env.NETEASE_COOKIE || 'os=pc',
      },
    },
    timeoutMs
  )
  if (!res.ok) return null
  const json = await res.json()
  return json?.album ? json : null
}

function limitText(text, max = 1200) {
  const s = String(text || '').trim()
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max)}…` : s
}

function parseMetaDescription(html) {
  const m = String(html || '').match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["'][^>]*>/i)
  return m ? stripHtml(m[1]) : ''
}

function isBaikeGarbage(text) {
  if (!text) return true
  const s = String(text).trim()
  if (/^百度百科是/i.test(s)) return true
  if (/^百科词条/i.test(s)) return true
  if (/百度百科是一部内容开放/i.test(s)) return true
  if (/全球领先的中文百科全书/i.test(s)) return true
  if (/百科是一部/i.test(s)) return true
  if (s.length < 20) return true
  return false
}

async function baikeArtistBio(artistName) {
  if (!artistName) return null
  const q = String(artistName).trim()
  if (!q) return null

  const url = `https://baike.baidu.com/search/word?word=${encodeURIComponent(q)}`
  const res = await fetchRateLimited(url)
  if (!res.ok) return null
  const html = await res.text()
  const desc = parseMetaDescription(html)
  if (!desc || isBaikeGarbage(desc)) return null
  return limitText(desc, 900)
}

async function baikeSearchAlbum(title, artist) {
  const q = [title, artist, '专辑'].filter(Boolean).join(' ').trim()
  if (!q) return null

  const url = `https://baike.baidu.com/search/word?word=${encodeURIComponent(q)}`
  const res = await fetchRateLimited(url)
  if (!res.ok) return null
  const html = await res.text()
  const desc = parseMetaDescription(html)
  if (!desc || isBaikeGarbage(desc)) return null
  return limitText(desc, 1000)
}

function doubanPickFirstSubjectUrl(html) {
  const re = /https?:\/\/music\.douban\.com\/subject\/(\d+)\//g
  const m = re.exec(String(html || ''))
  if (m) return { id: m[1], url: `https://music.douban.com/subject/${m[1]}/` }
  return null
}

function doubanParseRating(html) {
  const m = String(html || '').match(/<strong[^>]*class="[^"]*rating_num[^"]*"[^>]*>([\d.]+)<\/strong>/i)
  const v = String(html || '').match(/<span[^>]*property="v:votes"[^>]*>(\d+)<\/span>/i)
  if (!m) return null
  const score = Number(m[1])
  const votes = v ? Number(v[1]) : null
  if (!isFinite(score)) return null
  return { score, votes }
}

async function doubanFetchAlbum(title, artist) {
  const q = [title, artist].filter(Boolean).join(' ').trim()
  if (!q) return null

  const headers = process.env.DOUBAN_COOKIE ? { Cookie: process.env.DOUBAN_COOKIE } : {}

  const searchUrl = `https://search.douban.com/music/subject_search?search_text=${encodeURIComponent(q)}`
  const searchRes = await fetchRateLimited(searchUrl, { headers })
  if (!searchRes.ok) return null
  const searchHtml = await searchRes.text()
  const subject = doubanPickFirstSubjectUrl(searchHtml)
  if (!subject) return null

  const subjectRes = await fetchRateLimited(subject.url, { headers })
  if (!subjectRes.ok) return { subjectUrl: subject.url, rating: null, description: null }
  const subjectHtml = await subjectRes.text()
  const rating = doubanParseRating(subjectHtml)
  const desc = parseMetaDescription(subjectHtml)
  return { subjectUrl: subject.url, rating, description: desc ? limitText(desc, 900) : null }
}

async function neteaseArtistDesc(artistId, timeoutMs = 9000) {
  if (NETEASE_API_BASE_URL) {
    const u = new URL(`${NETEASE_API_BASE_URL}/artist/desc`)
    u.searchParams.set('id', String(artistId))
    const res = await fetchRateLimited(
      u.toString(),
      { headers: NETEASE_API_COOKIE ? { Cookie: NETEASE_API_COOKIE } : {} },
      timeoutMs
    )
    if (!res.ok) return null
    const json = await res.json()
    return json && typeof json === 'object' ? json : null
  }

  const res = await fetchRateLimited(
    `https://music.163.com/api/artist/desc?id=${encodeURIComponent(artistId)}`,
    {
      headers: {
        Referer: 'https://music.163.com/',
        Cookie: process.env.NETEASE_COOKIE || 'os=pc',
      },
    },
    timeoutMs
  )
  if (!res.ok) return null
  const json = await res.json()
  return json && typeof json === 'object' ? json : null
}

function formatDuration(ms) {
  const n = Number(ms)
  if (!isFinite(n) || n <= 0) return null
  const total = Math.floor(n / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

async function neteaseArtistDetail(artistId, timeoutMs = 9000) {
  if (NETEASE_API_BASE_URL) {
    const tryUrls = [
      (() => {
        const u = new URL(`${NETEASE_API_BASE_URL}/artist/detail`)
        u.searchParams.set('id', String(artistId))
        return u.toString()
      })(),
      (() => {
        const u = new URL(`${NETEASE_API_BASE_URL}/artist`)
        u.searchParams.set('id', String(artistId))
        return u.toString()
      })(),
    ]

    for (const url of tryUrls) {
      const res = await fetchRateLimited(
        url,
        { headers: NETEASE_API_COOKIE ? { Cookie: NETEASE_API_COOKIE } : {} },
        timeoutMs
      )
      if (!res.ok) continue
      const json = await res.json()
      if (json && typeof json === 'object') return json
    }
    return null
  }

  const res = await fetchRateLimited(
    `https://music.163.com/api/artist/${encodeURIComponent(artistId)}`,
    {
      headers: {
        Referer: 'https://music.163.com/',
        Cookie: process.env.NETEASE_COOKIE || 'os=pc',
      },
    },
    timeoutMs
  )
  if (!res.ok) return null
  const json = await res.json()
  return json && typeof json === 'object' ? json : null
}

async function neteaseAlbumComments(neteaseAlbumId, limit = 12, timeoutMs = 9000) {
  if (NETEASE_API_BASE_URL) {
    const u = new URL(`${NETEASE_API_BASE_URL}/comment/album`)
    u.searchParams.set('id', String(neteaseAlbumId))
    u.searchParams.set('limit', String(limit))
    u.searchParams.set('offset', '0')
    const res = await fetchRateLimited(
      u.toString(),
      { headers: NETEASE_API_COOKIE ? { Cookie: NETEASE_API_COOKIE } : {} },
      timeoutMs
    )
    if (!res.ok) return null
    const json = await res.json()
    return json && typeof json === 'object' ? json : null
  }

  const rid = `R_AL_3_${String(neteaseAlbumId)}`
  const url = `https://music.163.com/api/v1/resource/comments/${encodeURIComponent(rid)}?limit=${encodeURIComponent(limit)}&offset=0`
  const res = await fetchRateLimited(
    url,
    {
      headers: {
        Referer: 'https://music.163.com/',
        Cookie: process.env.NETEASE_COOKIE || 'os=pc',
      },
    },
    timeoutMs
  )
  if (!res.ok) return null
  const json = await res.json()
  return json && typeof json === 'object' ? json : null
}

async function musicBrainzSearchRelease(title, artist) {
  if (!MUSICBRAINZ_ENABLED) return null
  const qTitle = String(title || '').trim()
  const qArtist = String(artist || '').trim()
  if (!qTitle || !qArtist) return null
  const query = `release:${qTitle} AND artist:${qArtist}`
  const url = `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&limit=5&fmt=json`
  const res = await fetchRateLimited(url, { headers: { 'User-Agent': UA } }, 9000)
  if (!res.ok) return null
  const json = await res.json()
  const list = Array.isArray(json?.releases) ? json.releases : []
  return list.length ? list[0] : null
}

async function musicBrainzReleaseDetail(id) {
  if (!MUSICBRAINZ_ENABLED) return null
  if (!id) return null
  const url = `https://musicbrainz.org/ws/2/release/${encodeURIComponent(String(id))}?inc=recordings+labels&fmt=json`
  const res = await fetchRateLimited(url, { headers: { 'User-Agent': UA } }, 9000)
  if (!res.ok) return null
  const json = await res.json()
  return json && typeof json === 'object' ? json : null
}

async function coverArtArchiveFront(releaseId) {
  if (!MUSICBRAINZ_ENABLED) return null
  if (!releaseId) return null
  const url = `https://coverartarchive.org/release/${encodeURIComponent(String(releaseId))}/front`
  const res = await fetchRateLimited(url, {}, 9000)
  if (!res.ok) return null
  return res.url || null
}

function summarizeNeteaseComments(payload) {
  const hot = Array.isArray(payload?.hotComments) ? payload.hotComments : []
  const normal = Array.isArray(payload?.comments) ? payload.comments : []
  const list = [...hot, ...normal]
    .filter((c) => c && typeof c === 'object' && typeof c.content === 'string')
    .sort((a, b) => (Number(b?.likedCount) || 0) - (Number(a?.likedCount) || 0))
    .slice(0, 3)

  if (list.length === 0) return null
  const lines = list.map((c) => {
    const user = c?.user?.nickname ? String(c.user.nickname) : '用户'
    const likes = Number(c?.likedCount) || 0
    const content = stripHtml(c.content)
    return `- ${user}${likes ? `（${likes} 赞）` : ''}：${content}`
  })

  return `网易云热评摘录：\n${lines.join('\n')}`
}

/**
 * 解析 AI 生成的曲目列表
 */
function parseTracksFromAI(tracklistJson) {
  if (!tracklistJson) return []
  try {
    const tracks = typeof tracklistJson === 'string' ? JSON.parse(tracklistJson) : tracklistJson
    if (!Array.isArray(tracks)) return []

    return tracks.map((t) => {
      // 解析时长 "3:45" -> 毫秒
      let durationMs = null
      if (t.duration) {
        const parts = String(t.duration).split(':')
        if (parts.length === 2) {
          const min = parseInt(parts[0], 10)
          const sec = parseInt(parts[1], 10)
          if (!isNaN(min) && !isNaN(sec)) {
            durationMs = (min * 60 + sec) * 1000
          }
        }
      }

      return {
        index: t.index || 0,
        name: t.name || '未知曲目',
        durationMs,
        durationText: t.duration || null,
        artists: null,
        neteaseSongUrl: null,
      }
    })
  } catch (e) {
    console.error('Failed to parse AI tracklist:', e)
    return []
  }
}

/**
 * 计算曲目总时长
 */
function calculateTotalDuration(tracks) {
  if (!Array.isArray(tracks)) return null
  return tracks.reduce((sum, t) => sum + (Number(t.durationMs) || 0), 0) || null
}

/**
 * 异步生成 AI 内容（不阻塞响应）
 */
async function generateAlbumDetailsAsync(albumId, albumRow) {
  if (!isDeepSeekConfigured()) {
    console.log('DeepSeek not configured, skipping AI generation')
    return
  }

  try {
    console.log(`Starting AI generation for album ${albumId}`)
    const aiData = await generateAlbumDetails({
      title: albumRow.title,
      artist: albumRow.artist,
      releaseDate: albumRow.release_date,
    })

    // 使用服务端密钥创建 Supabase 客户端
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials for AI generation')
      return
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    await supabase
      .from('album_content_overrides')
      .upsert(
        {
          album_id: albumId,
          artist_bio: aiData.artistBio,
          creation_background: aiData.creationBackground,
          media_reviews: aiData.mediaReviews,
          awards: aiData.awards,
          tracklist_json: JSON.stringify(aiData.tracklist || []),
          is_ai_generated: true,
          ai_model: 'deepseek-chat',
          ai_generated_at: new Date().toISOString(),
        },
        { onConflict: 'album_id' }
      )

    console.log(`AI generation completed for album ${albumId}`)
  } catch (e) {
    console.error('Async AI generation failed for album', albumId, e)
  }
}

export async function GET(request) {
  const supabase = createSupabaseServerClient()
  const { searchParams } = new URL(request.url)
  const albumId = searchParams.get('albumId')
  const refresh = searchParams.get('refresh') === '1'
  const aiGenerate = searchParams.get('ai') === '1'
  const useAi = searchParams.get('useAi') === '1'
  const fast = searchParams.get('fast') === '1'
  if (!albumId) {
    return NextResponse.json({ error: 'missing albumId' }, { status: 400 })
  }

  // 快速模式：只返回数据库中的基本信息，不抓取外部 API
  if (fast) {
    let albumRow = null
    try {
      const r = await supabase
        .from('albums')
        .select('id,title,artist,cover_url,release_date,netease_album_id,description,genres,gallery_urls')
        .eq('id', albumId)
        .maybeSingle()
      albumRow = r.data
    } catch {}
    if (!albumRow) {
      try {
        const r = await supabase
          .from('albums')
          .select('id,title,artist,cover_url,release_date,description,genres,gallery_urls')
          .eq('id', albumId)
          .maybeSingle()
        albumRow = r.data
      } catch {}
    }
    if (!albumRow) {
      return NextResponse.json({ error: 'album not found' }, { status: 404 })
    }

    // 检查文件缓存
    const cached = await readCache(albumId)
    const now = Date.now()
    if (cached?.expiresAt && typeof cached.expiresAt === 'number' && cached.expiresAt > now) {
      return NextResponse.json({ ...cached.data, cacheHit: true }, { status: 200 })
    }

    // 返回基本信息，标记为 partial
    return NextResponse.json({
      basic: {
        albumId: albumRow.id,
        title: albumRow.title,
        artistName: albumRow.artist,
        releaseDate: albumRow.release_date ? String(albumRow.release_date) : null,
        albumType: null,
        description: albumRow.description || null,
        genres: albumRow.genres || null,
        galleryUrls: albumRow.gallery_urls || null,
        platform: null,
        platforms: null,
        publishCompany: null,
        coverImageUrl: albumRow.cover_url || null,
        artistImageUrl: null,
        trackCount: null,
        durationMs: null,
        durationText: null,
        tracks: null,
        rating: null,
        externalIds: { neteaseAlbumId: albumRow.netease_album_id || null },
        sourceUrl: null,
      },
      content: { artistBio: null, creationBackground: null, mediaReviews: null, awards: null },
      fetchedAt: new Date().toISOString(),
      cacheHit: false,
      stale: false,
      partial: true,
      completeness: { basic: { filled: 3, total: 7 }, content: { filled: 0, total: 4 } },
      sources: [],
    }, { status: 200 })
  }

  // AI 生成请求：同步执行并返回结果
  if (aiGenerate && isDeepSeekConfigured()) {
    const cached = await readCache(albumId)
    let albumRow = null
    try {
      const r = await supabase
        .from('albums')
        .select('id,title,artist,cover_url,release_date,netease_album_id,description,genres,gallery_urls')
        .eq('id', albumId)
        .maybeSingle()
      albumRow = r.data
    } catch {}
    if (!albumRow) {
      try {
        const r = await supabase
          .from('albums')
          .select('id,title,artist,cover_url,release_date,description,genres,gallery_urls')
          .eq('id', albumId)
          .maybeSingle()
        albumRow = r.data
      } catch {}
    }
    if (!albumRow) {
      return NextResponse.json({ error: 'album not found' }, { status: 404 })
    }

    // 收集已有数据作为 AI 参考
    const existingData = cached?.data ? {
      tracks: cached.data.basic?.tracks || null,
      artistBio: cached.data.content?.artistBio || null,
      creationBackground: cached.data.content?.creationBackground || null,
    } : null

    try {
      const aiData = await generateAlbumDetails({
        title: albumRow.title,
        artist: albumRow.artist,
        releaseDate: albumRow.release_date,
        existingData,
      })

      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      const adminClient = createClient(supabaseUrl, supabaseServiceKey)

      await adminClient
        .from('album_content_overrides')
        .upsert(
          {
            album_id: albumId,
            artist_bio: aiData.artistBio,
            creation_background: aiData.creationBackground,
            media_reviews: aiData.mediaReviews,
            awards: aiData.awards,
            tracklist_json: JSON.stringify(aiData.tracklist || []),
            is_ai_generated: true,
            ai_model: 'deepseek-chat',
            ai_generated_at: new Date().toISOString(),
          },
          { onConflict: 'album_id' }
        )

      return NextResponse.json({ success: true, aiGenerated: true }, { status: 200 })
    } catch (e) {
      console.error('AI generation failed:', e)
      return NextResponse.json({ error: e.message || 'AI generation failed' }, { status: 500 })
    }
  }

  const cached = refresh ? null : await readCache(albumId)
  const now = Date.now()
  if (!refresh && cached?.expiresAt && typeof cached.expiresAt === 'number' && cached.expiresAt > now) {
    return NextResponse.json({ ...cached.data, cacheHit: true }, { status: 200 })
  }

  // Select album row (兼容未应用新字段的情况)
  let albumRow = null
  let error = null
  try {
      const r1 = await supabase
      .from('albums')
      .select('id,title,artist,cover_url,release_date,netease_album_id,description,genres,gallery_urls')
      .eq('id', albumId)
      .maybeSingle()
    albumRow = r1.data
    error = r1.error
  } catch (e) {
    error = e
  }
  if (error || !albumRow) {
    try {
      const r2 = await supabase
        .from('albums')
        .select('id,title,artist,cover_url,release_date,description,genres,gallery_urls')
        .eq('id', albumId)
        .maybeSingle()
      albumRow = r2.data
      error = r2.error
    } catch (e) {
      error = e
    }
  }
  if (error) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
  if (!albumRow) {
    return NextResponse.json({ error: 'album not found' }, { status: 404 })
  }

  // 1. 检查是否有 AI 生成的内容缓存（仅作为补充，不替代原始数据）
  let aiContent = null
  try {
    const { data: aiData } = await supabase
      .from('album_content_overrides')
      .select('*')
      .eq('album_id', albumId)
      .maybeSingle()
    aiContent = aiData
  } catch (e) {
    console.error('Failed to check AI content cache:', e)
  }

  let sources = []
  let artistBio = ''
  let creationBackground = ''
  let mediaReviews = ''
  let awards = ''

  let releaseDate = albumRow.release_date ? String(albumRow.release_date) : null
  let coverImageUrl = albumRow.cover_url || null
  let albumType = null
  let publishCompany = null
  let trackCount = null
  let durationMs = null
  let tracks = null
  let artistImageUrl = null
  let neteaseAlbumIdUsed = null
  let doubanRating = null
  const platforms = []

  const neteaseTimeoutMs = refresh ? 14000 : 9000

  try {
    const neteaseAlbumId = albumRow?.netease_album_id
      ? String(albumRow.netease_album_id)
      : await withRetry(() => neteaseSearchAlbumId(albumRow.title, albumRow.artist, neteaseTimeoutMs), {
          retries: 2,
          baseDelayMs: 450,
        }).catch(() => null)

    if (neteaseAlbumId) {
      neteaseAlbumIdUsed = String(neteaseAlbumId)

      if (!albumRow?.netease_album_id) {
        try {
          await supabase.from('albums').update({ netease_album_id: neteaseAlbumIdUsed }).eq('id', albumRow.id)
        } catch {}
      }

      platforms.push('网易云音乐')
      sources.push({ name: 'Netease', url: `https://music.163.com/#/album?id=${neteaseAlbumIdUsed}` })
      const detail = await withRetry(() => neteaseAlbumDetail(neteaseAlbumIdUsed, neteaseTimeoutMs), { retries: 2, baseDelayMs: 450 }).catch(
        () => null
      )
      const a = detail?.album
      if (a) {
        if (!coverImageUrl && a.picUrl) coverImageUrl = a.picUrl
        if (a.publishTime && !releaseDate) releaseDate = new Date(a.publishTime).toISOString().slice(0, 10)
        const typeParts = [a.type, a.subType].filter(Boolean)
        albumType = typeParts.length ? typeParts.join(' / ') : albumType
        publishCompany = a.company || publishCompany
        if (a.description) creationBackground = limitText(stripHtml(a.description), 1500)

        const songs = Array.isArray(detail?.songs) ? detail.songs : []
        if (songs.length) {
          trackCount = songs.length
          durationMs = songs.reduce((sum, s) => sum + (Number(s?.duration || s?.dt) || 0), 0)
          tracks = songs.map((s, i) => {
            const dt = Number(s?.duration || s?.dt) || null
            const artists = Array.isArray(s?.artists)
              ? s.artists.map((x) => x?.name).filter(Boolean).join(' / ')
              : Array.isArray(s?.ar)
                ? s.ar.map((x) => x?.name).filter(Boolean).join(' / ')
                : null
            const id = s?.id ? String(s.id) : null
            return {
              index: i + 1,
              name: s?.name ? String(s.name) : null,
              durationMs: dt,
              durationText: dt ? formatDuration(dt) : null,
              artists,
              neteaseSongUrl: id ? `https://music.163.com/#/song?id=${id}` : null,
            }
          })
        } else if (a.size && !trackCount) {
          trackCount = Number(a.size) || null
        }

        const artistId = a.artist?.id
        if (artistId) {
          const desc = await withRetry(() => neteaseArtistDesc(String(artistId), neteaseTimeoutMs), { retries: 1, baseDelayMs: 450 }).catch(
            () => null
          )
          const brief = stripHtml(desc?.briefDesc)
          const intro = Array.isArray(desc?.introduction)
            ? desc.introduction.map((x) => stripHtml(x?.txt)).filter(Boolean).join('\n\n')
            : ''
          const neteaseBio = [brief, intro].filter(Boolean).join('\n\n')
          artistBio = neteaseBio || artistBio

          const artistDetail = await withRetry(() => neteaseArtistDetail(String(artistId), neteaseTimeoutMs), { retries: 1, baseDelayMs: 450 }).catch(
            () => null
          )
          const img = artistDetail?.artist?.picUrl || artistDetail?.artist?.img1v1Url || null
          if (img && !artistImageUrl) artistImageUrl = String(img)
        }
      }

      if (!mediaReviews) {
        const c = await withRetry(() => neteaseAlbumComments(neteaseAlbumIdUsed, 12, neteaseTimeoutMs), { retries: 1, baseDelayMs: 450 }).catch(
          () => null
        )
        const summary = c ? summarizeNeteaseComments(c) : null
        if (summary) {
          mediaReviews = `${summary}\n来源：https://music.163.com/#/album?id=${neteaseAlbumIdUsed}`
        }
      }
    }

    // Fallback via MusicBrainz when essential fields missing
    if (MUSICBRAINZ_ENABLED && (!tracks || !trackCount || !coverImageUrl || !releaseDate || !publishCompany)) {
      const mbRelease = await musicBrainzSearchRelease(albumRow.title, albumRow.artist)
      if (mbRelease?.id) {
        sources.push({ name: 'MusicBrainz', url: `https://musicbrainz.org/release/${mbRelease.id}` })
        platforms.push('MusicBrainz')
        const mbDetail = await musicBrainzReleaseDetail(mbRelease.id)
        if (mbDetail) {
          if (!releaseDate && mbDetail?.date) releaseDate = String(mbDetail.date)
          if (!publishCompany) {
            const label = Array.isArray(mbDetail?.label-info) ? mbDetail['label-info'][0]?.label?.name : null
            publishCompany = label || publishCompany
          }
          const media = Array.isArray(mbDetail?.media) ? mbDetail.media : []
          const recordings = media.flatMap((m) => Array.isArray(m?.tracks) ? m.tracks : [])
          if (recordings.length) {
            trackCount = recordings.length
            tracks = recordings.map((t, i) => {
              const title = t?.title ? String(t.title) : null
              const lenMs = Number(t?.length) || null
              return {
                index: i + 1,
                name: title,
                durationMs: lenMs,
                durationText: lenMs ? formatDuration(lenMs) : null,
                artists: null,
                neteaseSongUrl: null,
              }
            })
            durationMs = recordings.reduce((sum, t) => sum + (Number(t?.length) || 0), 0) || durationMs
          }
          if (!coverImageUrl) {
            const img = await coverArtArchiveFront(mbRelease.id).catch(() => null)
            if (img) coverImageUrl = img
          }
        }
      }
    }

    if (!artistBio) {
      const baike = await baikeArtistBio(albumRow.artist)
      if (baike) {
        platforms.push('百度百科')
        artistBio = baike
        sources.push({ name: 'BaiduBaike', url: `https://baike.baidu.com/item/${encodeURIComponent(albumRow.artist)}` })
      }
    }

    if (!creationBackground) {
      const baikeAlbum = await baikeSearchAlbum(albumRow.title, albumRow.artist)
      if (baikeAlbum) {
        platforms.push('百度百科')
        creationBackground = baikeAlbum
        sources.push({ name: 'BaiduBaike (Album)', url: `https://baike.baidu.com/search/word?word=${encodeURIComponent(albumRow.title + ' ' + albumRow.artist + ' 专辑')}` })
      }
    }

    const douban = await doubanFetchAlbum(albumRow.title, albumRow.artist)
    if (douban?.subjectUrl) {
      platforms.push('豆瓣')
      sources.push({ name: 'Douban', url: douban.subjectUrl })

      if (douban.rating?.score) {
        doubanRating = {
          source: 'Douban',
          score: douban.rating.score,
          votes: douban.rating.votes || null,
          url: douban.subjectUrl,
          scale: 10,
        }
      }

      let doubanReview = ''
      if (douban.rating?.score) {
        doubanReview = `豆瓣评分：${douban.rating.score} / 10${douban.rating.votes ? `（${douban.rating.votes} 人评价）` : ''}\n来源：${douban.subjectUrl}`
      }
      if (douban.description) {
        const prefix = doubanReview ? '\n\n' : ''
        doubanReview += `${prefix}豆瓣条目简介：\n${douban.description}\n来源：${douban.subjectUrl}`
      }

      if (!mediaReviews) {
        mediaReviews = doubanReview
      } else if (doubanReview) {
        mediaReviews += '\n\n----------------\n' + doubanReview
      }
    }
  } catch (e) {
    if (cached?.data) {
      return NextResponse.json({ ...cached.data, cacheHit: true, stale: true }, { status: 200 })
    }
  }

  const fetchedAt = new Date().toISOString()
  const uniqPlatforms = Array.from(new Set(platforms)).filter(Boolean)
  const basicFilled = [
    albumRow.title,
    albumRow.artist,
    releaseDate,
    albumType,
    publishCompany,
    coverImageUrl,
    trackCount,
  ].filter(Boolean).length
  const contentFilled = [artistBio, creationBackground, mediaReviews, awards].filter(Boolean).length
  const completeness = {
    basic: { filled: basicFilled, total: 7 },
    content: { filled: contentFilled, total: 4 },
  }

  const data = {
    basic: {
      albumId: albumRow.id,
      title: albumRow.title,
      artistName: albumRow.artist,
      releaseDate,
      albumType,
      description: albumRow.description || null,
      genres: albumRow.genres || null,
      galleryUrls: albumRow.gallery_urls || null,
      platform: uniqPlatforms.length ? uniqPlatforms[0] : null,
      platforms: uniqPlatforms.length ? uniqPlatforms : null,
      publishCompany: publishCompany || null,
      coverImageUrl,
      artistImageUrl,
      trackCount,
      durationMs,
      durationText: durationMs ? formatDuration(durationMs) : null,
      tracks: (useAi && aiContent?.tracklist_json) ? parseTracksFromAI(aiContent.tracklist_json) : tracks,
      rating: doubanRating,
      externalIds: {
        neteaseAlbumId: neteaseAlbumIdUsed,
      },
      sourceUrl: sources[0]?.url || null,
    },
    content: {
      artistBio: (useAi && aiContent?.artist_bio) || artistBio || (aiContent?.artist_bio) || null,
      creationBackground: (useAi && aiContent?.creation_background) || creationBackground || (aiContent?.creation_background) || null,
      mediaReviews: (useAi && aiContent?.media_reviews) || mediaReviews || (aiContent?.media_reviews) || null,
      awards: (useAi && aiContent?.awards) || awards || (aiContent?.awards) || null,
    },
    fetchedAt,
    cacheHit: false,
    stale: false,
    completeness,
    sources,
    aiGenerated: !!aiContent?.is_ai_generated,
  }

  try {
    await writeCache(albumId, { expiresAt: now + CACHE_TTL_MS, data })
  } catch {}

  return NextResponse.json(data, { status: 200 })
}
