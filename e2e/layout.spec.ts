import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

const PAGES = ['/', '/activities', '/activities?view=map', '/plan', '/analytics', '/profile', '/records', '/shoes', '/consistency', '/all-time', '/goals', '/race', '/athlete']

async function overflows(page: Page): Promise<string[]> {
  await page
    .waitForFunction(
      () =>
        document.getAnimations().every((a) => {
          if (a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity) return true
          const target = (a.effect as KeyframeEffect | null)?.target
          return target instanceof Element && !target.checkVisibility({ contentVisibilityAuto: true })
        }),
      null,
      { timeout: 10_000 },
    )
    .catch(() => {})
  return page.evaluate(() => {
    const width = window.innerWidth
    const found: string[] = []
    if (document.documentElement.scrollWidth > width + 1) found.push(`the page scrolls sideways: ${document.documentElement.scrollWidth} > ${width}`)
    const clipOf = (el: Element): Element | null => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const x = getComputedStyle(a).overflowX
        if (x === 'auto' || x === 'scroll') return null
        if (x === 'hidden' || x === 'clip') return a
      }
      return document.documentElement
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim()
      const el = walker.currentNode.parentElement
      if (!text || !el || !el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue
      const style = getComputedStyle(el)
      if (style.position === 'absolute' && style.clip !== 'auto') continue
      const box = el.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue
      const clip = clipOf(el)
      if (!clip) continue
      const bounds = clip === document.documentElement ? { left: 0, right: width } : clip.getBoundingClientRect()
      if (box.right > bounds.right + 1 || box.left < bounds.left - 1) {
        found.push(`"${text.slice(0, 40)}" runs from ${Math.round(box.left)} to ${Math.round(box.right)}, past ${Math.round(bounds.left)}–${Math.round(bounds.right)}`)
      }
    }
    return found
  })
}

for (const path of PAGES) {
  test(`nothing runs past the screen or its card on ${path}`, async ({ page }) => {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    expect(await overflows(page)).toEqual([])
  })
}

test('nothing runs past the screen on a run, in any of its tabs', async ({ page }) => {
  test.slow()
  await page.goto('/activities')
  await page.getByTestId('thumb-row').first().click()
  const tabs = page.getByRole('tablist', { name: 'Activity sections' }).getByRole('tab')
  await expect(tabs.first()).toBeVisible()
  for (const name of await tabs.allTextContents()) {
    await tabs.filter({ hasText: name }).click()
    expect(await overflows(page), name).toEqual([])
  }
})

test('nothing runs past the screen on any Analytics tab or period', async ({ page }) => {
  test.slow()
  await page.goto('/analytics')
  for (const tab of ['Load', 'Performance', 'Volume', 'Intensity']) {
    await page.getByRole('tab', { name: tab }).click()
    for (const period of ['4 weeks', '12 weeks', 'a year']) {
      await page.getByRole('radio', { name: period }).click()
      expect(await overflows(page), `${tab}, ${period}`).toEqual([])
    }
  }
})
