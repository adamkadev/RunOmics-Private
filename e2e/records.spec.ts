import { test, expect } from '@playwright/test'

// Exercises the Firestore-backed PB path: the seeded e2e/fixtures/pbs.json
// (year 2025) must be visible on the page, proving the Firebase Admin read
// in FirestoreConfigRepository works end-to-end against runomics-dev.
test('records page renders the seeded personal bests', async ({ page }) => {
  await page.goto('/records')
  await expect(page.getByRole('heading', { name: 'Records' })).toBeVisible()

  // 5K PB from e2e/fixtures/pbs.json is 20:45 (1245s).
  await expect(page.getByText('20:45')).toBeVisible()
})
