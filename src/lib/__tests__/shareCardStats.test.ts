import { describe, expect, it } from 'vitest'
import {
  hrAtFraction, repLength, shareCardSubtitle, shareCardTitle, shareRepHero, shareStats, shareZones, zoneOfHr,
  type ShareActivity,
} from '@/lib/shareCardStats'
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
  it('rows the zones the run spent time in, Z1 first, each its share of the whole run', () => {
    const zones = shareZones(RUN)!
    expect(zones.rows.map((r) => r.zone)).toEqual([1, 2, 3, 4, 5])
    expect(zones.rows[1]!.share).toBeCloseTo(2460 / 3420)
    expect(zones.totalSeconds).toBe(3420)
  })

  // Design review, Oct 2026: only zones with time, and a bar is the percentage.
  it('leaves out a zone of under a minute', () => {
    const zones = shareZones({ ...RUN, hrZones: RUN.hrZones.map((z) => (z.zone === 5 ? { ...z, seconds: 20 } : z)) })!
    expect(zones.rows.map((r) => r.zone)).toEqual([1, 2, 3, 4])
  })

  it('heads an easy run with its time in Z1-Z2, a threshold session with its time in Z4', () => {
    expect(shareZones({ ...RUN, type: 'Base' })!.headline).toEqual({ percent: 79, label: 'easy · Z1–Z2' })
    expect(shareZones({ ...RUN, type: 'Threshold' })!.headline).toEqual({ percent: 5, label: 'in Z4' })
  })

  it('heads a run of no known kind with its main zone', () => {
    expect(shareZones(RUN)!.headline).toEqual({ percent: 72, label: 'in Z2' })
  })

  it('is null without heart rate', () => {
    expect(shareZones({ ...RUN, hrZones: [] })).toBeNull()
  })
})

const REPS = { count: 3, repSeconds: 480, paceSecPerKm: 264, target: { min: 265, max: 265 } }

describe('an interval session (design review, Oct 2026)', () => {
  it('takes the coach\'s name for the session, else the run\'s', () => {
    expect(shareCardTitle({ ...RUN, sessionTitle: 'Threshold · 3 × 8′ @ 4:25' })).toBe('Threshold · 3 × 8′ @ 4:25')
    expect(shareCardTitle({ ...RUN, sessionTitle: '  ' })).toBe('Strides 6 × 20s')
  })

  it('leads with the reps\' pace and the plan\'s', () => {
    expect(shareRepHero({ ...RUN, reps: REPS })).toEqual({ eyebrow: 'Rep pace · 3 × 8′', pace: '4:24', detail: '/km · target 4:25' })
    expect(shareRepHero({ ...RUN, reps: { ...REPS, target: { min: 260, max: 270 } } })!.detail).toBe('/km · target 4:20–4:30')
    expect(shareRepHero({ ...RUN, reps: { ...REPS, target: null } })!.detail).toBe('/km')
    expect(shareRepHero(RUN)).toBeNull()
  })

  it('drops the average pace, which describes neither the reps nor the recoveries', () => {
    expect(shareStats({ ...RUN, reps: REPS }).map((s) => s.label)).toEqual(['Distance', 'Time', 'Avg HR'])
  })

  it('writes a rep in minutes, or seconds under one', () => {
    expect(repLength(480)).toBe('8′')
    expect(repLength(45)).toBe('45″')
  })
})

describe('the route\'s heart rate', () => {
  it('reads the zone off the run\'s own floors', () => {
    expect(zoneOfHr(130, RUN.hrZones)).toBe(2)
    expect(zoneOfHr(175, RUN.hrZones)).toBe(5)
    expect(zoneOfHr(90, RUN.hrZones)).toBe(1)
    expect(zoneOfHr(130, [])).toBeNull()
  })

  it('reads the stream at the same share of its length', () => {
    expect(hrAtFraction([100, 120, 140], 0.5)).toBe(120)
    expect(hrAtFraction([100, 120, 140], 1)).toBe(140)
    expect(hrAtFraction([], 0.5)).toBeNull()
  })
})

describe('shareCardSubtitle', () => {
  it('is the app date, then the town', () => {
    expect(shareCardSubtitle(RUN, 'Hoenheim')).toBe(`${formatDate('2026-09-26')} · Hoenheim`)
    expect(shareCardSubtitle(RUN, null)).toBe(formatDate('2026-09-26'))
  })
})
