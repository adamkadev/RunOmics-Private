import { describe, expect, it } from 'vitest'
import {
  percentsTo100, repLength, zoneName, shareCardSubtitle, shareCardTitle, shareRepHero, shareStats, shareZones, type ShareActivity, shareRepDetail, shareStructure,
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
  hrZones: [
    { zone: 1, seconds: 240, percent: 7, minBpm: 100, maxBpm: 120 },
    { zone: 2, seconds: 2460, percent: 71, minBpm: 120, maxBpm: 140 },
    { zone: 3, seconds: 480, percent: 14, minBpm: 140, maxBpm: 155 },
    { zone: 4, seconds: 180, percent: 5, minBpm: 155, maxBpm: 170 },
    { zone: 5, seconds: 60, percent: 2, minBpm: 170, maxBpm: null },
  ],
}

describe('shareStats', () => {
  // The activity page's order: one order everywhere.
  it('reads Distance, Time, Pace, Avg HR, units apart from the values', () => {
    expect(shareStats(RUN)).toEqual([
      { value: '10.0', unit: ' km', label: 'Distance' },
      { value: '57:33', unit: ' min', label: 'Time' },
      { value: '5:44', unit: ' /km', label: 'Pace' },
      { value: '153', unit: ' bpm', label: 'Avg HR' },
    ])
  })

  // To the minute, as the activity page writes it.
  it('writes an hour-long run as h:mm, not to the second', () => {
    expect(shareStats({ ...RUN, durationSeconds: 3999 })[1]).toEqual({ value: '1:07', unit: ' h', label: 'Time' })
  })

  it('leaves out what the run did not record', () => {
    const labels = shareStats({ ...RUN, avgHeartRate: null, paceSecPerKm: null }).map((s) => s.label)
    expect(labels).toEqual(['Distance', 'Time'])
  })
})

describe('shareZones', () => {
  // Z1 and Z2 share a row, so the Stats card's legend takes two lines, not three.
  it('rows the zones the run spent time in, Z1 and Z2 as one, in whole percents that sum to 100', () => {
    const zones = shareZones(RUN)!
    expect(zones.rows).toEqual([
      { zone: 2, from: 1, percent: 79 }, { zone: 3, percent: 14 }, { zone: 4, percent: 5 }, { zone: 5, percent: 2 },
    ])
    expect(zones.rows.map(zoneName)).toEqual(['Z1–Z2', 'Z3', 'Z4', 'Z5'])
  })

  it('rounds once, to the total, and heads with the rows\' own sum', () => {
    const at = (shares: number[]) => ({ ...RUN, type: 'Base' as const, hrZones: shares.map((sec, i) => ({ ...RUN.hrZones[i]!, seconds: sec })) })
    const zones = shareZones(at([96, 766, 96, 42, 0]))!
    // 10 / 76 / 10 / 4, and 86% easy.
    expect(zones.rows.map((r) => r.percent)).toEqual([86, 10, 4])
    expect(zones.headline.percent).toBe(86)

    // Any split: the rows sum to 100, and the headline is their Z1 + Z2.
    let seed = 7
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let n = 0; n < 20; n++) {
      const sample = shareZones(at([0, 0, 0, 0, 0].map(() => Math.round(random() * 3000))))
      if (!sample) continue
      const shown = sample.rows.reduce((sum, r) => sum + r.percent, 0)
      expect(shown).toBe(100)
      const easy = sample.rows.filter((r) => r.zone <= 2).reduce((sum, r) => sum + r.percent, 0)
      expect(sample.headline.percent).toBe(easy)
    }
  })

  it('leaves out a zone that rounds to nothing', () => {
    const zones = shareZones({ ...RUN, hrZones: RUN.hrZones.map((z) => (z.zone === 5 ? { ...z, seconds: 5 } : z)) })!
    expect(zones.rows.map((r) => r.zone)).toEqual([2, 3, 4])
    expect(zones.rows.reduce((sum, r) => sum + r.percent, 0)).toBe(100)
  })

  it('splits whole percents by largest remainder', () => {
    expect(percentsTo100([1, 1, 1])).toEqual([34, 33, 33])
    expect(percentsTo100([0, 0])).toEqual([0, 0])
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

const REPS = { count: 3, repSeconds: 480, paceSecPerKm: 264, paces: [262, 264, 266], target: { min: 265, max: 265 }, windows: [] }

describe('an interval session (design review, Oct 2026)', () => {
  it('takes the coach\'s name for the session, else the run\'s', () => {
    expect(shareCardTitle({ ...RUN, sessionTitle: 'Threshold · 3 × 8′ @ 4:25' })).toBe('Threshold · 3 × 8′ @ 4:25')
    expect(shareCardTitle({ ...RUN, sessionTitle: '  ' })).toBe('Strides 6 × 20s')
  })

  it('leads with the reps\' pace, the plan\'s, and how far off it ran', () => {
    expect(shareRepHero({ ...RUN, reps: REPS })).toEqual({ eyebrow: 'Rep pace · 3 × 8′', pace: '4:24', unit: '/km', target: 'target 4:25 · −0:01' })
    // Inside the band: the target alone, with nothing to answer for.
    expect(shareRepHero({ ...RUN, reps: { ...REPS, target: { min: 260, max: 270 } } })!.target).toBe('target 4:20–4:30')
    expect(shareRepHero({ ...RUN, reps: { ...REPS, paceSecPerKm: 275, target: { min: 260, max: 270 } } })!.target).toBe('target 4:20–4:30 · +0:05')
    expect(shareRepHero({ ...RUN, reps: { ...REPS, target: null } })!.target).toBeNull()
    expect(shareRepHero(RUN)).toBeNull()
  })

  // Up to three reps that differ read as chips, more as bars, identical ones say nothing.
  it('reads the reps as chips, as bars, or not at all', () => {
    expect(shareRepDetail({ ...RUN, reps: REPS })).toEqual({
      kind: 'chips',
      chips: [
        { label: 'Rep 1', pace: '4:22' },
        { label: 'Rep 2', pace: '4:24' },
        { label: 'Rep 3', pace: '4:26' },
      ],
    })
    const many = shareRepDetail({ ...RUN, reps: { ...REPS, count: 5, paces: [260, 265, 270, 262, 268] } })
    expect(many?.kind).toBe('bars')
    if (many?.kind !== 'bars') throw new Error('expected bars')
    expect(many.bars).toHaveLength(5)
    expect(many.range).toBe('Fastest 4:20 · Slowest 4:30')
    expect(shareRepDetail({ ...RUN, reps: { ...REPS, paces: [264, 264, 264] } })).toBeNull()
    expect(shareRepDetail(RUN)).toBeNull()
  })

  it('titles a rep session by its type, its structure in the subtitle', () => {
    const run = { ...RUN, type: 'Threshold' as const, reps: REPS, sessionTitle: 'Threshold · 3 × 8′ @ 4:25' }
    expect(shareCardTitle(run)).toBe('Threshold')
    expect(shareStructure(run)).toBe('3 × 8′ @ 4:25')
    expect(shareStructure(RUN)).toBeNull()
  })

  it('drops the average pace, which describes neither the reps nor the recoveries', () => {
    expect(shareStats({ ...RUN, reps: REPS }).map((s) => s.label)).toEqual(['Distance', 'Time', 'Avg HR'])
  })

  it('writes a rep in minutes, or seconds under one', () => {
    expect(repLength(480)).toBe('8′')
    expect(repLength(45)).toBe('45″')
  })
})

describe('shareCardSubtitle', () => {
  it('is the app date, then the town', () => {
    expect(shareCardSubtitle(RUN, 'Hoenheim')).toBe(`${formatDate('2026-09-26')} · Hoenheim`)
    expect(shareCardSubtitle(RUN, null)).toBe(formatDate('2026-09-26'))
  })
})
