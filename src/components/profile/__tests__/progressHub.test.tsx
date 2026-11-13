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

  it('drops the grade and starts the streak strip at the return during a reprise', () => {
    const graded = { ...INPUT, vo2Grade: { letter: 'B-', topPercent: 55 } }
    expect(progressHubView(graded).vo2max!.grade).toEqual({ letter: 'B-', topPercent: 55 })
    const reprise = progressHubView({ ...graded, repriseSince: '2026-09-10' })
    expect(reprise.vo2max!.grade).toBeNull()
    expect(reprise.consistency.strip.map((week) => week.monday)).toEqual(['2026-09-07', '2026-09-14', '2026-09-21'])
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
    expect(progressHubView(sparse).block).toEqual({ name: t.plan.weekPurpose.generalPreparation, general: true, week: 3, total: 4, done: 1, planned: 3 })
    render(<ProgressHub view={progressHubView(sparse)} />)
    expect(screen.queryByTestId('race-tile')).toBeNull()
    const tile = screen.getByTestId('block-tile')
    expect(tile.getAttribute('href')).toBe('/plan')
    expect(tile.textContent).not.toContain('Base rebuild')
    expect(screen.getByTestId('block-week').textContent).toBe(t.profile.hub.blockWeek(3, 4))
    expect(screen.getByTestId('block-sessions').textContent).toBe(t.profile.hub.blockSessions(1, 3))
  })

  it('keeps the race card while a race is planned, and the empty one without a block', () => {
    expect(progressHubView({ ...INPUT, coaching: GENERAL_BLOCK }).block).toBeNull()
    expect(progressHubView({ ...sparse, today: '2026-10-06' }).block).toBeNull()
    render(<ProgressHub view={progressHubView({ ...sparse, coaching: null })} />)
    expect(screen.getByTestId('race-tile').textContent).toBe(t.profile.hub.noRace)
  })

  it('opens the years from a goal-less year row', () => {
    render(<ProgressHub view={progressHubView(sparse)} />)
    const year = screen.getByTestId('year-row')
    expect(year.getAttribute('href')).toBe('/all-time')
    expect(year.textContent).toContain(t.profile.hub.thisYear)
  })

  it('opens Athlete & zones from its own row', () => {
    render(<ProgressHub view={progressHubView(sparse)} />)
    expect(screen.getByTestId('athlete-row').getAttribute('href')).toBe('/athlete')
    expect(screen.getByTestId('athlete-row').textContent).toContain(t.profile.hub.athleteZones)
  })
})

describe('ProgressHub as a list', () => {
  it('leads with the race, then one row per page in three groups, each opening its page', () => {
    render(<ProgressHub view={progressHubView(INPUT)} checkpoint={{ line: 'Cycle week 5 of 12', better: 6 }} explored={{ name: 'Hoenheim', pct: 20, complete: 1, total: 21 }} homeRuns={{ runCount: 155 }} />)

    expect(screen.getByTestId('race-tile').getAttribute('href')).toBe('/race')
    const rows = (group: string) => [...within(screen.getByTestId(group)).getAllByRole('link')].map((row) => row.getAttribute('data-testid'))
    expect(rows('hub-season')).toEqual(['year-row', 'checkpoint-row', 'consistency-row'])
    expect(rows('hub-you')).toEqual(['records-row', 'athlete-row', 'explored-row', 'home-runs-row'])
    expect(rows('hub-gear')).toEqual(['shoes-row', 'all-time-row'])
    expect(screen.getByTestId('year-row').getAttribute('href')).toBe('/goals')
    expect(screen.getByTestId('checkpoint-row').getAttribute('href')).toBe('/plan/checkpoint')
    expect(screen.getByTestId('checkpoint-row-value').textContent).toBe(t.profile.hub.better(6))
    expect(screen.getByRole('link', { name: t.profile.hub.settings }).getAttribute('href')).toBe('/settings')
  })

  it('gives each row one value: the year against its goal, the streak, the newest record, VO2max, the pair to replace, the totals', () => {
    const view = progressHubView(INPUT)
    render(<ProgressHub view={view} />)

    expect(screen.getByTestId('year-row-value').textContent).toBe(t.profile.hub.kmOfGoal('1,394', '2,000'))
    expect(screen.getByTestId('year-row-value').getAttribute('style')).toContain('var(--warn)')
    expect(screen.getByTestId('consistency-row-value').textContent).toBe(t.profile.hub.streakValue(INPUT.streakWeeks))
    expect(screen.getByTestId('records-row-value').textContent).toBe(`${t.profile.hub.recordLabels.half} 1:39:28`)
    expect(screen.getByTestId('athlete-row-value').textContent).toBe(`${t.profile.hub.vo2max} 55.0`)
    expect(screen.getByTestId('shoes-row').getAttribute('href')).toBe('/shoes/p')
    expect(screen.getByTestId('shoes-row-value').textContent).toBe(t.shoes.status.watch.toLowerCase())
    expect(screen.getByTestId('all-time-row-value').textContent).toBe('2,509 km')
  })

  it('says there is no streak yet rather than leading with 0', () => {
    render(<ProgressHub view={progressHubView({ ...INPUT, streakWeeks: 0 })} />)
    expect(screen.getByTestId('consistency-row-value').textContent).toBe(t.profile.hub.noStreakShort)
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
