import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://localhost:3400'

const scenarios = [
  { name: 'desktop-dark', viewport: { width: 1280, height: 800 }, colorScheme: 'dark' },
  { name: 'mobile-dark', viewport: { width: 390, height: 844 }, colorScheme: 'dark' },
]

async function runScenario(s) {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: s.viewport, colorScheme: s.colorScheme })

  await context.addInitScript(() => {
    try {
      localStorage.setItem(
        'pickup:onboarding:v5',
        JSON.stringify({ step: 'epilogue', done: false, lastAlbumId: '' })
      )
    } catch {}
  })

  const page = await context.newPage()
  await page.goto(`${baseUrl}/album/demo?__onboarding_test=1`, { waitUntil: 'domcontentloaded' })

  await page.waitForSelector('.driver-popover.pickup-tour', { timeout: 15000 })
  await page.waitForSelector('[data-ep-container="1"]', { timeout: 15000 })
  await page.waitForSelector('.pickup-tour-epilogue-line.is-in', { timeout: 15000 })

  const lineCount = await page.evaluate(() => {
    const container = document.querySelector('[data-ep-container="1"]')
    if (!container) return 0
    return container.querySelectorAll('[data-ep-line]')?.length || 0
  })

  if (lineCount > 0) {
    await page.waitForFunction(
      () => {
        const container = document.querySelector('[data-ep-container="1"]')
        if (!container) return false
        const lines = container.querySelectorAll('[data-ep-line]')
        if (!lines?.length) return false
        return lines[lines.length - 1]?.classList?.contains('is-in')
      },
      { timeout: 45000 }
    )

    await page.waitForFunction(
      () => {
        const container = document.querySelector('[data-ep-container="1"]')
        if (!container) return false
        const lines = container.querySelectorAll('[data-ep-line]')
        if (!lines?.length) return false
        const last = lines[lines.length - 1]
        const opacity = Number(window.getComputedStyle(last).opacity || '0')
        return opacity > 0.85
      },
      { timeout: 5000 }
    )
  }

  const ok = await page.evaluate(() => {
    const container = document.querySelector('[data-ep-container="1"]')
    if (!container) return { ok: false, reason: 'container missing' }
    const lines = container.querySelectorAll('[data-ep-line]')
    if (!lines?.length) return { ok: false, reason: 'no lines' }
    const last = lines[lines.length - 1]
    const revealedCount = container.querySelectorAll('.pickup-tour-epilogue-line.is-in')?.length || 0
    const lastHasIsIn = last?.classList?.contains('is-in') || false
    container.scrollTop = container.scrollHeight
    const cr = container.getBoundingClientRect()
    const lr = last.getBoundingClientRect()
    const style = window.getComputedStyle(last)
    const opacity = Number(style.opacity || '0')
    const within = lr.top >= cr.top - 1 && lr.bottom <= cr.bottom + 1
    const visible = opacity > 0.5 && style.visibility !== 'hidden' && style.display !== 'none'
    return {
      ok: within && visible,
      within,
      visible,
      opacity,
      lineCount: lines.length,
      revealedCount,
      lastHasIsIn,
      cr: { top: cr.top, bottom: cr.bottom },
      lr: { top: lr.top, bottom: lr.bottom },
    }
  })

  await browser.close()

  if (!ok.ok) {
    throw new Error(`${s.name} failed: ${JSON.stringify(ok)}`)
  }
}

for (const s of scenarios) {
  await runScenario(s)
  process.stdout.write(`${s.name}: ok\n`)
}
