import type { Locator } from '@playwright/test'
import { test, expect } from './fixtures'

// Desktop Chrome runs with motion, so a box measured while the sheet still rises is not where the pointer lands.
async function settledBox(target: Locator) {
  await expect(target).toBeVisible()
  await target.page().waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
  )
  return (await target.boundingBox())!
}

async function touchSwipe(target: Locator, dx: number) {
  const box = await settledBox(target)
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  const at = (clientX: number) => [{ identifier: 1, clientX, clientY: y + 4 }]
  await target.dispatchEvent('touchstart', { touches: at(x), changedTouches: at(x) })
  await target.dispatchEvent('touchmove', { touches: at(x + dx / 2), changedTouches: at(x + dx / 2) })
  await target.dispatchEvent('touchend', { touches: [], changedTouches: at(x + dx) })
}

async function mouseSwipe(target: Locator, dx: number) {
  const box = await settledBox(target)
  const page = target.page()
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx / 2, y, { steps: 4 })
  await page.mouse.move(x + dx, y + 4, { steps: 4 })
  await page.mouse.up()
}

const swipe = (isMobile: boolean) => (isMobile ? touchSwipe : mouseSwipe)

test('a horizontal swipe pages the Consistency week sheet\'s month, and stops at this month', async ({ page, t, isMobile }) => {
  await page.goto('/consistency')
  await page.getByTestId('week-column').last().click()
  const calendar = page.getByTestId('week-calendar')
  await expect(calendar).toBeVisible()
  const month = (await calendar.getAttribute('data-month'))!
  await expect(calendar.locator('[data-selected]')).toHaveCount(1)

  await swipe(isMobile)(calendar, 120)
  await expect(calendar).not.toHaveAttribute('data-month', month)
  await expect(page.getByTestId('week-sheet')).toBeVisible()

  await swipe(isMobile)(calendar, -120)
  await expect(calendar).toHaveAttribute('data-month', month)
  await expect(calendar.locator('[data-selected]')).toHaveCount(1)

  const next = page.getByRole('button', { name: t.consistency.sheet.nextMonth })
  if (await next.isEnabled()) await next.click()
  await expect(next).toBeDisabled()
  const last = (await calendar.getAttribute('data-month'))!
  await swipe(isMobile)(calendar, -120)
  await expect(calendar).toHaveAttribute('data-month', last)
})

test('a vertical drag leaves the week sheet\'s month alone', async ({ page, isMobile }) => {
  await page.goto('/consistency')
  await page.getByTestId('week-column').last().click()
  const calendar = page.getByTestId('week-calendar')
  const month = (await calendar.getAttribute('data-month'))!
  const box = await settledBox(calendar)
  const x = box.x + box.width / 2
  const y = box.y + 20
  const at = (clientX: number, clientY: number) => [{ identifier: 1, clientX, clientY }]
  if (isMobile) {
    await calendar.dispatchEvent('touchstart', { touches: at(x, y), changedTouches: at(x, y) })
    await calendar.dispatchEvent('touchend', { touches: [], changedTouches: at(x + 70, y + 120) })
  } else {
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 70, y + 120, { steps: 6 })
    await page.mouse.up()
  }
  await expect(calendar).toHaveAttribute('data-month', month)
})

test('a horizontal swipe pages the Plan month', async ({ page, t, isMobile }) => {
  await page.goto('/plan?view=month')
  await expect(page.getByRole('tab', { name: t.plan.switcher.month })).toHaveAttribute('aria-selected', 'true')
  const panel = page.getByRole('tabpanel').filter({ has: page.getByTestId('month-grid') })
  const title = panel.getByRole('button', { name: t.plan.prevPeriod, exact: true }).locator('..')
  const before = await title.innerText()
  await swipe(isMobile)(panel, 120)
  await expect(title).not.toHaveText(before)
  await expect(page.getByRole('tab', { name: t.plan.switcher.month })).toHaveAttribute('aria-selected', 'true')
})
