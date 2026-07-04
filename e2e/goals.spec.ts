import { test, expect } from '@playwright/test'

// Exercises the Firestore-backed goals path (e2e/fixtures/goals.json seeds
// 2026 with a 1500 km annual target).
test('goals page renders the seeded annual target', async ({ page }) => {
  await page.goto('/goals')
  await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible()
  await expect(page.getByText('1500')).toBeVisible()
})
