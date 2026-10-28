import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from './fixtures'
import { deleteDocument, readDocument, signInAsOwner } from './owner'

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

test('a week of timed run/walk sessions has no plan km of 0', async ({ page, t }) => {
  await page.goto('/plan')
  await expect(page.getByTestId('week-summary')).toBeVisible()
  await expect(page.getByTestId('week-summary')).not.toContainText(`/ 0 ${t.units.km}`)
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

test('the owner marks a missed session skipped, which Firestore keeps, and takes it back', async ({ page, t }) => {
  const { missed } = returnBlock()
  await signInAsOwner(page, { openSettings: false })
  await deleteDocument(`wellness/${missed}`)
  const s = t.plan.dayCard

  await page.goto(`/plan?date=${missed}`)
  const day = page.getByTestId(`plan-day-done-${missed}`)
  await day.getByRole('button', { name: s.markSkipped }).click()
  await day.getByRole('button', { name: s.skipReasons.ill }).click()
  await expect(day.getByTestId('skipped-mark')).toHaveText(s.skippedFor(s.skipReasons.ill))
  await expect.poll(async () => (await readDocument(`wellness/${missed}`))?.skipped?.stringValue).toBe('ill')

  const later = await page.context().newPage()
  await later.goto(`/plan?date=${missed}`)
  const sameDay = later.getByTestId(`plan-day-done-${missed}`)
  await expect(sameDay.getByTestId('skipped-mark')).toHaveText(s.skippedFor(s.skipReasons.ill))
  await sameDay.getByRole('button', { name: s.undoSkip }).click()
  await expect(sameDay).toContainText(t.sessionState.missed)
  await expect.poll(async () => (await readDocument(`wellness/${missed}`))?.skipped).toBeUndefined()
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

test('Progress shows the coach’s current block where a race would be, and Athlete & zones', async ({ page, request, t }) => {
  await page.goto('/profile')
  await expect(page.getByTestId('block-tile')).toHaveAttribute('href', '/plan')
  await expect(page.getByTestId('block-name')).toHaveText(nextSession().block)
  await expect(page.getByTestId('race-tile')).toHaveCount(0)
  await expect(page.getByTestId('year-hero')).toHaveAttribute('href', '/all-time')
  await expect(page.getByTestId('athlete-row')).toContainText(t.profile.hub.athleteZones)
  expect(await (await request.get('/profile')).text()).not.toContain(nextSession().block)
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

test('Plan names the coach’s block, out of the page’s HTML, and leaves the coach’s words off the session', async ({ page, request, t }) => {
  const { block, upcoming } = nextSession()
  await page.goto('/plan')
  const phase = page.getByTestId('phase-line')
  await expect(phase.getByRole('heading')).toHaveText(block)
  await expect(phase).not.toContainText(t.plan.weekPurpose.generalPreparation)

  await page.goto(`/plan?date=${upcoming.date}`)
  const card = page.getByTestId(`plan-workout-${upcoming.id}`)
  await expect(card.getByTestId('workout-steps')).toContainText(t.plan.row.walk('1:00'))
  await expect(card).not.toContainText(upcoming.description)

  const html = await (await request.get(`/plan?date=${upcoming.date}`)).text()
  expect(html).not.toContain(block)
  expect(html).not.toContain('minutes de course')
})

test('a run before the armband reads its heart rate as untrusted, and one after it does not', async ({ page, t }) => {
  const athlete = read('athlete.json') as { hrReliableFrom: string }
  const runs = Object.values(
    Object.fromEntries((read('activities/index.json') as { months: string[] }).months.flatMap((month) =>
      (read(`activities/${month}.json`).activities as { id: string; date: string }[]).map((run) => [run.id, run]))),
  ).sort((a, b) => a.date.localeCompare(b.date))
  const before = runs.filter((run) => run.date < athlete.hrReliableFrom).at(-1)!
  const after = runs.find((run) => run.date >= athlete.hrReliableFrom)!

  await page.goto(`/activities/${before.id}`)
  await expect(page.getByTestId('run-hr-untrusted')).toHaveText(t.activity.dataQuality.hrUntrusted.beforeReliable)
  await page.goto(`/activities/${after.id}`)
  await expect(page.getByTestId('run-verdict')).toBeVisible()
  await expect(page.getByTestId('run-hr-untrusted')).toHaveCount(0)
})

test('Plan shows the return’s running minutes per week and its longest non-stop run', async ({ page }) => {
  await page.goto('/plan')
  const card = page.getByTestId('return-progress-card')
  await expect(card).toBeVisible()
  await expect(card.getByTestId('return-week').first()).toBeVisible()
  await expect(card.getByTestId('return-card-longest')).not.toHaveText('—')
})

test('Records has a comeback tab with the milestones still ahead', async ({ page, t }) => {
  await page.goto('/records?tab=return')
  await expect(page.getByTestId('return-progress')).toBeVisible()
  await expect(page.getByTestId('return-pending').first()).toContainText(t.returnProgress.milestones.continuous10)
})

test('Goals with no goal or race says so and points to the editor in Settings', async ({ page, t }) => {
  await page.goto('/goals')
  await expect(page.getByTestId('goals-empty')).toContainText(t.goals.emptyHow)
  await page.getByTestId('goals-empty-action').click()
  await expect(page).toHaveURL(/\/settings#goals-races$/)
})

test('Plan’s run/walk session carries no watch line and no heart rate', async ({ page, t }) => {
  const { upcoming } = nextSession()
  await page.goto(`/plan?date=${upcoming.date}`)
  const card = page.getByTestId(`plan-workout-${upcoming.id}`)
  await expect(card.getByTestId('workout-steps')).toBeVisible()
  await expect(card).not.toContainText(t.units.bpm)
  await expect(card).not.toContainText('Montre')
})
