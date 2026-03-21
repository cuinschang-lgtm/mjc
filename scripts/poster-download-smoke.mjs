import { chromium } from 'playwright'

const baseURL = process.env.BASE_URL || 'http://localhost:3000'

const browser = await chromium.launch()
const context = await browser.newContext({ acceptDownloads: true })
const page = await context.newPage()

await page.goto(`${baseURL}/__dev/poster`, { waitUntil: 'networkidle' })

const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
await page.getByRole('button', { name: '下载 PNG' }).click()
const download = await downloadPromise

const path = await download.path()
if (!path) {
  throw new Error('download path missing')
}

const fs = await import('node:fs/promises')
const stat = await fs.stat(path)
if (stat.size < 50_000) {
  throw new Error(`download too small: ${stat.size}`)
}

console.log('OK download bytes', stat.size)
await browser.close()

