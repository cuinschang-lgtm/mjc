import { NextResponse } from 'next/server'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

async function fetchWithTimeout(url, opts = {}, timeoutMs = 8000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        ...(opts.headers || {}),
      },
      signal: controller.signal,
      ...opts,
    })
    return res
  } finally {
    clearTimeout(id)
  }
}

function pickFirstSubjectUrl(html) {
  const re = /https?:\/\/music\.douban\.com\/subject\/(\d+)\//g
  const m = re.exec(html)
  if (m) return { id: m[1], url: `https://music.douban.com/subject/${m[1]}/` }
  return null
}

function parseRating(html) {
  const m = html.match(/<strong[^>]*class="[^"]*rating_num[^"]*"[^>]*>([\d.]+)<\/strong>/i)
  const v = html.match(/<span[^>]*property="v:votes"[^>]*>(\d+)<\/span>/i)
  if (!m) return null
  const score = Number(m[1])
  const votes = v ? Number(v[1]) : null
  if (!isFinite(score)) return null
  return { score, votes }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') || ''
  const artist = searchParams.get('artist') || ''
  const q = [title, artist].filter(Boolean).join(' ')
  if (!q) return NextResponse.json({ score: null, votes: null, subjectUrl: null })

  try {
    const searchUrl = `https://search.douban.com/music/subject_search?search_text=${encodeURIComponent(q)}`
    const searchRes = await fetchWithTimeout(searchUrl)
    if (!searchRes.ok) throw new Error(`Douban search ${searchRes.status}`)
    const searchHtml = await searchRes.text()
    const subject = pickFirstSubjectUrl(searchHtml)
    if (!subject) return NextResponse.json({ score: null, votes: null, subjectUrl: null })

    const subjectRes = await fetchWithTimeout(subject.url)
    if (!subjectRes.ok) throw new Error(`Douban subject ${subjectRes.status}`)
    const subjectHtml = await subjectRes.text()
    const parsed = parseRating(subjectHtml)
    if (!parsed) return NextResponse.json({ score: null, votes: null, subjectUrl: subject.url })

    return NextResponse.json({ ...parsed, subjectUrl: subject.url })
  } catch (e) {
    console.error('Douban rating error:', e?.message || e)
    return NextResponse.json({ score: null, votes: null, subjectUrl: null, error: e?.message || 'error' }, { status: 200 })
  }
}

