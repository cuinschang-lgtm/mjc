import { chromium } from 'playwright'

const baseURL = process.env.BASE_URL || 'http://localhost:3000'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto(`${baseURL}/__dev/tag-editor`, { waitUntil: 'networkidle' })

  const input = page.locator('input[placeholder="Add a tag…"], input')
  await input.click()

  await input.fill('  #Lo-Fi!!!  ')
  await input.press('Enter')
  await page.waitForTimeout(200)
  assert((await page.locator('text=#Lo-Fi').count()) === 0, 'should not include # in tag')
  assert((await page.locator('text=Lo-Fi').count()) > 0, 'should add sanitized tag')

  await input.fill('lo-fi')
  await input.press('Enter')
  await page.waitForTimeout(200)
  const dupError = await page.locator('text=标签重复').count()
  assert(dupError > 0, 'should block duplicates (case-insensitive)')

  const removeButtons = page.locator('button[aria-label^="Remove tag"]')
  const before = await removeButtons.count()
  await removeButtons.first().click()
  await page.waitForTimeout(250)
  const after = await page.locator('button[aria-label^="Remove tag"]').count()
  assert(after === before - 1, 'should remove a tag')

  await browser.close()
  console.log('TagEditor smoke test passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

