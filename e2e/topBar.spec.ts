import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

// v4.3.3: scrolled to its midpoint, no page shows text under the top bar -
// the compact title bar when it shows, the status-bar strip when it doesn't.
// Every piece of text that reaches into that band must be hidden by the bar
// (or a sticky tab strip under it), or faded out.
test.use({ viewport: { width: 393, height: 852 } })

async function textUnderTheBar(page: Page): Promise<string[]> {
  // A phone's safe area (v4.8): the status strip is exactly that tall, and
  // the compact bar starts under it. A desktop browser has none.
  await page.evaluate(() => document.documentElement.style.setProperty('--safe-top', '59px'))
  // After the page transition, as the layering spec does: scrolled while the
  // page still animated in, the midpoint was taken from a shorter page and
  // the text sampled while it was still moving.
  await page.waitForFunction(() => {
    const wrapper = document.querySelector('main .animate-fade-up')
    return !wrapper || wrapper.getAnimations().length === 0
  })
  // And once the page stops growing, so the midpoint is the page's own.
  let height = -1
  await expect
    .poll(async () => {
      const now = await page.evaluate(() => document.documentElement.scrollHeight)
      const steady = now === height
      height = now
      return steady
    }, { intervals: [150] })
    .toBe(true)
  await page.evaluate(() => {
    const mid = (document.documentElement.scrollHeight - innerHeight) / 2
    window.scrollTo(0, Math.max(0, mid))
  })
  await page.waitForTimeout(400)
  return page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>('[data-testid="compact-title-bar"]')
    const shown = bar !== null && getComputedStyle(bar).display !== 'none'
    const strip = document.querySelector<HTMLElement>('[data-testid="edge-sampler"]')!
    const band = shown ? bar!.getBoundingClientRect().bottom : strip.getBoundingClientRect().bottom
    const main = document.querySelector('main')!
    const leaks: string[] = []
    // The bars take no taps (pointer-events: none), which would let
    // elementFromPoint see straight through them: count them as painted.
    const fixed = [...document.querySelectorAll<HTMLElement>('body *')].filter((el) => getComputedStyle(el).position === 'fixed')
    const before = fixed.map((el) => el.style.pointerEvents)
    for (const el of fixed) el.style.pointerEvents = 'auto'
    for (const el of main.querySelectorAll<HTMLElement>('*')) {
      const hasText = [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
      if (!hasText) continue
      const box = el.getBoundingClientRect()
      if (box.width === 0 || box.bottom <= 0 || box.top >= band) continue
      let faded = false
      for (let node: HTMLElement | null = el; node && node !== main; node = node.parentElement) {
        if (Number(getComputedStyle(node).opacity) === 0) faded = true
      }
      if (faded) continue
      // Sample the text's part inside the band, top and bottom - both inside
      // it: a text box starting 1 px above the band's foot sampled its top
      // at top + 1, the first pixel under the bar, and read as a leak there.
      for (const y of [Math.min(Math.max(box.top, 0) + 1, band - 1), Math.min(box.bottom, band) - 1]) {
        const hit = document.elementFromPoint(box.left + Math.min(box.width / 2, 20), y)
        if (hit && main.contains(hit) && !hit.closest('[data-testid="sticky-bar"]')) {
          leaks.push(el.textContent!.trim().slice(0, 40))
          break
        }
      }
    }
    // The large title's subtitle is gone by the time it reaches the divider:
    // straddling it, it would show clipped glyphs under the bar.
    const heading = main.querySelector('h1')
    const subtitle = heading?.nextElementSibling
    if (shown && subtitle instanceof HTMLElement && subtitle.tagName === 'P') {
      const box = subtitle.getBoundingClientRect()
      if (box.top < band && box.bottom > band && Number(getComputedStyle(subtitle).opacity) > 0.05) {
        leaks.push(`subtitle: ${subtitle.textContent!.trim().slice(0, 40)}`)
      }
    }
    fixed.forEach((el, i) => (el.style.pointerEvents = before[i]!))
    return leaks
  })
}

for (const route of ['/', '/activities', '/plan', '/analytics', '/profile']) {
  test(`${route} shows no text under the top bar at its midpoint`, async ({ page }) => {
    await page.goto(route)
    await expect(page.locator('main h1, main')).not.toHaveCount(0)
    expect(await textUnderTheBar(page)).toEqual([])
  })
}

test('each activity tab shows no text under the top bar at its midpoint', async ({ page }) => {
  await page.goto('/activities')
  const firstCard = page.locator('a[href^="/activities/"]').first()
  await expect(async () => {
    if (new URL(page.url()).pathname === '/activities') await firstCard.click()
    await expect(page).toHaveURL(/\/activities\/\d+/, { timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  await expect(page.locator('h1')).toBeVisible()

  // The subtitle at the divider: scrolled until the bar has collapsed in and
  // the subtitle reaches its divider. The title sits under the map hero
  // (3.0), its type and date line above it, so the sweep is around the title.
  const titleTop = await page.evaluate(() => document.querySelector('main h1')!.getBoundingClientRect().top + window.scrollY)
  for (const y of [-24, -8, 8, 24].map((d) => Math.max(0, Math.round(titleTop - 110 + d)))) {
    await page.evaluate((top) => window.scrollTo(0, top), y)
    await page.waitForTimeout(200)
    const straddling = await page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>('[data-testid="compact-title-bar"]')!
      if (getComputedStyle(bar).display === 'none') return null
      const band = bar.getBoundingClientRect().bottom
      const subtitle = document.querySelector<HTMLElement>('main [data-title-sub]')!
      const box = subtitle.getBoundingClientRect()
      return box.top < band && box.bottom > band ? Number(getComputedStyle(subtitle).opacity) : 0
    })
    if (straddling !== null) expect(straddling, `subtitle opacity at scroll ${y}`).toBeLessThan(0.05)
  }

  const tabs = page.getByTestId('sticky-bar').getByRole('tab')
  const count = await tabs.count()
  for (let i = 0; i < Math.max(1, count); i++) {
    if (count > 0) {
      await page.evaluate(() => window.scrollTo(0, 0))
      await tabs.nth(i).click()
    }
    expect(await textUnderTheBar(page), `tab ${i}`).toEqual([])
  }
})

// Liquid Glass v2 (owner's brief, Oct 2026): the compact bar has no surface -
// no backdrop-filter, no hairline - and the soft scroll edge under it is
// invisible at rest and shown while the bar is.
test('the top bar is the soft scroll edge, not a slab', async ({ page }) => {
  await page.goto('/analytics')
  await page.evaluate(() => document.documentElement.style.setProperty('--safe-top', '59px'))
  const layers = () => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="scroll-edge"] > i')].map((i) => getComputedStyle(i).opacity))
  await expect.poll(layers).toEqual(['0', '0', '0', '0', '0'])
  await page.evaluate(() => window.scrollTo(0, 600))
  await expect.poll(() => page.evaluate(() => document.documentElement.hasAttribute('data-bar-shown'))).toBe(true)
  await expect.poll(layers).toEqual(['1', '1', '1', '1', '1'])
  const bar = await page.evaluate(() => {
    const style = getComputedStyle(document.querySelector('[data-testid="compact-title-bar"]')!)
    return { backdrop: style.backdropFilter, border: style.borderBottomWidth, background: style.backgroundColor }
  })
  expect(bar).toEqual({ backdrop: 'none', border: '0px', background: 'rgba(0, 0, 0, 0)' })
})
