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

function nextSession() {
  const plan = read('coaching/current_plan.json') as {
    block: { name: string }
    weeks: { workouts: { id: string; date: string; description: string }[] }[]
  }
  const today = new Date().toLocaleDateString('sv-SE')
  const upcoming = plan.weeks.flatMap((week) => week.workouts).find((workout) => workout.date > today)!
  return { block: plan.block.name, upcoming }
}

test('Plan names the coach’s block and shows its words, none of them in the page’s HTML', async ({ page, request, t }) => {
  const { block, upcoming } = nextSession()
  await page.goto('/plan')
  const phase = page.getByTestId('phase-line')
  await expect(phase.getByRole('heading')).toHaveText(block)
  await expect(phase).not.toContainText(t.plan.weekPurpose.generalPreparation)
  await expect(page.getByTestId('phase-focus')).toBeVisible()

  await page.goto(`/plan?date=${upcoming.date}`)
  const card = page.getByTestId(`plan-workout-${upcoming.id}`)
  await expect(card.getByTestId('coach-note')).toContainText(upcoming.description)
  await expect(card.getByTestId('workout-steps')).toContainText(t.plan.row.walk('1:00'))

  const html = await (await request.get(`/plan?date=${upcoming.date}`)).text()
  expect(html).not.toContain(block)
  expect(html).not.toContain('minutes de course')
})

test('Today’s session card carries one line of the coach’s words', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('session-card').getByTestId('session-coach-line')).toContainText('minutes de course')
})
