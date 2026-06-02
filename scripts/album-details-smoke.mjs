const baseURL = process.env.BASE_URL || 'http://localhost:3000'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function fetchWithRetry(url, { retries = 3 } = {}) {
  let last
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url)
      if (res.status >= 500 && i < retries - 1) {
        await new Promise((r) => setTimeout(r, 600))
        continue
      }
      return res
    } catch (e) {
      last = e
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 600))
    }
  }
  throw last || new Error('fetch failed')
}

async function main() {
  const r1 = await fetchWithRetry(`${baseURL}/api/album-details`)
  assert(r1.status === 400, `expected 400 for missing albumId, got ${r1.status}`)
  const j1 = await r1.json()
  assert(j1 && j1.error, 'expected error payload for missing albumId')

  const fakeId = '00000000-0000-0000-0000-000000000000'
  const r2 = await fetchWithRetry(`${baseURL}/api/album-details?albumId=${encodeURIComponent(fakeId)}`)
  assert(r2.status === 404, `expected 404 for unknown albumId, got ${r2.status}`)
  const j2 = await r2.json()
  assert(j2 && j2.error, 'expected error payload for unknown albumId')

  console.log('album-details smoke test passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
