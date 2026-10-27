import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { t } from '@/i18n'
import { yearOverYear } from '@/lib/yearOverYear'
import { cumulativeYear, heatWeeks, progressHubView, type HubInput } from '../progressHubView'
import { ProgressHub } from '../ProgressHub'
import type { CoachingOverview } from '@/application/coaching/GetCoachingView'
import { plan, workout } from '@/domain/coaching/__tests__/fixtures'

function shoe(overrides: Partial<ShoeStats>): ShoeStats {
  return {
    gearId: 'g', name: 'Shoe', brand: 'B', maxKm: 800, alertThresholdKm: 700, retired: false, totalKm: 100,
    sessionCount: 10, lastUsedDate: null, firstUsedDate: null, kmPerWeek: 10, wearPercent: 20, nearingLimit: false,
    ...overrides,
  }
}

const STATS = { distanceKm: 1_394, durationSeconds: 134 * 3600, sessionCount: 153, elevationGainM: 0, avgKmPerWeek: 0, calories: 0 }

const INPUT: HubInput = {
  today: '2026-09-26',
  activities: [
    { date: '2022-03-10', distanceKm: 95 },
    { date: '2025-02-01', distanceKm: 300 },
    { date: '2025-12-01', distanceKm: 340 },
    { date: '2026-01-05', distanceKm: 700 },
    { date: '2026-09-20', distanceKm: 694 },
  ],
  ytd: STATS,
  prevYear: { ...STATS, distanceKm: 640 },
  allTime: { ...STATS, distanceKm: 2_509, sessionCount: 297, durationSeconds: 243 * 3600 },
  sinceDate: '2022-03-10',
  goal: {
    goalYear: { year: 2026, annualDistanceKm: 2_000, targets: [] },
    totalDistanceKm: 1_394,
    projection: { weeklyRate: 35, weeklyNeeded: 41, projectedYearKm: 1_931, status: 'behind', deltaKm: 69 },
  },
  spotlight: {
    race: { date: '2026-11-29', name: '10 km', distance: '10K', targetSeconds: 2484 },
    daysUntil: 64, predictedSeconds: 2530, gapSeconds: 130, prSeconds: 2565, prDate: null,
  },
  vo2max: { value: 55, samples: [{ date: '2026-07-01', vo2max: 53 }, { date: '2026-08-15', vo2max: 54 }, { date: '2026-09-24', vo2max: 55 }] },
  athlete: { lthrBpm: 185, thresholdPaceSecPerKm: 263 },
  records: [
    { key: '1k', label: '1K', seconds: 211, paceSecPerKm: 211, activityId: 'a', date: '2026-06-16', official: false },
    { key: '5k', label: '5K', seconds: 1198, paceSecPerKm: 240, activityId: 'b', date: '2026-05-01', official: false },
    { key: 'half', label: 'Half', seconds: 5968, paceSecPerKm: 283, activityId: 'c', date: '2026-09-14', official: true },
    { key: 'marathon', label: 'Marathon', seconds: 10_975, paceSecPerKm: 260, activityId: 'd', date: '2026-01-01', official: true },
  ],
  heatmapDays: [
    { date: '2026-09-24', distanceKm: 8.6, sessionCount: 1, longRun: false, activityId: null },
    { date: '2026-09-23', distanceKm: 10.2, sessionCount: 1, longRun: false, activityId: null },
    { date: '2025-01-01', distanceKm: 10, sessionCount: 1, longRun: false, activityId: null },
  ],
  streakWeeks: 12,
  shoes: [
    shoe({ gearId: 'v', name: 'Vomero Plus', totalKm: 412, wearPercent: 52 }),
    shoe({ gearId: 'p', name: 'Pegasus 41', totalKm: 702, wearPercent: 88 }),
    shoe({ gearId: 'r', retired: true }),
  ],
}

describe('progressHubView', () => {
  const view = progressHubView(INPUT)

  it('reads the year against last year, the goal and where it lands', () => {
    expect(view.hero).toMatchObject({ km: 1_394, goalKm: 2_000, deltaKm: 1_394 - 300 })
    expect(view.hero.current.at(-1)).toEqual({ day: 269, km: 1_394 })
    expect(view.hero.projection).toEqual({ yearKm: 1_931, weeklyNeeded: 41, weeklyRate: 35 })
    expect(progressHubView({ ...INPUT, goal: null }).hero.projection).toBeNull()
  })

  it('states the same year-over-year delta as Analytics when the history starts mid-year', () => {
    const activities = [
      { date: '2025-05-21', distanceKm: 100 },
      { date: '2025-08-01', distanceKm: 200 },
      { date: '2026-02-01', distanceKm: 500 },
      { date: '2026-06-01', distanceKm: 310 },
    ]
    const hub = progressHubView({ ...INPUT, activities, sinceDate: '2025-05-21' })
    const yoy = yearOverYear(activities, INPUT.today)!
    expect(yoy).toEqual({ km: 310, lastYearKm: 300, since: '2025-05-21' })
    expect(hub.hero.deltaKm).toBe(yoy.km - yoy.lastYearKm)
    expect(hub.hero.compareSince).toBe('2025-05-21')
    expect(progressHubView(INPUT).hero.compareSince).toBeNull()
  })

  it('keeps the four hub distances and tags the newest record only while it is new', () => {
    expect(view.records.map((r) => r.key)).toEqual(['1k', '5k', 'half'])
    expect(view.records.filter((r) => r.recent).map((r) => r.key)).toEqual(['half'])
    expect(progressHubView({ ...INPUT, today: '2026-11-20' }).records.some((r) => r.recent)).toBe(false)
  })

  it('reads each shoe\'s wear status, active pairs only, most worn first', () => {
    expect(view.shoes.map((s) => [s.name, s.status])).toEqual([['Pegasus 41', 'watch'], ['Vomero Plus', 'ok']])
  })

  it('names the race by its place when its name only restates the distance', () => {
    expect(view.race).toMatchObject({ distance: '10K', name: null, daysUntil: 64 })
    const named = progressHubView({ ...INPUT, spotlight: { ...INPUT.spotlight!, race: { ...INPUT.spotlight!.race, location: 'Wintzenheim' } } })
    expect(named.race!.name).toBe('Wintzenheim')
  })

  it('gives the race a page only at a distance the race page reads', () => {
    expect(view.race!.hasPage).toBe(true)
    const trail = progressHubView({ ...INPUT, spotlight: { ...INPUT.spotlight!, race: { ...INPUT.spotlight!.race, distance: '15K' } } })
    expect(trail.race!.hasPage).toBe(false)
  })

  it('draws km by year from the first run to this year, and VO2 max over 12 weeks', () => {
    expect(view.allTime.years.map(({ year, km }) => ({ year, km }))).toEqual([
      { year: 2022, km: 95 }, { year: 2023, km: 0 }, { year: 2024, km: 0 }, { year: 2025, km: 640 }, { year: 2026, km: 1_394 },
    ])
    expect(view.allTime).toMatchObject({ km: 2_509, runs: 297, hours: 243, since: '2022-03-10' })
    // Over 12 weeks, as Analytics reads it: Jul 1 is outside that.
    expect(view.vo2max).toMatchObject({ value: 55, delta: 1, series: [54, 55], thresholdPaceSecPerKm: 263, lthrBpm: 185 })
    expect(view.consistency).toMatchObject({ activeDays: 2, streakWeeks: 12 })
    // Without Garmin's value, the latest sample to date.
    expect(progressHubView({ ...INPUT, vo2max: { ...INPUT.vo2max, value: null } }).vo2max!.value).toBe(55)
  })
})

describe('the hub helpers', () => {
  it('sums a year cumulatively, a point a week', () => {
    const points = cumulativeYear([{ date: '2026-01-03', distanceKm: 10 }, { date: '2026-01-10', distanceKm: 5 }], 2026, 14)
    expect(points).toEqual([{ day: 0, km: 0 }, { day: 7, km: 10 }, { day: 14, km: 15 }])
  })

  it('lays out twelve weeks on the distance ramp, the days after today still to come', () => {
    const weeks = heatWeeks(INPUT.heatmapDays, '2026-09-26')
    expect(weeks).toHaveLength(12)
    const rest = { level: 0, today: false, future: false }
    const mid = { level: 2, today: false, future: false }
    expect(weeks.at(-1)).toEqual([rest, rest, mid, mid, rest, { level: 0, today: true, future: false }, { level: 0, today: false, future: true }])
  })
})

const GENERAL_BLOCK: CoachingOverview = {
  plan: { ...plan(), macrocycleStartDate: '2026-08-31', targetEvent: undefined, block: { ...plan().block, name: 'Base rebuild', endDate: '2026-10-04' } },
  currentWeekId: null,
  workouts: [
    { prescription: workout({ id: 'a', date: '2026-09-22' }), state: 'completed', activityId: 'run-a', distanceMeters: null },
    { prescription: workout({ id: 'b', date: '2026-09-24' }), state: 'missed', activityId: null, distanceMeters: null },
    { prescription: workout({ id: 'c', date: '2026-09-25' }), state: 'cancelled', activityId: null, distanceMeters: null },
    { prescription: workout({ id: 'd', date: '2026-09-29' }), state: 'prescribed', activityId: null, distanceMeters: null },
  ],
}

describe('the hub without a race, a goal or PBs', () => {
  const sparse: HubInput = { ...INPUT, spotlight: null, goal: null, records: [], coaching: GENERAL_BLOCK }

  it('shows the current block in the race card\'s place, as Plan names and counts it', () => {
    expect(progressHubView(sparse).block).toEqual({ name: t.plan.weekPurpose.generalPreparation, general: true, week: 4, total: 5, done: 1, planned: 3 })
    render(<ProgressHub view={progressHubView(sparse)} />)
    expect(screen.queryByTestId('race-tile')).toBeNull()
    const tile = screen.getByTestId('block-tile')
    expect(tile.getAttribute('href')).toBe('/plan')
    expect(tile.textContent).not.toContain('Base rebuild')
    expect(screen.getByTestId('block-week').textContent).toBe(t.profile.hub.blockWeek(4, 5))
    expect(screen.getByTestId('block-sessions').textContent).toBe(t.profile.hub.blockSessions(1, 3))
  })

  it('keeps the race card while a race is planned, and the empty one without a block', () => {
    expect(progressHubView({ ...INPUT, coaching: GENERAL_BLOCK }).block).toBeNull()
    expect(progressHubView({ ...sparse, today: '2026-10-06' }).block).toBeNull()
    render(<ProgressHub view={progressHubView({ ...sparse, coaching: null })} />)
    expect(screen.getByTestId('race-tile').textContent).toBe(t.profile.hub.noRace)
  })

  it('opens the years from a goal-less year card', () => {
    render(<ProgressHub view={progressHubView(sparse)} />)
    const year = screen.getByTestId('year-hero')
    expect(year.getAttribute('href')).toBe('/all-time')
    expect(year.textContent).toContain(t.profile.hub.thisYear)
  })

  it('opens Athlete & zones from its own row', () => {
    render(<ProgressHub view={progressHubView(sparse)} />)
    expect(screen.getByTestId('athlete-row').getAttribute('href')).toBe('/athlete')
    expect(screen.getByTestId('athlete-row').textContent).toContain(t.profile.hub.athleteZones)
  })
})

describe('ProgressHub (3.0)', () => {
  it('opens each sub-page: the race its page, the year Goals, the records, a tile per page, Settings from the gear', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)

    expect(screen.getByTestId('race-tile').getAttribute('href')).toBe('/race')
    expect(screen.getByTestId('year-hero').getAttribute('href')).toBe('/goals')
    expect(within(screen.getByTestId('records-tile')).getAllByRole('link')[0]!.getAttribute('href')).toBe('/records')
    expect(screen.getAllByTestId('record')).toHaveLength(3)
    expect(screen.getByTestId('vo2-row').getAttribute('href')).toBe('/athlete')
    expect(screen.getByTestId('consistency-tile').getAttribute('href')).toBe('/consistency')
    expect(screen.getByTestId('all-time').getAttribute('href')).toBe('/all-time')
    expect(screen.getAllByTestId('shoe-row').map((row) => row.getAttribute('href'))).toEqual(['/shoes/p', '/shoes/v'])
    expect(screen.getByTestId('shoes-all').getAttribute('href')).toBe('/shoes')
    expect(screen.getByRole('link', { name: t.profile.hub.settings }).getAttribute('href')).toBe('/settings')
    expect(screen.getByTestId('settings-gear').className).toContain('size-11')
  })

  it('leads with the race as one row: eyebrow with the countdown, the name, the predicted time', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)
    expect(screen.getByTestId('race-eyebrow').textContent).toContain(t.profile.hub.inDays(64))
    expect(screen.getByTestId('race-predicted').textContent).toBe('42:10')
    expect(screen.queryByTestId('race-gap')).toBeNull()
  })

  it('names the race on its own line, never cut', () => {
    const spotlight = { ...INPUT.spotlight!, race: { date: '2027-05-08', name: 'ING Night Marathon Luxembourg', distance: 'Half-Marathon', targetSeconds: 5700 }, predictedSeconds: 5600 }
    render(<ProgressHub view={progressHubView({ ...INPUT, spotlight })} />)
    expect(screen.getByTestId('race-name').textContent).toBe('ING Night Marathon Luxembourg')
    expect(screen.getByTestId('race-name').className).not.toContain('truncate')
  })

  it('reads the year against its goal, the verdict across, a tick where this pace lands', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)
    const verdict = screen.getByTestId('projection-verdict')
    expect(verdict.textContent).toBe(t.profile.hub.shortAtPace('69'))
    expect(verdict.getAttribute('style')).toContain('var(--warn)')
    expect(screen.getByTestId('projection-tick').getAttribute('style')).toContain('var(--warn)')
  })

  it('tags the newest record NEW in the accent, its time in text ink', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)
    const labels = screen.getAllByTestId('latest-record')
    expect(labels).toHaveLength(1)
    expect(labels[0]!.textContent).toBe(t.profile.hub.newRecord)
    expect(labels[0]!.className).toContain('text-accent-text')
    expect(screen.getByTestId('records').textContent).toContain(t.profile.hub.recordLabels.half)
  })

  it('tags a shoe that needs replacing soon, and draws its bar in warn', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)
    const [pegasus, vomero] = screen.getAllByTestId('shoe-row')
    expect(pegasus!.textContent).toContain(`· ${t.shoes.status.watch.toLowerCase()}`)
    expect(pegasus!.querySelector<HTMLElement>('[data-testid="bar-fill"]')!.style.background).toBe('var(--warn)')
    expect(vomero!.querySelector('[data-testid="shoe-status"]')).toBeNull()
  })

  it('draws the last 26 weeks as a strip, the week under way an outline', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)
    const strip = screen.getByTestId('streak-strip')
    expect(strip.children).toHaveLength(26)
    const last = strip.children[25] as HTMLElement
    expect(last.hasAttribute('data-current')).toBe(true)
    expect(last.style.border).toContain('dashed')
    expect(screen.getByTestId('consistency-tile').textContent).not.toMatch(/active days/)
    expect(screen.getByTestId('consistency-this-week').textContent).toBe(t.profile.hub.runsThisWeek(progressHubView(INPUT).consistency.thisWeek.runs, 3))
    expect(screen.getByTestId('records-tile').textContent).toContain(t.profile.hub.vo2Delta('1'))
  })

  it('previews Consistency as the weekly streak and this week against the target', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)
    const tile = screen.getByTestId('consistency-tile')
    expect(within(tile).getByTestId('streak-weeks').textContent).toBe(String(INPUT.streakWeeks))
    expect(tile.textContent).toContain(t.profile.hub.streakOf(3))
    expect(screen.queryByTestId('heatmap')).toBeNull()
  })

  it('previews Goals without a second distance chart', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)
    const card = screen.getByTestId('year-hero')
    expect(card.textContent).toContain(t.profile.hub.goalsSeason)
    expect(within(card).queryByTestId('current-line')).toBeNull()
  })

  it('shows this year and last on the All time card', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)
    expect(screen.getAllByTestId('year-row').map((row) => row.textContent)).toEqual([expect.stringContaining('2026'), expect.stringContaining('2025')])
  })

  it('puts the Explored card beside Consistency when the page gives one', () => {
    render(<ProgressHub view={progressHubView(INPUT)} explored={<section data-testid="explored-slot" />} />)
    const columns = [...screen.getByTestId('progress-columns').children]
    expect(columns.map((child) => child.getAttribute('data-testid'))).toEqual(['consistency-tile', 'explored-slot'])
  })

  it('keeps Consistency alone in its row without one', () => {
    const { container } = render(<ProgressHub view={progressHubView(INPUT)} />)
    const columns = [...screen.getByTestId('progress-columns').children]
    expect(columns.map((child) => child.getAttribute('data-testid'))).toEqual(['consistency-tile'])
    const { container: empty } = render(<ProgressHub view={progressHubView(INPUT)} explored={undefined} />)
    expect(empty.innerHTML).toBe(container.innerHTML)
  })
})

describe('one consistency count (v5.5 #9)', () => {
  it('counts the twelve calendar months, not a rolling 365 days', async () => {
    const { activeDaysInYear } = await import('@/components/consistency/consistencyRamp')
    // Sep 28-30, 2025: inside a rolling 365 days, before the page's first month (Oct).
    const edge = ['2025-09-28', '2025-09-30', '2025-10-01', '2026-09-20'].map((date) => ({
      date, distanceKm: 8, sessionCount: 1, longRun: false, activityId: date,
    }))
    const input = { ...INPUT, today: '2026-09-27', heatmapDays: edge }
    expect(progressHubView(input).consistency.activeDays).toBe(activeDaysInYear(edge, '2026-09-27'))
    expect(progressHubView(input).consistency.activeDays).toBe(2)
  })
})
