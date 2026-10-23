import { test, expect } from './fixtures'

// The tab bar shrinks to its pill only as the page scrolls down; the insets are a Face ID phone's.
test.use({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })

for (const theme of ['light', 'dark'] as const) {
  test(`the last card clears the tab pill at scroll end, on every activity tab (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 59, bottom: 34, left: 0, right: 0 } })
    await page.goto('/activities')
    await page.locator('main a[href^="/activities/"]').first().click()
    await expect(page).toHaveURL(/\/activities\/\d+/)
    const tabs = page.getByTestId('sticky-bar').getByRole('tab')
    await expect(tabs.first()).toBeVisible()
    const count = await tabs.count()
    for (let i = 0; i < count; i++) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await tabs.nth(i).click()
      // Instant, as a smooth scroll is measured mid-way; from 200 pt short of the end, so a scroll down shrinks the bar.
      const gap = () =>
        page.evaluate(async () => {
          const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
          const end = document.documentElement.scrollHeight - window.innerHeight
          window.scrollTo({ top: Math.max(0, end - 200), behavior: 'instant' })
          await frame()
          window.scrollTo({ top: end, behavior: 'instant' })
          await frame()
          const pill = document.querySelector('[data-testid="tab-bar-capsule"]')!
          if (!pill.hasAttribute('data-collapsed')) return null
          const card = [...document.querySelectorAll('main nav')].pop()!.getBoundingClientRect()
          return Math.round(pill.getBoundingClientRect().top - card.bottom)
        })
      await expect.poll(gap, { message: `tab ${i}` }).not.toBeNull()
      expect(await gap(), `tab ${i}`).toBeGreaterThanOrEqual(24)
    }
  })
}
