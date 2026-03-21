const base = process.env.BASE_URL || 'http://localhost:3000'
const albumId = process.env.ALBUM_ID || process.argv[2]

if (!albumId) {
  console.error('Missing ALBUM_ID')
  process.exit(1)
}

const url = `${base}/api/album/${encodeURIComponent(albumId)}/reviews`
const res = await fetch(url)
const json = await res.json().catch(() => null)

if (!res.ok) {
  console.error('FAILED', res.status, json)
  process.exit(1)
}

if (!json || !Array.isArray(json.reviews)) {
  console.error('Bad shape', json)
  process.exit(1)
}

console.log('OK reviews', json.reviews.length)
