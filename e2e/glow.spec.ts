import { test, expect } from './fixtures'

// Round 2 (F2): Settings › Background glow off ⇒ no aura is rendered, and in
// light the cards are plain white, not frosted over a glow.
test.use({ viewport: { width: 402, height: 874 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'light'))
})

test('the Background glow switch turns the aura off and the light cards white', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.aura')).toHaveCount(1)
  const card = page.locator('main .content-card').first()
  // On: frosted, 86 % white (F5).
  await expect.poll(() => card.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(255, 255, 255, 0.86)')

  await page.goto('/settings')
  const toggle = page.getByRole('switch', { name: 'Background glow' })
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await expect(page.locator('html')).toHaveAttribute('data-glow', 'off')

  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-glow', 'off')
  await expect(page.locator('main .content-card').first()).toBeVisible()
  await expect(page.locator('.aura')).toHaveCount(0)
  expect(await page.locator('main .content-card').first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)')
})
