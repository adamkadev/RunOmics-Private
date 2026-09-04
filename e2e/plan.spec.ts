import { test, expect } from '@playwright/test'

test('plan week view renders', async ({ page }) => {
  await page.goto('/plan')
  await expect(page.getByRole('heading', { name: 'Plan' })).toBeVisible()
  await expect(page.getByText('Coach', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Autumn 10K build' })).toBeVisible()
  await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0)
})
