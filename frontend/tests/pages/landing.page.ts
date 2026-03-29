import { type Page, type Locator, expect } from '@playwright/test'

export class LandingPage {
  readonly page: Page
  readonly heading: Locator
  readonly subheading: Locator
  readonly ctaButton: Locator
  readonly trustBadges: Locator
  readonly nav: Locator
  readonly navGetStarted: Locator

  constructor(page: Page) {
    this.page = page
    this.heading    = page.getByRole('heading', { level: 1 })
    this.subheading = page.getByText(/instantly uncover every work-related deduction/i)
    this.ctaButton  = page.getByRole('button', { name: /find my deductions/i })
    this.trustBadges = page.getByText(/no data stored|ato-aligned|instant analysis/i)
    this.nav         = page.getByRole('navigation')
    this.navGetStarted = page.getByRole('link', { name: /get started/i })
  }

  async goto() {
    await this.page.goto('/')
  }

  async clickCTA() {
    await this.ctaButton.click()
    await this.page.waitForURL('**/upload')
  }

  async expectVisible() {
    await expect(this.heading).toContainText('Find Every Tax Deduction')
    await expect(this.ctaButton).toBeVisible()
  }
}
