import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { t } from '@/i18n'
import { yearOverYear } from '@/lib/yearOverYear'
import { cumulativeYear, progressHubView, type HubInput } from '../progressHubView'
import { ProgressHub, raceGap } from '../ProgressHub'

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

  // v4.17: a history that starts in May of last year was read as this year to
  // date against last year to date - +771 km where Analytics said +19. Both
  // now count from the day the history starts, in both years.
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

  // v4.17: the pair's own wear status, Replace soon from 70%, as its page reads it.
  it('reads each shoe\'s wear status, active pairs only, most worn first', () => {
    expect(view.shoes.map((s) => [s.name, s.status])).toEqual([['Pegasus 41', 'watch'], ['Vomero Plus', 'ok']])
  })

  it('names the race by its place when its name only restates the distance', () => {
    expect(view.race).toMatchObject({ distance: '10K', name: null, daysUntil: 64 })
    const named = progressHubView({ ...INPUT, spotlight: { ...INPUT.spotlight!, race: { ...INPUT.spotlight!.race, location: 'Wintzenheim' } } })
    expect(named.race!.name).toBe('Wintzenheim')
  })

  it('carries what the rows say: the athlete, consistency and all time', () => {
    expect(view.athlete).toEqual({ vo2max: 55, lthrBpm: 185 })
    expect(view.consistency).toEqual({ activeDays: 2, streakWeeks: 12 })
    expect(view.allTime).toEqual({ km: 2_509, since: '2022-03-10' })
    // Without Garmin's value, the latest sample to date.
    expect(progressHubView({ ...INPUT, vo2max: { ...INPUT.vo2max, value: null } }).athlete.vo2max).toBe(55)
  })
})

describe('the hub helpers', () => {
  it('sums a year cumulatively, a point a week', () => {
    const points = cumulativeYear([{ date: '2026-01-03', distanceKm: 10 }, { date: '2026-01-10', distanceKm: 5 }], 2026, 14)
    expect(points).toEqual([{ day: 0, km: 0 }, { day: 7, km: 10 }, { day: 14, km: 15 }])
  })

  it('states a race gap in seconds under a minute', () => {
    expect(raceGap(46)).toBe(`46 ${t.units.sec}`)
    expect(raceGap(130)).toBe('2:10')
  })
})

describe('ProgressHub (3.0)', () => {
  it('opens each sub-page: the race and the year Goals, the records, a row per page, Settings from the gear', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)

    expect(screen.getByTestId('race-tile').getAttribute('href')).toBe('/goals')
    expect(screen.getByTestId('year-hero').getAttribute('href')).toBe('/goals')
    expect(screen.getAllByTestId('records-tile').map((tile) => tile.getAttribute('href'))).toEqual(['/records', '/records', '/records'])
    const rows = Array.from(screen.getByTestId('progress-rows').querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(rows).toEqual(['/athlete', '/consistency', '/all-time', '/shoes'])
    expect(screen.getByRole('link', { name: t.profile.hub.settings }).getAttribute('href')).toBe('/settings')
    // Design review, Oct 2026: 44 pt, like every control.
    expect(screen.getByTestId('settings-gear').className).toContain('size-11')
  })

  it('leads with the race: an accent border, the countdown, the prediction and the gap to find in warn', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)
    expect(screen.getByTestId('race-tile').className).toContain('border-accent')
    expect(screen.getByTestId('race-countdown').textContent).toBe(`64${t.profile.hub.days(64)}`)
    expect(screen.getByTestId('race-predicted').textContent).toBe('42:10')
    const gap = screen.getByTestId('race-target').querySelector('b')!
    expect(gap.textContent).toBe(t.profile.hub.toFind(`46 ${t.units.sec}`))
    expect(gap.className).toContain('text-[var(--warn)]')
  })

  it('reads the year against its goal, with where it lands and what it needs', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)
    expect(screen.getByTestId('year-hero').textContent).toContain(t.profile.hub.vsYear('+1,094', 2025))
    const verdict = screen.getByTestId('projection-verdict')
    expect(verdict.textContent).toBe(t.profile.hub.shortBy('69'))
    expect(verdict.getAttribute('style')).toContain('var(--warn)')
    expect(screen.getByTestId('projection-line').textContent).toContain(t.profile.hub.needs('41', '35'))
  })

  it('tags the newest record NEW in the accent, its time in text ink', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)
    const labels = screen.getAllByTestId('latest-record')
    expect(labels).toHaveLength(1)
    expect(labels[0]!.textContent).toBe(t.profile.hub.newRecord)
    expect(labels[0]!.className).toContain('text-accent-text')
    expect(screen.getByTestId('records').textContent).toContain(t.profile.hub.recordLabels.half)
  })

  it('says on the Shoes row which pair needs replacing, in warn', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)
    const rows = screen.getByTestId('progress-rows')
    expect(rows.textContent).toContain(t.profile.hub.shoeStatus('Pegasus 41', t.shoes.status.watch))
    expect(rows.querySelector('.text-\\[var\\(--warn\\)\\]')).not.toBeNull()
  })
})

describe('one consistency count (v5.5 #9)', () => {
  it('matches the Consistency page, even for runs the rolling year and the month columns disagree on', async () => {
    const { consistencyMonths } = await import('@/components/consistency/consistencyMonthsView')
    // Sep 28-30, 2025: inside a rolling 365 days, before the page's first month (Oct).
    const edge = ['2025-09-28', '2025-09-30', '2025-10-01', '2026-09-20'].map((date) => ({
      date, distanceKm: 8, sessionCount: 1, longRun: false, activityId: date,
    }))
    const input = { ...INPUT, today: '2026-09-27', heatmapDays: edge }
    expect(progressHubView(input).consistency.activeDays).toBe(consistencyMonths(edge, '2026-09-27').activeDays)
    expect(progressHubView(input).consistency.activeDays).toBe(2)
  })
})

// v4.17: the accent marks the athlete's own data in charts.
describe('the year chart (3.0)', () => {
  it('draws this year in the accent, the projection dashed in its verdict colour and the goal dotted', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)
    expect(screen.getByTestId('current-line').getAttribute('stroke')).toBe('var(--accent)')
    expect(screen.getByTestId('projection-path').getAttribute('stroke')).toBe('var(--warn)')
    expect(screen.getByTestId('goal-line').getAttribute('stroke-dasharray')).toBe('1 4')
    expect(screen.getByTestId('year-ticks').children).toHaveLength(5)
  })
})
