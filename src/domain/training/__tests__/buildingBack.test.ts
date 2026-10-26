import { describe, expect, it } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import { acwr, classify } from '@/application/usecases/GetTrainingStatus'
import { buildingBack, firstRunBack, REBUILD_DAYS } from '../buildingBack'
import { loadSeries } from '../loadSeries'
import { verdictTone } from '../readiness'
import type { TrainingStatus } from '../status'
import { LOAD_TREND_DAYS } from '../status'
import { addDays, isoDate } from '@/lib/calendarDate'

const day = (from: string, n: number) => isoDate(addDays(new Date(`${from}T00:00:00`), n))

function runDays(from: string, weeks: number, weekdayOffsets: number[]): string[] {
  return Array.from({ length: weeks }, (_, w) => weekdayOffsets.map((d) => day(from, w * 7 + d))).flat()
}

describe('firstRunBack', () => {
  it('finds the run that reopened the most recent long break', () => {
    expect(firstRunBack(['2026-02-01', '2026-02-03', '2026-10-01', '2026-10-03'])).toBe('2026-10-01')
  })

  it('ignores the rest days of a block that never stopped', () => {
    expect(firstRunBack(runDays('2026-09-02', 8, [0, 2, 5]))).toBeNull()
  })

  it('takes the latest break when there have been several', () => {
    expect(firstRunBack(['2025-01-01', '2025-06-01', '2025-06-03', '2026-10-01'])).toBe('2026-10-01')
  })
})

describe('buildingBack', () => {
  const dates = ['2026-02-20', ...runDays('2026-10-01', 6, [0, 2, 4])]

  it('holds the reading for four weeks after the return', () => {
    expect(buildingBack(dates, '2026-10-01')).toBe(true)
    expect(buildingBack(dates, day('2026-10-01', REBUILD_DAYS - 1))).toBe(true)
  })

  it('lets it go once four weeks of running have followed', () => {
    expect(buildingBack(dates, day('2026-10-01', REBUILD_DAYS))).toBe(false)
  })

  it('holds nothing for an athlete who never stopped', () => {
    expect(buildingBack(runDays('2026-09-02', 8, [0, 2, 5]), '2026-10-26')).toBe(false)
  })
})

describe('the second athlete, replayed through the app formulas', () => {
  const TODAY = '2026-10-26'
  const BACK = '2026-10-01'
  const before = runDays('2025-09-03', 26, [0, 2, 5])
  const after = runDays(BACK, 4, [0, 2, 4]).filter((date) => date <= TODAY)
  const dates = [...before, ...after]
  const activities = dates.map((date) => ({ date, distanceKm: 3 }) as Activity)
  const series = loadSeries(new Map(dates.map((date) => [date, 45])), before[0]!, TODAY)
  const points = [...series.entries()]

  function reading(date: string) {
    const at = points.findIndex(([d]) => d === date)
    const now = points[at]![1]
    const ctlDelta = now.ctl - points[Math.max(0, at - LOAD_TREND_DAYS)]![1].ctl
    const upTo = activities.filter((a) => a.date <= date)
    return classify(now.ctl - now.atl, ctlDelta, acwr(upTo, new Date(`${date}T00:00:00`)))
  }

  it('calls the return overreaching, which is what the gate is for', () => {
    const judged = after.map((date) => reading(date))

    expect(judged.some((r) => r.status === 'overreaching' || r.risk === 'high')).toBe(true)
  })

  it('is building back on every day of the return, so none of that reaches the athlete', () => {
    expect(after.every((date) => buildingBack(dates, date))).toBe(true)
  })

  it('reads the week off before the return as a week off, not as a full acute week', () => {
    const upTo = activities.filter((a) => a.date <= '2026-03-05')

    expect(acwr(upTo, new Date('2026-03-05T00:00:00'))).toBeGreaterThan(0)
    expect(acwr(upTo, new Date('2026-03-19T00:00:00'))).toBeNull()
  })

  it('shows nothing to act on while the gate holds', () => {
    const held = { status: 'overreaching', risk: 'high', tsbNow: -40, atlDelta: 20, ctl: 10, buildingBack: true } as TrainingStatus

    expect(verdictTone(held)).toBe('build')
  })
})
