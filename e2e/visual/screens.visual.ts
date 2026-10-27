import type { Locator, Page } from '@playwright/test'
import type { Strings } from '../../src/i18n/en'
import { test, expect } from '../fixtures'
import { FIXED_NOW } from './fixedNow'

const FREEZE = `*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }`

/** A run's place comes from OpenStreetMap when the runner can reach it, and late or not at all when it cannot. */
const offline = (page: Page) => page.context().route(/^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/])/, (route) => route.abort())

test.beforeEach(async ({ page, colorScheme }) => {
  await offline(page)
  await page.clock.setFixedTime(new Date(FIXED_NOW))
  await page.addInitScript((theme) => {
    try {
      localStorage.setItem('theme', theme)
    } catch {}
  }, colorScheme === 'dark' ? 'dark' : 'light')
})

async function open(page: Page, url: string, ready: Locator): Promise<void> {
  await page.goto(url)
  await expect(ready).toBeVisible()
  await page.addStyleTag({ content: FREEZE })
  await page.evaluate(() => document.fonts.ready)
}

/** WebGL draws a map a little differently from one run to the next, and the e2e build's maps are blank anyway. */
const maps = (page: Page) => [page.locator('canvas.maplibregl-canvas')]

/** The latest run that `has` something: the data is the fixed day's, so it is the same run every time. */
async function latestRunWith(page: Page, t: Strings, has: (page: Page) => Locator): Promise<string | null> {
  await page.goto('/activities')
  await expect(page.locator('main a[href^="/activities/"]').first()).toBeVisible()
  const hrefs = await page.locator('main a[href^="/activities/"]').evaluateAll((links) => links.map((a) => a.getAttribute('href')!))
  for (const href of hrefs.slice(0, 15)) {
    await page.goto(href)
    await expect(page.getByRole('tab', { name: t.activity.tabs.overview })).toBeVisible()
    if ((await has(page).count()) > 0) return href
  }
  return null
}

const chartsTab = (t: Strings) => (page: Page) => page.getByRole('tab', { name: t.activity.tabs.charts })

/** The folded Same route row, which reads either as the route's best or as the gap to it. */
const sameRouteRow = (t: Strings) => (page: Page) =>
  page.getByRole('button', { expanded: false }).filter({ hasText: new RegExp(`${t.activity.similarRuns.rowBest}|s/km vs`) })

test('Today', async ({ page }) => {
  await open(page, '/', page.getByTestId('readiness-card'))
  await expect(page).toHaveScreenshot('today.png', { mask: maps(page) })
})

test('Analytics, Load', async ({ page, t }) => {
  await open(page, '/analytics?tab=fitness', page.getByRole('tab', { name: t.analytics.tabs.fitness, selected: true }))
  await expect(page).toHaveScreenshot('analytics-load.png')
})

test('Analytics, Performance', async ({ page, t }) => {
  await open(page, '/analytics?tab=performance', page.getByRole('tab', { name: t.analytics.tabs.performance, selected: true }))
  await expect(page).toHaveScreenshot('analytics-performance.png')
})

test('Activities, this week', async ({ page }) => {
  await open(page, '/activities', page.getByTestId('thumb-row').first())
  await expect(page).toHaveScreenshot('activities.png', { mask: maps(page) })
})

test('Plan, this week', async ({ page }) => {
  await open(page, '/plan', page.getByTestId('day-selector'))
  await expect(page).toHaveScreenshot('plan-week.png')
})

test('a run, Charts', async ({ page, t }) => {
  const href = await latestRunWith(page, t, chartsTab(t))
  expect(href, 'a run with a Charts tab among the latest fifteen').not.toBeNull()
  await open(page, `${href}?tab=charts`, page.getByRole('tab', { name: t.activity.tabs.charts, selected: true }))
  await expect(page.getByTestId('chart-stack')).toBeVisible()
  await expect(page).toHaveScreenshot('run-charts.png', { fullPage: true, mask: maps(page) })
})

test('a run, Same route', async ({ page, t }) => {
  const href = await latestRunWith(page, t, sameRouteRow(t))
  test.skip(href === null, 'no run among the latest fifteen repeats a route')
  await page.addStyleTag({ content: FREEZE })
  await sameRouteRow(t)(page).first().click()
  const card = page.locator('section').filter({ has: page.getByRole('button', { expanded: true }) }).first()
  await expect(card.locator('svg.recharts-surface').first()).toBeVisible()
  await expect(card).toHaveScreenshot('run-same-route.png')
})

test.describe('the share card at the phone’s 3x', () => {
  test.use({ deviceScaleFactor: 3 })

  test('share card', async ({ page, t }, testInfo) => {
    test.skip(!testInfo.project.name.endsWith('light'), 'the card draws the same in either theme')
    const href = await latestRunWith(page, t, chartsTab(t))
    expect(href, 'a run with a Charts tab among the latest fifteen').not.toBeNull()
    await open(page, href!, page.getByRole('button', { name: t.activity.share }))
    await page.getByRole('button', { name: t.activity.share }).click()
    const preview = page.getByTestId('share-preview')
    await expect(preview.locator('canvas')).toBeVisible()
    await expect(preview).toHaveScreenshot('share-card.png', { scale: 'device' })
  })
})
