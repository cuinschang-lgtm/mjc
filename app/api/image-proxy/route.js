import { NextResponse } from 'next/server'

const MAX_BYTES = 6 * 1024 * 1024

function isHttpUrl(value) {
  try {
    const u = new URL(String(value))
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('url')
  if (!raw || !isHttpUrl(raw)) {
    return new NextResponse('bad url', { status: 400 })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)

  try {
    const res = await fetch(raw, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    })

    if (!res.ok) {
      return new NextResponse('fetch failed', { status: 502 })
    }

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.toLowerCase().startsWith('image/')) {
      return new NextResponse('not an image', { status: 415 })
    }

    const ab = await res.arrayBuffer()
    if (ab.byteLength > MAX_BYTES) {
      return new NextResponse('image too large', { status: 413 })
    }

    const out = new NextResponse(ab, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
      },
    })

    return out
  } catch {
    return new NextResponse('proxy error', { status: 502 })
  } finally {
    clearTimeout(timer)
  }
}
