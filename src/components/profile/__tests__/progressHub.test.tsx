import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { t } from '@/i18n'
import { yearOverYear } from '@/lib/yearOverYear'
import { cumulativeYear, heatWeeks, progressHubView, type HubInput } from '../progressHub'
import { ProgressHub, raceShare } from '../ProgressHub'

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
  goal: { goalYear: { year: 2026, annualDistanceKm: 2_000, targets: [] }, totalDistanceKm: 1_394, projection: null },
  spotlight: {
    race: { date: '2026-11-29', name: '10 km', distance: '10K', targetSeconds: 2400 },
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

  it('reads the year against last year and the goal', () => {
    // Last year up to the same day only: December's 340 km is not in it.
    expect(view.hero).toMatchObject({ km: 1_394, goalKm: 2_000, deltaKm: 1_394 - 300, hours: 134, runs: 153 })
    expect(view.hero.current.at(-1)).toEqual({ day: 269, km: 1_394 })
    expect(view.hero.previous.at(-1)!.km).toBe(300)
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
  })

  it('marks the most recent record and keeps the four hub distances', () => {
    expect(view.records.map((r) => r.key)).toEqual(['1k', '5k', 'half'])
    expect(view.records.find((r) => r.latest)?.key).toBe('half')
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

  it('draws km by year from the first run to this year', () => {
    expect(view.allTime.years.map(({ year, km }) => ({ year, km }))).toEqual([
      { year: 2022, km: 95 }, { year: 2023, km: 0 }, { year: 2024, km: 0 }, { year: 2025, km: 640 }, { year: 2026, km: 1_394 },
    ])
    // Over 12 weeks, as Analytics reads it (v4.7): Jul 1 is outside that.
    expect(view.vo2max).toMatchObject({ value: 55, delta: 1, series: [54, 55] })
    expect(view.consistency).toMatchObject({ activeDays: 2, streakWeeks: 12 })
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
    // v4.17: the Consistency page's km levels (8.6 and 10.2 km are 8-15 km), today outlined.
    expect(weeks.at(-1)).toEqual([rest, rest, mid, mid, rest, { level: 0, today: true, future: false }, { level: 0, today: false, future: true }])
  })

  it('fills the race bar a fifth less per 1% over the target', () => {
    expect(raceShare(2400, 2400)).toBe(1)
    expect(raceShare(2530, 2400)).toBeCloseTo(0.729, 2)
  })
})

describe('ProgressHub', () => {
  // H01, M12: a visual hub; every tile opens its existing sub-page.
  it('opens each sub-page from its tile, and Settings from the gear', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)

    expect(screen.getByTestId('year-hero').getAttribute('href')).toBe('/goals')
    expect(screen.getByTestId('race-tile').getAttribute('href')).toBe('/goals')
    expect(screen.getByTestId('vo2-tile').getAttribute('href')).toBe('/athlete')
    expect(screen.getByTestId('records-tile').getAttribute('href')).toBe('/records')
    expect(screen.getByTestId('consistency-tile').getAttribute('href')).toBe('/consistency')
    // v4.17: each pair opens its own page; the card's header opens the list.
    expect(screen.getAllByTestId('shoe-row').map((row) => row.getAttribute('href'))).toEqual(['/shoes/p', '/shoes/v'])
    expect(screen.getByTestId('shoes-all').getAttribute('href')).toBe('/shoes')
    expect(screen.getByRole('link', { name: t.profile.hub.settings }).getAttribute('href')).toBe('/settings')
    // Design review, Oct 2026: 44 pt, like every control.
    expect(screen.getByTestId('settings-gear').className).toContain('size-11')
    expect(screen.getByTestId('shoes-all').className).toContain('hit-44')
    expect(screen.getByTestId('year-hero').textContent).toContain(t.profile.hub.vsYear('+1,094', 2025))
    expect(screen.getByTestId('race-tile').textContent).toContain('42:10')
    // C6: the All time card opens its page and shows this year and last as rows.
    expect(screen.getByTestId('all-time').getAttribute('href')).toBe('/all-time')
    expect(screen.getAllByTestId('year-row').map((row) => row.textContent)).toEqual([
      expect.stringContaining('2026'),
      expect.stringContaining('2025'),
    ])
  })

  // v4.3.1: the footers are whole segments; v4.3.4: on one line, sized down
  // (never under 11 px) rather than wrapped.
  it('keeps each footer segment whole', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)
    for (const id of ['consistency-footer', 'vo2-footer']) {
      const footer = screen.queryByTestId(id)
      if (!footer) continue
      expect(footer.children.length).toBeGreaterThan(0)
      for (const segment of footer.children) expect(segment.className).toContain('whitespace-nowrap')
      expect(footer.className).toContain('whitespace-nowrap')
    }
    expect(screen.getByTestId('consistency-footer').textContent).toMatch(/\d+ active days in 12 months/)
    expect(screen.getByTestId('consistency-footer').textContent).toMatch(/\d+-week streak/)
  })

  // v4.3.3: the newest record carries a label in the accent; its time is text ink.
  // v4.17: "NEW PR" while it is new, "LATEST" once it is a month old.
  it('marks the newest record with a label, not an accented time', () => {
    const { unmount } = render(<ProgressHub view={progressHubView(INPUT)} />)
    const labels = screen.getAllByTestId('latest-record')
    expect(labels).toHaveLength(1)
    expect(labels[0]!.textContent).toBe(t.profile.hub.newRecord)
    expect(labels[0]!.className).toContain('text-accent-text')
    expect(labels[0]!.parentElement!.className).toContain('text-foreground')
    expect(screen.getByTestId('records-tile').textContent).toContain(t.profile.hub.recordLabels.half)
    unmount()

    render(<ProgressHub view={progressHubView({ ...INPUT, today: '2026-11-20' })} />)
    expect(screen.getByTestId('latest-record').textContent).toBe(t.profile.hub.latestRecord)
  })

  // v4.17: the gap to target is a caution, in warn, with its bar.
  it('states the gap to the race target in warn', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)
    const target = screen.getByTestId('race-target')
    expect(target.textContent).toContain(t.profile.hub.toFind('2:10'))
    expect(target.querySelector('b')!.getAttribute('style')).toContain('var(--warn)')
    expect(screen.getByTestId('race-tile').querySelector<HTMLElement>('[data-testid="bar-fill"]')!.style.background).toBe('var(--warn)')
  })

  it('tags a shoe that needs replacing soon, and draws its bar in warn', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)
    const [pegasus, vomero] = screen.getAllByTestId('shoe-row')
    expect(pegasus!.textContent).toContain(t.shoes.status.watch)
    expect(pegasus!.querySelector<HTMLElement>('[data-testid="bar-fill"]')!.style.background).toBe('var(--warn)')
    expect(vomero!.querySelector('[data-testid="shoe-status"]')).toBeNull()
    expect(vomero!.querySelector<HTMLElement>('[data-testid="bar-fill"]')!.style.background).toBe('var(--accent)')
  })
})

describe('the hub columns (v4.17.1)', () => {
  // Records sat in a 2 x 2 row beside the taller Consistency card and left a
  // gap under it. Each column stacks on its own now.
  it('stacks Next race, Records and Shoes on the left, VO2 max and Consistency on the right', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)
    const [left, right] = screen.getAllByTestId('progress-column')
    const ids = (col: HTMLElement) => Array.from(col.children).map((el) => el.getAttribute('data-testid'))
    expect(ids(left!)).toEqual(['race-tile', 'records-tile', 'shoes-tile'])
    expect(ids(right!)).toEqual(['vo2-tile', 'consistency-tile'])
    // A column is a flex stack from sm up and melts into the page's one list below it.
    for (const col of [left!, right!]) expect(col.className).toMatch(/\bcontents\b.*\bsm:flex\b/)
  })

  it('orders a phone\'s one list distance, race, VO2 max, records, consistency, shoes, all time', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)
    const order = (id: string) => Number(/(?:^| )order-(\d)/.exec(screen.getByTestId(id).className)?.[1])
    const phone = ['race-tile', 'vo2-tile', 'records-tile', 'consistency-tile', 'shoes-tile'].map(order)
    expect(phone).toEqual([1, 2, 3, 4, 5])
    // Distance above the columns, all time below them, both full width.
    const page = screen.getByTestId('progress-columns').parentElement!
    const blocks = Array.from(page.children).map((el) => el.getAttribute('data-testid'))
    expect(blocks.indexOf('year-hero')).toBeLessThan(blocks.indexOf('progress-columns'))
    expect(blocks.indexOf('all-time')).toBeGreaterThan(blocks.indexOf('progress-columns'))
  })
})

describe('one consistency count (v5.5 #9)', () => {
  it('matches the Consistency page, even for runs the rolling year and the month columns disagree on', async () => {
    const { consistencyMonths } = await import('@/components/consistency/consistencyMonths')
    // Sep 28-30, 2025: inside a rolling 365 days, before the page's first month (Oct).
    const edge = ['2025-09-28', '2025-09-30', '2025-10-01', '2026-09-20'].map((date) => ({
      date, distanceKm: 8, sessionCount: 1, longRun: false, activityId: date,
    }))
    const input = { ...INPUT, today: '2026-09-27', heatmapDays: edge }
    expect(progressHubView(input).consistency.activeDays).toBe(consistencyMonths(edge, '2026-09-27').activeDays)
    expect(progressHubView(input).consistency.activeDays).toBe(2)
  })
})

// v4.17 reverses v5.5 R2: the accent marks the athlete's own data in charts.
describe('the accent marks the athlete\'s own data (v4.17)', () => {
  it('draws this year in the accent, last year in line-2 and the goal dashed', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)
    expect(screen.getByTestId('current-line').getAttribute('stroke')).toBe('var(--accent)')
    expect(screen.getByTestId('previous-line').getAttribute('stroke')).toBe('var(--line-2)')
    expect(screen.getByTestId('goal-line').getAttribute('stroke-dasharray')).toBe('4 5')
    expect(screen.getByTestId('year-chart').querySelector('[fill="var(--accent)"]')).toBeNull()
    // A reference series, not the athlete's own: text ink.
    expect(screen.getByTestId('vo2-sparkline').querySelector('path')!.getAttribute('stroke')).toBe('var(--foreground)')
  })

  it('fills the consistency card on the accent ramp, today outlined', () => {
    render(<ProgressHub view={progressHubView(INPUT)} />)
    const cells = [...screen.getByTestId('heatmap').querySelectorAll<HTMLElement>('[data-level]')]
    // The Consistency page's ramp, per theme (v4.17.1).
    expect(cells.filter((c) => c.dataset.level === '2').every((c) => c.style.background.includes('var(--accent) var(--level-mid)'))).toBe(true)
    expect(cells.filter((c) => c.dataset.level === '0').every((c) => c.style.background === 'var(--level-rest)')).toBe(true)
    expect(screen.getByTestId('heatmap').querySelector<HTMLElement>('[data-today]')!.style.outline).toContain('var(--accent)')
  })
})
