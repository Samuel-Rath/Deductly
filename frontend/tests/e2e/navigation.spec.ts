import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('all nav links are reachable', async ({ page }) => {
    await page.goto('/')
    // The footer has its own navigation landmarks; scope to the main one.
    const nav = page.getByRole('navigation', { name: 'Main' })

    await nav.getByRole('link', { name: 'Rules', exact: true }).click()
    await expect(page).toHaveURL(/\/rules/)

    await nav.getByRole('link', { name: 'Privacy', exact: true }).click()
    await expect(page).toHaveURL(/\/privacy/)

    await nav.getByRole('link', { name: 'Home', exact: true }).click()
    await expect(page).toHaveURL('/')
  })

  test('direct URL navigation works for all routes', async ({ page }) => {
    for (const route of ['/', '/upload', '/rules', '/privacy', '/terms']) {
      await page.goto(route)
      await expect(page).not.toHaveURL(/404/)
      // Page should render something (not blank)
      await expect(page.locator('body')).not.toBeEmpty()
    }
  })

  test('unknown routes do not crash the app', async ({ page }) => {
    await page.goto('/does-not-exist')
    // App should still render (SPA fallback)
    await expect(page.locator('#root')).not.toBeEmpty()
  })
})

test.describe('Navigation — Mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('hamburger menu opens and shows nav links', async ({ page }) => {
    await page.goto('/')

    // Desktop nav links are hidden on mobile
    const hamburger = page.getByRole('button', { name: /open menu/i })
    await expect(hamburger).toBeVisible()
    await hamburger.click()

    // Nav links should appear in the full-screen menu
    const menu = page.locator('#mobile-menu')
    await expect(menu.getByRole('link', { name: 'Rules', exact: true })).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Privacy', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /close menu/i })).toBeVisible()
  })

  test('hamburger menu closes after navigation', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /open menu/i }).click()
    await page.locator('#mobile-menu').getByRole('link', { name: 'Rules', exact: true }).click()

    await expect(page).toHaveURL(/\/rules/)
    // Menu should be closed — hamburger button back to open state
    await expect(page.getByRole('button', { name: /open menu/i })).toBeVisible()
    await expect(page.locator('#mobile-menu')).toHaveCount(0)
  })
})
