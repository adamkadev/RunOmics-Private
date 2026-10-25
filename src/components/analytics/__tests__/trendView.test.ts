import { describe, expect, it } from 'vitest'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import { dayWindow, type WeekRow } from '../analyticsView'
import { formLead, formRows, heartRateView, stepView } from '../trendView'

const window = dayWindow('2026-09-26', '12w')

describe('stepView', () => {
  it('starts from the reading in force at the window start and counts the change from it', () => {
    const view = stepView(
      [
        { date: '2026-05-01', value: 270 },
        { date: '2026-08-01', value: 265 },
        { date: '2026-09-10', value: 261 },
        { date: '2026-10-01', value: 250 },
      ],
      window,
    )
    expect(view).toEqual({
      now: 261,
      delta: -9,
      since: window.start,
      points: [
        { date: window.start, value: 270 },
        { date: '2026-08-01', value: 265 },
        { date: '2026-09-10', value: 261 },
      ],
    })
  })

  it('counts from the first reading inside when none came before, and has no change with one', () => {
    expect(stepView([{ date: '2026-09-10', value: 179 }], window)).toMatchObject({ now: 179, delta: null, since: '2026-09-10' })
    expect(stepView([{ date: '2026-10-01', value: 179 }], window)).toBeNull()
  })
})

const week = (over: Partial<WeeklyTrendPoint>) => ({ cadenceSpm: null, groundContactMs: null, verticalOscillationMm: null, verticalRatioPct: null, strideLengthM: null, ...over }) as WeeklyTrendPoint

describe('formRows', () => {
  it('keeps only what the watch measured, and leads with the biggest move for its metric', () => {
    const wrist = [week({ cadenceSpm: 170 }), week({ cadenceSpm: 171 }), week({ cadenceSpm: 172 }), week({ cadenceSpm: 174 })]
    const rows = formRows(wrist)
    expect(rows.map((r) => r.metric)).toEqual(['cadence'])
    expect(formLead(rows)).toMatchObject({ metric: 'cadence', delta: 2.5 })

    const pod = wrist.map((w, i) => ({ ...w, cadenceSpm: 170, groundContactMs: 250 - i * 4, strideLengthM: 1.2 }))
    expect(formLead(formRows(pod))?.metric).toBe('groundContact')
    expect(formLead(formRows(pod.map((w) => ({ ...w, groundContactMs: 250 }))))).toBeNull()
  })
})

const row = (easyAvgHr: number | null, hardAvgHr: number | null = null, apparentTempC: number | null = null): WeekRow =>
  ({ week: '2026-09-21', km: 0, planKm: null, current: false, point: { easyAvgHr, hardAvgHr, apparentTempC } as WeeklyTrendPoint })

describe('heartRateView', () => {
  it('reads the easy heart rate down, up or flat past two beats', () => {
    expect(heartRateView([row(152), row(151), row(149), row(148)])?.trend).toBe('down')
    expect(heartRateView([row(146), row(147), row(149), row(150)])?.trend).toBe('up')
    expect(heartRateView([row(150), row(149), row(150), row(151)])?.trend).toBe('flat')
  })

  it('is absent without two heart rates to draw', () => {
    expect(heartRateView([row(null, null, 18), row(150)])).toBeNull()
  })
})
