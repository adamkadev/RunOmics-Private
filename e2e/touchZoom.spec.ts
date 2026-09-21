import { test, expect } from '@playwright/test'

const IOS_ZOOM_THRESHOLD_PX = 16

/**
 * iOS Safari zooms the page when a field below 16px takes focus, and offers no
 * way back out - the sheet the field sits in ends up cropped. `globals.css`
 * guards against it, but the guard is a stylesheet rule with no other reader,
 * and it spent its first life inside `@layer base` where Tailwind's utilities
 * layer silently outranked it.
 */
test('no field on a touch device is small enough to trigger iOS zoom', async ({ browser }) => {
  const page = await (await browser.newContext({ hasTouch: true })).newPage()
  await page.goto('/activities')
  await expect(page.getByPlaceholder(/search/i)).toBeVisible()

  const sizes = await page.locator('input, textarea, select').evaluateAll((fields) =>
    fields.map((field) => ({
      field: field.outerHTML.slice(0, 120),
      fontSize: parseFloat(getComputedStyle(field).fontSize),
    }))
  )

  expect(sizes.length).toBeGreaterThan(0)
  expect(sizes.filter(({ fontSize }) => fontSize < IOS_ZOOM_THRESHOLD_PX)).toEqual([])
})
