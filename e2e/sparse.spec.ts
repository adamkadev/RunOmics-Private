import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from './fixtures'

const DATA = path.resolve('.e2e-data-sparse')
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'))

function returnBlock() {
  const plan = read('coaching/current_plan.json') as { weeks: { workouts: { date: string }[] }[] }
  const [first, missed] = plan.weeks[0]!.workouts
  const runs = read(`activities/${first!.date.slice(0, 7)}.json`).activities as { id: string; date: string; type: string }[]
  return { first: first!.date, missed: missed!.date, firstRun: runs.find((run) => run.date === first!.date)! }
}

test('Today holds its reading while building back, naming no form band', async ({ page, t }) => {
  await page.goto('/')
  await expect(page.getByTestId('readiness-status')).toHaveText(t.dashboard.readiness.buildingBack)
  for (const band of Object.values(t.formBand)) await expect(page.getByTestId('readiness-card')).not.toContainText(band)
  await expect(page.getByTestId('this-week-link')).not.toContainText(`/ 0 ${t.units.km}`)
})

test('a week of timed run/walk sessions has no plan km of 0', async ({ page }) => {
  await page.goto('/plan')
  await expect(page.getByTestId('week-summary')).not.toContainText('/')
})

test('a run the watch typed VO2 max counts as its easy session done', async ({ page, t }) => {
  const { first, firstRun } = returnBlock()
  expect(firstRun.type).toBe('VO2Max')
  await page.goto(`/plan?date=${first}`)
  await expect(page.getByTestId(`plan-day-done-${first}`).getByRole('img', { name: t.plan.dayCard.asPlanned })).toBeVisible()
})

test('a session with no run reads as missed', async ({ page, t }) => {
  const { missed } = returnBlock()
  await page.goto(`/plan?date=${missed}`)
  await expect(page.getByTestId(`plan-day-done-${missed}`)).toContainText(t.sessionState.missed)
})

test('a run the watch typed VO2 max is named as its easy session', async ({ page, t }) => {
  await page.goto(`/activities/${returnBlock().firstRun.id}`)
  await expect(page.getByTestId('run-verdict')).toContainText(t.activityTypes.Base)
  await expect(page.getByTestId('run-verdict')).not.toContainText(t.activityTypes.VO2Max)
})

test('no run in the list reads VO2 max', async ({ page, t }) => {
  await page.goto('/activities')
  await expect(page.getByTestId('thumb-row').first()).toBeVisible()
  await expect(page.locator('main')).not.toContainText(t.activityTypes.VO2Max)
})

test('Analytics counts the year from the runs without a goals file', async ({ page }) => {
  await page.goto('/analytics?tab=volume')
  await expect(page.getByTestId('ytd-km')).toBeVisible()
  await expect(page.getByTestId('ytd-km')).not.toContainText(/·\s0\s/)
})

test('Progress shows the current block where a race would be, and Athlete & zones', async ({ page, t }) => {
  await page.goto('/profile')
  await expect(page.getByTestId('block-tile')).toHaveAttribute('href', '/plan')
  await expect(page.getByTestId('race-tile')).toHaveCount(0)
  await expect(page.getByTestId('year-hero')).toHaveAttribute('href', '/all-time')
  await expect(page.getByTestId('athlete-row')).toContainText(t.profile.hub.athleteZones)
})
