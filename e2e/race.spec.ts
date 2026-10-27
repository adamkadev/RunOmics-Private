import { test, expect } from './fixtures'

test('the race page forecasts form on race day from the planned sessions', async ({ page, t }) => {
  await page.goto('/race')
  const form = page.getByTestId('race-form')
  await expect(form.getByRole('heading', { name: t.race.formTitle })).toBeVisible()
  await expect(form).toHaveAttribute('data-state', 'forecast')
  await expect(form.getByTestId('race-form-tsb')).toHaveText(/^([+−]\d+|±0)$/)
  await expect(form.getByTestId('race-form-line')).toBeVisible()
})
