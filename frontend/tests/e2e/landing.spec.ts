import { test, expect } from '@playwright/test'
import { LandingPage } from '../pages/landing.page'

test.describe('Landing Page', () => {
  test('shows headline, CTA and trust signals', async ({ page }) => {
    const landing = new LandingPage(page)
    await landing.goto()

    await expect(landing.heading).toContainText('Find Every Tax Deduction')
    await expect(landing.ctaButton).toBeVisible()
    await expect(page.getByText(/no data stored/i)).toBeVisible()
    await expect(page.getByText(/ato-aligned/i)).toBeVisible()
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
    await landing.navGetStarted.click()
    await expect(page).toHaveURL(/\/upload/)
  })

  test('page title is Deductly', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('Deductly')
  })

  test('features section is visible after scroll', async ({ page }) => {
    await page.goto('/')
    await page.getByText(/everything you need for tax time/i).scrollIntoViewIfNeeded()
    await expect(page.getByText(/privacy first/i)).toBeVisible()
    await expect(page.getByText(/ai-grounded/i)).toBeVisible()
    await expect(page.getByText(/confidence scores/i)).toBeVisible()
    await expect(page.getByText(/ato citations/i)).toBeVisible()
  })

  test('how it works steps are visible', async ({ page }) => {
    await page.goto('/')
    await page.getByText(/how it works/i).first().scrollIntoViewIfNeeded()
    await expect(page.getByText(/upload your statement/i)).toBeVisible()
    await expect(page.getByText(/ai analyses transactions/i)).toBeVisible()
    await expect(page.getByText(/download your report/i)).toBeVisible()
  })

  test('bottom CTA section is reachable', async ({ page }) => {
    await page.goto('/')
    await page.getByText(/ready to find your deductions/i).scrollIntoViewIfNeeded()
    await expect(page.getByText(/ready to find your deductions/i)).toBeVisible()
  })
})
