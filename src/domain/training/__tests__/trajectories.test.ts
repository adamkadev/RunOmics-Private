import { describe, expect, it } from 'vitest'
import { ctlTrajectory, metricTrajectory } from '../trajectories'

const REFERENCE = '2026-09-24'

/** Adam's threshold detections: 4:12/km in April, 4:23/km after two absences. */
const THRESHOLD = [
  { date: '2026-03-15', value: 254 },
  { date: '2026-04-04', value: 252 },
  { date: '2026-05-17', value: 252 },
  { date: '2026-07-14', value: 257 },
  { date: '2026-09-04', value: 267 },
  { date: '2026-09-17', value: 263 },
]

describe('metricTrajectory', () => {
  it('reports how far a pace sits from its own recent best', () => {
    const trajectory = metricTrajectory(THRESHOLD, REFERENCE, true)

    expect(trajectory.current).toBe(263)
    expect(trajectory.best).toBe(252)
    expect(trajectory.bestDate).toBe('2026-04-04')
    // 263 against 252 is 4.4% slower: the number that says "rebuilding".
    expect(trajectory.offBestPct).toBeCloseTo(4.4, 1)
  })

  it('knows a higher score is better while a lower pace is', () => {
    const vo2max = [{ date: '2026-04-29', value: 57.1 }, { date: '2026-09-23', value: 54.6 }]

    expect(metricTrajectory(vo2max, REFERENCE, false).best).toBe(57.1)
    expect(metricTrajectory(vo2max, REFERENCE, true).best).toBe(54.6)
  })

  it('states the gap as a positive distance whichever direction better is', () => {
    const improving = [{ date: '2026-08-01', value: 270 }, { date: '2026-09-01', value: 250 }]
    const trajectory = metricTrajectory(improving, REFERENCE, true)

    expect(trajectory.current).toBe(250)
    expect(trajectory.best).toBe(250)
    expect(trajectory.offBestPct).toBe(0)
  })

  it('thins the series to one point a month and keeps the last of each', () => {
    const noisy = [
      { date: '2026-09-04', value: 267 },
      { date: '2026-09-17', value: 263 },
      { date: '2026-08-02', value: 259 },
    ]

    expect(metricTrajectory(noisy, REFERENCE, true).points).toEqual([
      { date: '2026-08-02', value: 259 },
      { date: '2026-09-17', value: 263 },
    ])
  })

  it('drops readings older than the window and says nothing when none remain', () => {
    const stale = [{ date: '2024-01-01', value: 240 }]
    const trajectory = metricTrajectory(stale, REFERENCE, true)

    expect(trajectory.current).toBeNull()
    expect(trajectory.offBestPct).toBeNull()
    expect(trajectory.points).toEqual([])
  })
})

describe('ctlTrajectory', () => {
  const series = new Map<string, { ctl: number }>()
  const km = new Map<string, number>()
  // The shape Adam's own season has: a build to a peak, a fortnight lost, and
  // a rebuild that has not got back to where it was.
  const WEEKLY_CTL = [40, 43, 46, 49, 52, 55, 58, 61, 52, 44, 48, 54]
  WEEKLY_CTL.forEach((ctl, week) => {
    const away = week === 8 || week === 9
    for (let day = 0; day < 7; day++) {
      const date = new Date(Date.parse('2026-07-06T00:00:00Z') + (week * 7 + day) * 86_400_000)
        .toISOString().slice(0, 10)
      series.set(date, { ctl })
      if (!away) km.set(date, 7)
    }
  })

  it('leaves the weeks with no running in the series, showing zero', () => {
    const trajectory = ctlTrajectory(series, km, '2026-09-27')
    const empty = trajectory.weeks.filter((week) => week.km === 0)

    // Averaging over an interruption makes a month lost to travel look like reduced capacity.
    expect(empty).toHaveLength(2)
    expect(empty.map((week) => week.weekStart)).toEqual(['2026-08-31', '2026-09-07'])
  })

  it('measures the current level against the peak of the window', () => {
    const trajectory = ctlTrajectory(series, km, '2026-09-27')

    expect(trajectory.peak).toBeGreaterThan(trajectory.current!)
    expect(trajectory.offPeakPct).toBeGreaterThan(0)
  })

  it('says nothing when the window holds no load at all', () => {
    expect(ctlTrajectory(new Map(), new Map(), REFERENCE)).toEqual({
      current: null, peak: null, peakDate: null, offPeakPct: null, weeks: [],
    })
  })
})
