import { describe, expect, it } from 'vitest'
import { runHistory } from '../runHistory'
import type { Activity } from '../types'

const run = (overrides: Partial<Activity> & { id: string; date: string }): Activity =>
  ({
    type: 'Base',
    distanceKm: 10,
    durationSeconds: 55 * 60,
    paceSecPerKm: 330,
    avgHeartRate: 150,
    hrZones: [],
    bestEfforts: null,
    ...overrides,
  }) as Activity

describe('typeBaseline', () => {
  const peers = [
    run({ id: 'p1', date: '2026-06-01', durationSeconds: 3400 }),
    run({ id: 'p2', date: '2026-06-08', durationSeconds: 3400 }),
    run({ id: 'p3', date: '2026-06-15', durationSeconds: 3400, avgHeartRate: 156 }),
  ]

  it('averages the recent runs of the same type', () => {
    const current = run({ id: 'c', date: '2026-06-22' })

    expect(runHistory(current, [current, ...peers]).baseline).toEqual({
      runs: 3,
      paceSecPerKm: 340,
      avgHr: 152,
      measure: 'runs',
    })
  })

  it('stays null below three comparable runs', () => {
    const current = run({ id: 'c', date: '2026-06-22' })

    expect(runHistory(current, [current, ...peers.slice(0, 2)]).baseline).toBeNull()
  })

  it('ignores the other session types', () => {
    const current = run({ id: 'c', date: '2026-06-22', type: 'Threshold' })

    expect(runHistory(current, [current, ...peers]).baseline).toBeNull()
  })

  it('ignores runs beyond the lookback window', () => {
    const current = run({ id: 'c', date: '2026-06-22' })
    const stale = peers.map((peer) => ({ ...peer, date: '2025-06-01' }))

    expect(runHistory(current, [current, ...stale]).baseline).toBeNull()
  })

  it('never counts a run that came after it, so a verdict stays true', () => {
    const current = run({ id: 'c', date: '2026-06-01' })
    const later = peers.map((peer, i) => ({ ...peer, id: `l${i}`, date: '2026-06-20' }))

    expect(runHistory(current, [current, ...later]).baseline).toBeNull()
  })

  const reps = (pace: number, hr: number) =>
    [0, 1, 2].map(() => ({ type: 'interval_active', durationSec: 420, distanceM: (420 / pace) * 1000, avgSpeedMs: 0, avgHr: hr, laps: [] }))
  const threshold = (id: string, date: string, pace: number, hr: number) =>
    run({ id, date, type: 'Threshold', paceSecPerKm: 333, splits: reps(pace, hr) } as Partial<Activity> & { id: string; date: string })

  it('holds a threshold session against earlier threshold reps, not whole-run averages', () => {
    const current = threshold('c', '2026-06-22', 265, 177)
    const before = [threshold('t1', '2026-06-01', 271, 176), threshold('t2', '2026-06-08', 270, 178), threshold('t3', '2026-06-15', 269, 177)]

    expect(runHistory(current, [current, ...before]).baseline).toEqual({ runs: 3, paceSecPerKm: 270, avgHr: 177, measure: 'reps' })
  })

  it('holds a long run against long runs only', () => {
    const long = (id: string, date: string, pace: number) => run({ id, date, durationSeconds: 100 * 60, paceSecPerKm: pace, distanceKm: 16 })
    const current = long('c', '2026-06-22', 350)

    expect(runHistory(current, [current, ...peers]).baseline).toBeNull()
    const longs = [long('l1', '2026-06-01', 352), long('l2', '2026-06-08', 356), long('l3', '2026-06-15', 354)]
    expect(runHistory(current, [current, ...peers, ...longs]).baseline).toMatchObject({ runs: 3, measure: 'runs' })
  })

  it('has no average for a race, whose peers are other distances', () => {
    const race = (id: string, date: string) => run({ id, date, type: 'Race' })
    const current = race('c', '2026-06-22')

    expect(runHistory(current, [current, race('r1', '2026-06-01'), race('r2', '2026-06-08'), race('r3', '2026-06-15')]).baseline).toBeNull()
  })
})

describe('effortStanding', () => {
  const efforts = (seconds: number) => ({ '5k': seconds })

  it('names the distance no earlier run went faster over', () => {
    const current = run({ id: 'c', date: '2026-06-22', bestEfforts: efforts(1500) })
    const past = run({ id: 'p', date: '2026-01-10', bestEfforts: efforts(1560) })

    expect(runHistory(current, [current, past]).standing).toEqual({ label: '5K', daysSinceBetter: null })
  })

  it('counts the days back to the last run that went faster', () => {
    const current = run({ id: 'c', date: '2026-06-22', bestEfforts: efforts(1500) })
    const better = run({ id: 'b', date: '2026-01-22', bestEfforts: efforts(1450) })

    expect(runHistory(current, [current, better]).standing).toEqual({ label: '5K', daysSinceBetter: 151 })
  })

  it('says nothing when a faster run is recent enough to remember', () => {
    const current = run({ id: 'c', date: '2026-06-22', bestEfforts: efforts(1500) })
    const better = run({ id: 'b', date: '2026-06-01', bestEfforts: efforts(1450) })

    expect(runHistory(current, [current, better]).standing).toBeNull()
  })

  it('says nothing about a distance never covered before', () => {
    const current = run({ id: 'c', date: '2026-06-22', bestEfforts: efforts(1500) })
    const past = run({ id: 'p', date: '2026-01-10' })

    expect(runHistory(current, [current, past]).standing).toBeNull()
  })

  it('prefers the longest distance when both stand', () => {
    const current = run({ id: 'c', date: '2026-06-22', bestEfforts: { '1k': 280, '5k': 1500 } })
    const past = run({ id: 'p', date: '2026-01-10', bestEfforts: { '1k': 290, '5k': 1560 } })

    expect(runHistory(current, [current, past]).standing?.label).toBe('5K')
  })
})

describe('session shape', () => {
  it('counts the minutes spent in zone 4 and above', () => {
    const current = run({
      id: 'c',
      date: '2026-06-22',
      hrZones: [
        { zone: 2, seconds: 1800, percent: 60, minBpm: 120, maxBpm: 140 },
        { zone: 4, seconds: 600, percent: 20, minBpm: 160, maxBpm: 170 },
        { zone: 5, seconds: 300, percent: 20, minBpm: 170, maxBpm: null },
      ],
    })

    expect(runHistory(current, [current]).hardMinutes).toBe(15)
  })

  it('reads the run cadence from the days around it', () => {
    const current = run({ id: 'c', date: '2026-06-22' })
    const activities = [
      current,
      run({ id: 'a', date: '2026-06-20' }),
      run({ id: 'b', date: '2026-06-17' }),
      run({ id: 'old', date: '2026-06-01' }),
    ]

    expect(runHistory(current, activities)).toMatchObject({ runsInPast7Days: 3, daysSinceLastRun: 2 })
  })
})

describe('effortStanding with official race results', () => {
  const remichOfficial = {
    activityId: 'remich', eventName: 'Wine Route Remich', date: '2025-09-28',
    distanceMeters: 5_000, chipTimeSeconds: 1_242, overallPlace: 63, finisherCount: 512,
  }
  const escherOfficial = {
    activityId: 'escher', eventName: 'Escher Kulturlaf', date: '2026-09-05',
    distanceMeters: 5_000, chipTimeSeconds: 1_292, overallPlace: 28, finisherCount: 188,
  }

  const older = run({ id: 'older', date: '2025-06-01', bestEfforts: { '5k': 1_400 } })
  const remich = run({ id: 'remich', date: '2025-09-28', type: 'Race', bestEfforts: { '5k': 1238.1 } })
  const escher = run({ id: 'escher', date: '2026-09-05', type: 'Race', bestEfforts: { '5k': 1237.6 } })
  const history = [older, remich, escher]

  it('reads the over-read device split as an all-time best without the official results', () => {
    expect(runHistory(escher, history).standing).toEqual({ label: '5K', daysSinceBetter: null })
  })

  it('stops crediting Escher with a benchmark it did not run', () => {
    expect(runHistory(escher, history, [escherOfficial, remichOfficial]).standing).not.toEqual({
      label: '5K',
      daysSinceBetter: null,
    })
  })

  it('places Escher behind the faster certified run that already stood', () => {
    const standing = runHistory(escher, history, [escherOfficial, remichOfficial]).standing

    expect(standing?.label).toBe('5K')
    expect(standing?.daysSinceBetter).toBe(342)
  })

  it('still credits Remich, whose certified time is the standing best', () => {
    expect(runHistory(remich, history, [escherOfficial, remichOfficial]).standing).toEqual({
      label: '5K',
      daysSinceBetter: null,
    })
  })

  it('leaves a run with no official result on its device efforts', () => {
    const tempo = run({ id: 'tempo', date: '2026-09-04', bestEfforts: { '5k': 1_500 } })

    expect(runHistory(tempo, [...history, tempo], [escherOfficial, remichOfficial]).standing)
      .toEqual(runHistory(tempo, [...history, tempo]).standing)
  })
})

describe('previousSession', () => {
  const reps = (count: number, seconds: number, pace: number, hr: number) =>
    Array.from({ length: count }, () => ({ type: 'interval_active', durationSec: seconds, distanceM: (seconds / pace) * 1000, avgSpeedMs: 0, avgHr: hr, laps: [] }))
  const session = (id: string, date: string, splits: unknown[], type: Activity['type'] = 'Threshold') =>
    run({ id, date, type, splits } as Partial<Activity> & { id: string; date: string })

  it('reads the last session of the same type rep for rep', () => {
    const current = session('c', '2026-09-29', reps(3, 435, 265, 172))
    const before = [session('a', '2026-09-16', reps(3, 400, 268, 175)), session('b', '2026-09-23', reps(3, 420, 265, 174))]

    expect(runHistory(current, [current, ...before]).previousSession).toEqual({ reps: 3, secondsPerRep: 420, paceSecPerKm: 265, avgHr: 174, daysAgo: 6 })
  })

  it('has none for an easy run, a session of another type, or one without reps', () => {
    const easy = run({ id: 'e', date: '2026-09-29' })
    const current = session('c', '2026-09-29', reps(3, 435, 265, 172))
    const tempo = session('t', '2026-09-23', reps(3, 420, 280, 165), 'Tempo')

    expect(runHistory(easy, [easy, session('a', '2026-09-23', reps(3, 420, 265, 174))]).previousSession).toBeNull()
    expect(runHistory(current, [current, tempo]).previousSession).toBeNull()
    expect(runHistory(session('n', '2026-09-29', []), [current]).previousSession).toBeNull()
  })
})

describe('longest', () => {
  it('finds the longest run of the last 90 days, and how far back one as long as this goes', () => {
    const current = run({ id: 'c', date: '2026-09-27', distanceKm: 14 })
    const history = [
      current,
      run({ id: 'a', date: '2026-09-13', distanceKm: 12.7 }),
      run({ id: 'b', date: '2026-09-20', distanceKm: 11.5 }),
      run({ id: 'old', date: '2026-05-24', distanceKm: 21.1 }),
    ]

    expect(runHistory(current, history).longest).toEqual({ km: 12.7, daysAgo: 14, daysSinceAsLong: 126 })
  })

  it('leaves races out: a half marathon raced is no long run to measure one against', () => {
    const current = run({ id: 'c', date: '2026-09-27', distanceKm: 14 })
    const history = [current, run({ id: 'a', date: '2026-09-13', distanceKm: 12.7 }), run({ id: 'r', date: '2026-08-16', type: 'Race', distanceKm: 21.1 })]

    expect(runHistory(current, history).longest).toEqual({ km: 12.7, daysAgo: 14, daysSinceAsLong: null })
  })

  it('has no longest without a run in the last 90 days, and no run as long when none was', () => {
    const current = run({ id: 'c', date: '2026-09-27', distanceKm: 14 })

    expect(runHistory(current, [current, run({ id: 'old', date: '2026-05-24', distanceKm: 21.1 })]).longest).toBeNull()
    expect(runHistory(current, [current, run({ id: 'a', date: '2026-09-13' })]).longest?.daysSinceAsLong).toBeNull()
  })
})
