import { test, expect } from './fixtures'

test('on a laptop, Consistency is as tall as Explored beside it, its week bars grown to fill it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/profile')
  const consistency = page.getByTestId('consistency-tile')
  const explored = page.getByTestId('explored-card')
  await expect(explored).toBeVisible()
  const [a, b] = [(await consistency.boundingBox())!, (await explored.boundingBox())!]
  expect(Math.abs(a.height - b.height)).toBeLessThan(1)
  expect((await page.getByTestId('streak-strip').boundingBox())!.height).toBeGreaterThan(30)
})
