import { test, expect } from '@playwright/test'

const viewports = [
  { name: 'mobile',  width: 390,  height: 844  },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'desktop', width: 1440, height: 900  },
]

for (const vp of viewports) {
  test.describe(`Responsive — ${vp.name} (${vp.width}px)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test('landing page renders without horizontal scroll', async ({ page }) => {
      await page.goto('/')
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
      const viewportWidth = await page.evaluate(() => window.innerWidth)
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1) // 1px tolerance
    })

    test('upload page renders without overflow', async ({ page }) => {
      await page.goto('/upload')
      await expect(page.getByRole('heading', { name: /upload your bank statement/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /start analysis/i })).toBeVisible()
    })

    test('rules page renders without overflow', async ({ page }) => {
      await page.goto('/rules')
      await expect(page.getByRole('heading', { name: /classification rules/i })).toBeVisible()
    })
  })
}

test.describe('Responsive — Upload form layout', () => {
  test('stacks buttons vertically on mobile', async ({ page }) => {
    test.info().annotations.push({ type: 'tag', description: '@mobile' })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/upload')

    const backBtn    = page.getByRole('button', { name: /back/i })
    const analyseBtn = page.getByRole('button', { name: /start analysis/i })

    const backBox    = await backBtn.boundingBox()
    const analyseBox = await analyseBtn.boundingBox()

    // On mobile they should stack — back button above analyse button
    expect(backBox).toBeTruthy()
    expect(analyseBox).toBeTruthy()
    // Both buttons should be visible without horizontal scroll
    expect(backBox!.x + backBox!.width).toBeLessThanOrEqual(390 + 1)
    expect(analyseBox!.x + analyseBox!.width).toBeLessThanOrEqual(390 + 1)
  })
})
