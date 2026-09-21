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
