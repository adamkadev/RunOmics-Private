import { describe, expect, it } from 'vitest'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import type { WeekRow } from '../analyticsView'
import { formLead, formRows, heartRateView } from '../trendView'

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
