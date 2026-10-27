import { describe, expect, it } from 'vitest'
import { seriesFreshness } from '../seriesFreshness'

const NOW = Date.parse('2026-10-27T08:00:00Z')
const of = (rows: ReturnType<typeof seriesFreshness>, series: string) => rows.find((row) => row.series === series)

describe('seriesFreshness', () => {
  it('marks a daily series stale after three days without a sample, and says since when', () => {
    const rows = seriesFreshness({ trainingStatus: '2026-10-20', restingHr: '2026-10-26' }, NOW)

    expect(of(rows, 'trainingStatus')).toEqual({ series: 'trainingStatus', newest: '2026-10-20', ageDays: 7, stale: true })
    expect(of(rows, 'restingHr')).toMatchObject({ ageDays: 1, stale: false })
  })

  it('gives a slower series more time', () => {
    const rows = seriesFreshness({ racePredictions: '2026-10-17', vo2max: '2026-10-01' }, NOW)

    expect(of(rows, 'racePredictions')?.stale).toBe(false)
    expect(of(rows, 'vo2max')?.stale).toBe(true)
  })

  it('never calls a series stale that the watch has never filled, or the threshold Garmin moves only on a change', () => {
    const rows = seriesFreshness({ trainingStatus: null, threshold: '2025-01-01' }, NOW)

    expect(of(rows, 'trainingStatus')).toEqual({ series: 'trainingStatus', newest: null, ageDays: null, stale: false })
    expect(of(rows, 'loadBalance')?.newest).toBeNull()
    expect(of(rows, 'threshold')?.stale).toBe(false)
  })
})
