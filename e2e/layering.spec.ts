import { test, expect } from './fixtures'

// Runs after the page transition: the stacking context that animation adds while it plays can hide a layering problem.
for (const route of ['/', '/activities', '/plan', '/analytics', '/profile']) {
  test(`${route} draws its text on top, on a flat background`, async ({ page }) => {
    await page.goto(route)
    // The wrapper drops its class once the animation ends.
    await page.waitForFunction(() => {
      const wrapper = document.querySelector('main .animate-fade-up')
      return wrapper === null || wrapper.getAnimations().length === 0
    })

    const covered = await page.evaluate(() => {
      const main = document.querySelector('main')!
      const hidden: string[] = []
      for (const el of main.querySelectorAll('*')) {
        const hasText = [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
        if (!hasText) continue
        const box = el.getBoundingClientRect()
        const y = box.top + box.height / 2
        // Clear of the fixed top scrim and the tab bar, which sit over the page on purpose.
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
    expect(surface.token).toMatch(/^#(0c0d0d|f3f4f3)$/)
  })
}

// iOS 26 draws its own blur over the page top unless WebKit finds a solid, full-width fixed box over 10 px tall
// 4 px inside the top edge, so only the shell's edge sampler and soft scroll edge may touch it.
// A desktop browser has no safe area, so the test gives it a 59 pt one, as on a 16-series phone.
test.describe('on a phone', () => {
  // The top bars are phone-only (lg:hidden).
  test.use({ viewport: { width: 393, height: 852 } })

  for (const route of ['/', '/plan', '/analytics']) {
    test(`${route} lets only the shell's top bars touch the top edge`, async ({ page }) => {
      await page.goto(route)
      await page.evaluate(() => document.documentElement.style.setProperty('--safe-top', '59px'))
      for (const y of [0, 600]) {
        await page.evaluate((top) => window.scrollTo(0, top), y)
        await page.waitForTimeout(300)
        const barShown = await page.evaluate(() => document.documentElement.hasAttribute('data-bar-shown'))
        const atTop = await page.evaluate(() => {
          const alpha = (color: string) => {
            if (color === 'transparent') return 0
            const parts = color.match(/[\d.]+/g) ?? []
            return parts.length === 4 ? Number(parts[3]) : 1
          }
          return [...document.querySelectorAll<HTMLElement>('body *')]
            .filter((el) => {
              const style = getComputedStyle(el)
              const box = el.getBoundingClientRect()
              return style.position === 'fixed' && style.display !== 'none' && box.top <= 0 && box.bottom > 0 && box.height > 0
            })
            .map((el) => {
              const style = getComputedStyle(el)
              return {
                id: el.dataset.testid ?? el.className.slice(0, 60),
                height: Math.round(el.getBoundingClientRect().height),
                opaque: Number(style.opacity) === 1 && alpha(style.backgroundColor) === 1,
              }
            })
        })
        // The edge sampler is the safe area + 12 pt, solid in every state; the soft scroll edge has no background.
        expect(atTop.map(({ id }) => id).sort(), `scrolled to ${y}`).toEqual(['edge-sampler', 'scroll-edge'])
        expect(atTop.find((el) => el.id === 'edge-sampler'), `scrolled to ${y}`).toEqual({ id: 'edge-sampler', height: 71, opaque: true })
        expect(atTop.find((el) => el.id === 'scroll-edge')?.opaque, `scrolled to ${y}`).toBe(false)
        // What WebKit samples 4 px in, at the top centre: the solid sampler.
        expect(await page.evaluate(() => (document.elementFromPoint(innerWidth / 2, 4) as HTMLElement | null)?.dataset.testid)).toBe('edge-sampler')
        expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="edge-sampler"]')!).backgroundColor)).toBe(
          await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
        )
        if (y === 0) expect(barShown).toBe(false)
      }
      // 68 pt: the sampler's 12, the 46 pt row, then 10 pt to the hairline.
      if (route === '/analytics') {
        const bar = await page.getByTestId('compact-title-bar').boundingBox()
        expect(bar?.y).toBe(59)
        expect(bar?.height).toBe(68)
      }
    })
  }
})
