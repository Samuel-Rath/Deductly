import { test, expect } from '@playwright/test'
import { LandingPage } from '../pages/landing.page'

test.describe('Landing Page', () => {
  test('shows headline, CTA and trust signals', async ({ page }) => {
    const landing = new LandingPage(page)
    await landing.goto()

    await expect(landing.heading).toContainText(/find every tax deduction/i)
    await expect(landing.ctaButton).toBeVisible()
    await expect(page.getByText(/no data stored/i)).toBeVisible()
    await expect(page.getByText(/ato aligned/i)).toBeVisible()
    await expect(page.getByText(/instant analysis/i)).toBeVisible()
  })

  test('CTA button navigates to upload', async ({ page }) => {
    const landing = new LandingPage(page)
    await landing.goto()
    await landing.clickCTA()
    await expect(page).toHaveURL(/\/upload/)
  })

  test('nav Get Started link navigates to upload', async ({ page }) => {
    const landing = new LandingPage(page)
    await landing.goto()
    // Multiple "Get Started" links (desktop + mobile) — use first.
    await landing.navGetStarted.first().click()
    await expect(page).toHaveURL(/\/upload/)
  })

  test('page title is Deductly', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Deductly/)
  })

  test('features section is visible after scroll', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('heading', { name: /built like an accountant/i }).scrollIntoViewIfNeeded()
    // Target feature titles via heading role — some of these terms also appear
    // inline in hero copy, so a plain getByText would hit strict-mode conflicts.
    for (const name of [/privacy first/i, /ato rule engine/i, /confidence scores/i, /evidence checklists/i]) {
      const heading = page.getByRole('heading', { name })
      // Centre it: rows reveal once they are 15% up the viewport, and
      // scrollIntoViewIfNeeded is a no-op for a row peeking in at the bottom edge.
      await heading.evaluate((el) => el.scrollIntoView({ block: 'center' }))
      // Rows fade in on scroll; wait for the reveal to finish, not just for layout.
      await expect(heading).toHaveCSS('opacity', '1')
    }
  })

  test('how it works steps are visible', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('heading', { name: /how it works/i }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('heading', { name: /upload your statement/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /rules engine analyses transactions/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /download your report/i })).toBeVisible()
  })

  test('bottom CTA section is reachable', async ({ page }) => {
    await page.goto('/')
    const closing = page.getByRole('heading', { name: /your statement already knows/i })
    await closing.scrollIntoViewIfNeeded()
    await expect(closing).toBeVisible()
    // The closing section has its own CTA (second on the page)
    await expect(page.getByRole('button', { name: /find my deductions/i }).last()).toBeVisible()
  })
})
