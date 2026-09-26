import { test, expect } from './fixtures'

// The page is one flat colour (neutral surfaces): no background layer between
// <body> and the page. This asks the browser what is on top at the centre of
// every piece of text in the page - it must be the page itself - and that the
// body paints the theme's flat background, with no gradient. It runs after
// the page transition, because the stacking context that animation adds
// while it plays once hid a layering problem.
for (const route of ['/', '/activities', '/plan', '/analytics', '/profile']) {
  test(`${route} draws its text on top, on a flat background`, async ({ page }) => {
    await page.goto(route)
    await page.waitForFunction(() => {
      const wrapper = document.querySelector('main .animate-fade-up')
      return wrapper !== null && wrapper.getAnimations().length === 0
    })

    const covered = await page.evaluate(() => {
      const main = document.querySelector('main')!
      const hidden: string[] = []
      for (const el of main.querySelectorAll('*')) {
        const hasText = [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
        if (!hasText) continue
        const box = el.getBoundingClientRect()
        const y = box.top + box.height / 2
        // Clear of the fixed top scrim and the tab bar, which sit over the
        // page on purpose while it scrolls.
        if (box.width === 0 || y < 80 || y > innerHeight - 120) continue
        const hit = document.elementFromPoint(box.left + box.width / 2, y)
        if (hit && !main.contains(hit)) hidden.push(el.textContent!.trim().slice(0, 40))
      }
      return hidden
    })
    expect(covered).toEqual([])

    const surface = await page.evaluate(() => {
      const body = getComputedStyle(document.body)
      return {
        image: body.backgroundImage,
        color: body.backgroundColor,
        token: getComputedStyle(document.documentElement).getPropertyValue('--background').trim(),
        aurora: document.querySelector('.aurora') !== null,
      }
    })
    expect(surface.aurora).toBe(false)
    expect(surface.image).toBe('none')
    expect(surface.token).toMatch(/^#(0a0b0b|f4f5f4)$/)
  })
}
