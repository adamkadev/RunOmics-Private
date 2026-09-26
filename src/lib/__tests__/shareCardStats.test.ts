import { describe, expect, it } from 'vitest'
import { shareCardSubtitle, shareStats, shareZones, type ShareActivity } from '@/lib/shareCardStats'
import { formatDate } from '@/lib/formatters'

const RUN: ShareActivity = {
  id: '1',
  date: '2026-09-26',
  dayOfWeek: 'Saturday',
  description: 'Strides 6 × 20s',
  distanceKm: 10.02,
  durationSeconds: 3453,
  paceSecPerKm: 344,
  avgHeartRate: 153,
  elevationGain: 40,
  route: null,
  paceSamples: null,
  hrZones: [
    { zone: 1, seconds: 240, percent: 7, minBpm: 100, maxBpm: 120 },
    { zone: 2, seconds: 2460, percent: 71, minBpm: 120, maxBpm: 140 },
    { zone: 3, seconds: 480, percent: 14, minBpm: 140, maxBpm: 155 },
    { zone: 4, seconds: 180, percent: 5, minBpm: 155, maxBpm: 170 },
    { zone: 5, seconds: 60, percent: 2, minBpm: 170, maxBpm: null },
  ],
}

describe('shareStats', () => {
  it('reads Distance, Pace, Avg HR, Time, units apart from the values', () => {
    expect(shareStats(RUN)).toEqual([
      { value: '10.0', unit: ' km', label: 'Distance' },
      { value: '5:44', unit: ' /km', label: 'Pace' },
      { value: '153', unit: ' bpm', label: 'Avg HR' },
      { value: '57:33', unit: '', label: 'Time' },
    ])
  })

  it('leaves out what the run did not record', () => {
    const labels = shareStats({ ...RUN, avgHeartRate: null, paceSecPerKm: null }).map((s) => s.label)
    expect(labels).toEqual(['Distance', 'Time'])
  })
})

describe('shareZones', () => {
  it('draws Z1-Z5 against the longest zone and names it with its share', () => {
    const zones = shareZones(RUN)!
    expect(zones.rows.map((r) => r.zone)).toEqual([1, 2, 3, 4, 5])
    expect(zones.rows[1]!.fill).toBe(1)
    expect(zones.rows[0]!.fill).toBeCloseTo(240 / 2460)
    expect(zones.top).toEqual({ zone: 2, percent: 72 })
  })

  it('keeps a zone the run never reached, at zero', () => {
    const zones = shareZones({ ...RUN, hrZones: RUN.hrZones.filter((z) => z.zone !== 5) })!
    expect(zones.rows[4]).toEqual({ zone: 5, seconds: 0, fill: 0 })
  })

  it('is null without heart rate', () => {
    expect(shareZones({ ...RUN, hrZones: [] })).toBeNull()
  })
})

describe('shareCardSubtitle', () => {
  it('is the app date, then the town', () => {
    expect(shareCardSubtitle(RUN, 'Hoenheim')).toBe(`${formatDate('2026-09-26')} · Hoenheim`)
    expect(shareCardSubtitle(RUN, null)).toBe(formatDate('2026-09-26'))
  })
})
