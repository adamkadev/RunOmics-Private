import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

test.use({ viewport: { width: 393, height: 852 } })

async function textUnderTheBar(page: Page): Promise<string[]> {
  // A phone's safe area; a desktop browser has none.
  await page.evaluate(() => document.documentElement.style.setProperty('--safe-top', '59px'))
  // After the page transition: scrolled while the page still animates in, the midpoint comes from a shorter page.
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
      // Both samples inside the band: a box starting 1 px above the band's foot would sample under the bar.
      for (const y of [Math.min(Math.max(box.top, 0) + 1, band - 1), Math.min(box.bottom, band) - 1]) {
        const hit = document.elementFromPoint(box.left + Math.min(box.width / 2, 20), y)
        if (hit && main.contains(hit) && !hit.closest('[data-testid="sticky-bar"]')) {
          leaks.push(el.textContent!.trim().slice(0, 40))
          break
        }
      }
    }
    // Straddling the divider, the large title's subtitle would show clipped glyphs under the bar.
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

  // Swept around the title, where the subtitle reaches its divider once the bar has collapsed in.
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

const EDGES = {
  dark: { blurs: ['blur(2px)', 'blur(8px)', 'blur(20px)'], shown: ['block', 'block', 'block', 'block'], fade: 30 },
  light: { blurs: ['blur(6px)'], shown: ['block', 'none', 'none', 'block'], fade: 24 },
}
for (const theme of ['light', 'dark'] as const) {
  test(`the top bar is a soft scroll edge, with no hairline (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme })
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
    // A page with no glass strip to stick, which would give dark the light edge.
    await page.goto('/activities')
    await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`))
    await page.evaluate(() => document.documentElement.style.setProperty('--safe-top', '59px'))
    const layers = () => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="scroll-edge"] > i')].map((i) => getComputedStyle(i).opacity))
    await expect.poll(layers).toEqual(['0', '0', '0', '0'])
    // Scrolled again on each poll: while its charts load, the page is too short to reach 600.
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
      const stickyH = parseFloat(getComputedStyle(wrapper).getPropertyValue('--sticky-h')) || 0
      return {
        blurs: layers.slice(0, count).map((i) => getComputedStyle(i).backdropFilter),
        shown: layers.map((i) => getComputedStyle(i).display),
        hairline: layers.some((i) => parseFloat(getComputedStyle(i).borderBottomWidth) > 0),
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

for (const theme of ['light', 'dark'] as const) {
  test(`a stuck activity strip is glass over the rows, not over the edge (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
    await page.goto('/activities')
    await page.locator('main a[href^="/activities/"]').first().click()
    await expect(page).toHaveURL(/\/activities\/\d+/)
    await expect(page.getByTestId('sticky-bar')).toBeVisible()
    await page.evaluate(() => document.documentElement.style.setProperty('--safe-top', '59px'))
    const tabs = page.getByTestId('sticky-bar').getByRole('tablist')
    await expect
      .poll(() =>
        page.evaluate(() => {
          const strip = document.querySelector<HTMLElement>('[data-testid="sticky-bar"]')!
          const pinned = strip.getBoundingClientRect().top + window.scrollY - (59 + 68)
          window.scrollTo(0, pinned + 160)
          return strip.querySelector('[role="tablist"]')!.getAttribute('data-variant')
        }),
      )
      .toBe('glass')
    await expect(tabs).toHaveClass(/\blg-stuck-in\b/)
    const under = () => page.evaluate(() => {
      const edge = document.querySelector<HTMLElement>('[data-testid="scroll-edge"]')!.getBoundingClientRect()
      const bar = document.querySelector<HTMLElement>('[data-testid="compact-title-bar"]')!.getBoundingClientRect()
      const list = document.querySelector<HTMLElement>('[data-testid="sticky-bar"] [role="tablist"]')!.getBoundingClientRect()
      const below = document.elementsFromPoint(list.left + 8, list.bottom - 4)
      return {
        edgeFade: Math.round(edge.bottom - bar.bottom),
        stickyH: getComputedStyle(document.documentElement).getPropertyValue('--sticky-h'),
        content: below.some((el) => el.closest('[data-testid="activity-panel"]') !== null),
      }
    })
    await expect.poll(under).toEqual({ edgeFade: 24, stickyH: '', content: true })
  })
}
