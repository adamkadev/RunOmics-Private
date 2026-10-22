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

// Bevel's top (owner, Oct 2026): the compact bar has no surface of its own -
// no backdrop-filter, no hairline. Liquid Glass v3 (G5): the soft scroll edge
// under it (.scroll-edge) is invisible at rest and shown while the bar is, a
// tint and no hairline. In dark, three blurs that grow stronger toward the
// top (2, 8, 20 px), reaching 30 pt past the bar's foot. In light (F21), the
// ground solid to the bar's foot, then a 24 pt fade, blurred 6 px in it only.
const EDGES = {
  dark: { blurs: ['blur(2px)', 'blur(8px)', 'blur(20px)'], shown: ['block', 'block', 'block', 'block'], fade: 30 },
  light: { blurs: ['blur(6px)'], shown: ['block', 'none', 'none', 'block'], fade: 24 },
}
for (const theme of ['light', 'dark'] as const) {
  test(`the top bar is a soft scroll edge, with no hairline (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme })
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
    await page.goto('/analytics')
    await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`))
    await page.evaluate(() => document.documentElement.style.setProperty('--safe-top', '59px'))
    const layers = () => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="scroll-edge"] > i')].map((i) => getComputedStyle(i).opacity))
    await expect.poll(layers).toEqual(['0', '0', '0', '0'])
    // Scrolled again on each poll: while its charts still load the page is too
    // short to reach 600, and the clamped scroll stops above the collapse point.
    await expect
      .poll(() =>
        page.evaluate(() => {
          window.scrollTo(0, 600)
          return document.documentElement.hasAttribute('data-bar-shown')
        }),
      )
      .toBe(true)
    await expect.poll(layers).toEqual(['1', '1', '1', '1'])
    // Polled: the edge's height eases in with a stuck strip's.
    const edge = () => page.evaluate((count) => {
      const wrapper = document.querySelector<HTMLElement>('[data-testid="scroll-edge"]')!
      const layers = [...wrapper.querySelectorAll<HTMLElement>(':scope > i')]
      const bar = document.querySelector('[data-testid="compact-title-bar"]')!.getBoundingClientRect()
      const stickyH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sticky-h')) || 0
      return {
        blurs: layers.slice(0, count).map((i) => getComputedStyle(i).backdropFilter),
        shown: layers.map((i) => getComputedStyle(i).display),
        hairline: layers.some((i) => parseFloat(getComputedStyle(i).borderBottomWidth) > 0),
        // The fade past the bar's foot, or past a stuck strip's.
        fade: Math.round(wrapper.getBoundingClientRect().bottom - bar.bottom - stickyH),
      }
    }, EDGES[theme].blurs.length)
    await expect.poll(edge).toEqual({ ...EDGES[theme], hairline: false })
    const bar = await page.evaluate(() => {
      const style = getComputedStyle(document.querySelector('[data-testid="compact-title-bar"]')!)
      return { backdrop: style.backdropFilter, border: style.borderBottomWidth, background: style.backgroundColor }
    })
    expect(bar).toEqual({ backdrop: 'none', border: '0px', background: 'rgba(0, 0, 0, 0)' })
  })
}

// F21: in light, the run's chips and the hero card's foot showed through the
// edge under the compact bar as a smudge. With the bar's own controls hidden,
// the screen from its top to the bar's foot is the page's ground, nothing else.
test('nothing shows through the light edge under the compact bar (F21)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('theme', 'light'))
  await page.goto('/activities')
  await page.locator('main a[href^="/activities/"]').first().click()
  await expect(page).toHaveURL(/\/activities\/\d+/)
  await expect(page.getByTestId('run-chips')).toBeVisible()
  await page.evaluate(() => document.documentElement.style.setProperty('--safe-top', '59px'))
  // The chips half under the bar's foot, the bar shown.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const chip = document.querySelector<HTMLElement>('[data-testid="run-chips"]')!
        window.scrollTo(0, chip.getBoundingClientRect().top + window.scrollY - (59 + 68) + 10)
        return document.documentElement.hasAttribute('data-bar-shown')
      }),
    )
    .toBe(true)
  await page.waitForTimeout(400)
  await page.addStyleTag({ content: '[data-testid="compact-title-bar"], [data-testid="compact-title-bar"] *, [data-testid^="compact-bar"], [data-testid^="compact-bar"] * { visibility: hidden !important; }' })
  const barBottom = await page.evaluate(() => Math.floor(document.querySelector('[data-testid="compact-title-bar"]')!.getBoundingClientRect().bottom))
  const shot = await page.screenshot({ clip: { x: 0, y: 0, width: 393, height: barBottom } })
  const delta = await page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const g = canvas.getContext('2d')!
    g.drawImage(img, 0, 0)
    const { data } = g.getImageData(0, 0, img.width, img.height)
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
    const want = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16))
    let max = 0
    for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) max = Math.max(max, Math.abs((data[i + c] ?? 0) - (want[c] ?? 0)))
    return max
  }, shot.toString('base64'))
  expect(delta).toBeLessThanOrEqual(1)
})
