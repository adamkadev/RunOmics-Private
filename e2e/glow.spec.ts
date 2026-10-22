import { test, expect } from './fixtures'

// Round 2 (F2): Settings › Background glow off ⇒ no aura is rendered, and in
// light the cards are plain white, not 88 % white over a glow.
test.use({ viewport: { width: 402, height: 874 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'light'))
})

test('the Background glow switch turns the aura off and the light cards white', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.aura')).toHaveCount(1)
  const card = page.locator('main .content-card').first()
  // On: 88 % white, never blurred (D1), so the glow tints it a little.
  await expect.poll(() => card.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(255, 255, 255, 0.88)')
  expect(await card.evaluate((el) => getComputedStyle(el).backdropFilter)).toBe('none')

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

// F17: Shoes and a shoe's page (Compare is a section of Shoes) were the one
// Progress family on the flat ground. They take the aura in both themes, and
// the glow switch still turns it off.
for (const theme of ['light', 'dark'] as const) {
  test(`Shoes and a shoe's page have the glow, off with the switch (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
    await page.goto('/shoes')
    await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`))
    await expect(page.locator('.aura')).toHaveCount(1)
    await expect(page.getByTestId('aura')).toHaveAttribute('style', /--aura-1:\s*var\(--warn\);\s*--aura-2:\s*var\(--accent\)/)
    const shoe = await page.locator('main a[href^="/shoes/"]').first().getAttribute('href')
    await page.goto(shoe!)
    await expect(page.locator('.aura')).toHaveCount(1)

    await page.evaluate(() => localStorage.setItem('ro-glow', 'off'))
    for (const url of ['/shoes', shoe!]) {
      await page.goto(url)
      await expect(page.locator('html')).toHaveAttribute('data-glow', 'off')
      await expect(page.locator('main h1').first()).toBeVisible()
      await expect(page.locator('.aura')).toHaveCount(0)
    }
  })
}
