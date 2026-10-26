import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { en } from '../src/i18n/en'

const PAGES = ['/', '/activities', '/activities?view=map', '/plan', '/plan/checkpoint', '/analytics', '/profile', '/records', '/shoes', '/consistency', '/all-time', '/goals', '/race', '/athlete']

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
      { timeout: 3_000 },
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

for (const key of ['overview', 'intervals', 'charts', 'dynamics'] as const) {
  test(`nothing runs past the screen on a run's ${en.activity.tabs[key]} tab`, async ({ page, t }) => {
    const name = t.activity.tabs[key]
    await page.goto('/activities')
    await page.getByTestId('thumb-row').first().click()
    const tabs = page.getByRole('tablist', { name: t.activity.tabs.groupLabel }).getByRole('tab')
    await expect(tabs.first()).toBeVisible()
    test.skip(!(await tabs.allTextContents()).includes(name), `the latest run has no ${name} tab`)
    await tabs.filter({ hasText: name }).click()
    expect(await overflows(page), name).toEqual([])
  })
}

for (const key of ['fitness', 'performance', 'volume', 'health'] as const) {
  test(`nothing runs past the screen on Analytics' ${en.analytics.tabs[key]} tab, in any period`, async ({ page, t }) => {
    await page.goto('/analytics')
    await page.getByRole('tab', { name: t.analytics.tabs[key] }).click()
    for (const period of ['4w', '12w', '1y']) {
      await page.getByRole('radio', { name: t.analytics.cards.period.words[period]!, exact: true }).click()
      expect(await overflows(page), `${key}, ${period}`).toEqual([])
    }
  })
}
