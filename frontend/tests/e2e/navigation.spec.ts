import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('all nav links are reachable', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('navigation').getByRole('link', { name: 'Rules' }).click()
    await expect(page).toHaveURL(/\/rules/)

    await page.getByRole('navigation').getByRole('link', { name: 'Privacy' }).click()
    await expect(page).toHaveURL(/\/privacy/)

    await page.getByRole('navigation').getByRole('link', { name: 'Home' }).click()
    await expect(page).toHaveURL('/')
  })

  test('direct URL navigation works for all routes', async ({ page }) => {
    for (const route of ['/', '/upload', '/rules', '/privacy']) {
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

    // Nav links should appear in dropdown
    await expect(page.getByRole('link', { name: 'Rules' }).last()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Privacy' }).last()).toBeVisible()
  })

  test('hamburger menu closes after navigation', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('link', { name: 'Rules' }).last().click()

    await expect(page).toHaveURL(/\/rules/)
    // Menu should be closed — hamburger button back to open state
    await expect(page.getByRole('button', { name: /open menu/i })).toBeVisible()
  })
})
