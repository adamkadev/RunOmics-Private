import { describe, expect, it } from 'vitest'
import {
  mergeSlivers, percentsTo100, repLength, zoneName, zoneTint, shareCardSubtitle, shareCardTitle, shareRepHeadline, shareRepHero, shareRepResult, shareStats, shareZones, type ShareActivity, shareRepDetail,
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
      { key: 'distance', value: '10.0', unit: ' km', label: 'Distance' },
      { key: 'time', value: '57:33', unit: '', label: 'Time' },
      { key: 'pace', value: '5:44', unit: ' /km', label: 'Pace' },
      { key: 'hr', value: '153', unit: ' bpm', label: 'Avg HR' },
    ])
  })

  // To the minute, as the activity page writes it.
  it('writes an hour-long run as h:mm, not to the second', () => {
    expect(shareStats({ ...RUN, durationSeconds: 3999 })[1]).toEqual({ key: 'time', value: '1:07', unit: ' h', label: 'Time' })
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
      { zone: 2, from: 1, percent: 79 }, { zone: 3, percent: 14 }, { zone: 5, from: 4, percent: 7, tint: 4 },
    ])
    expect(zones.rows.map(zoneName)).toEqual(['Z1–Z2', 'Z3', 'Z4–Z5'])
  })

  it('merges a zone under 5% into its neighbour, which keeps its colour', () => {
    expect(mergeSlivers([{ zone: 2, from: 1, percent: 32 }, { zone: 3, percent: 64 }, { zone: 4, percent: 4 }])).toEqual([
      { zone: 2, from: 1, percent: 32 }, { zone: 4, from: 3, percent: 68, tint: 3 },
    ])
    expect(mergeSlivers([{ zone: 2, from: 1, percent: 3 }, { zone: 3, percent: 97 }])).toEqual([{ zone: 3, from: 1, percent: 100 }])
    expect(mergeSlivers([{ zone: 2, from: 1, percent: 50 }, { zone: 3, percent: 2 }, { zone: 4, percent: 48 }])).toEqual([
      { zone: 2, from: 1, percent: 50 }, { zone: 4, from: 3, percent: 50 },
    ])
    expect(zoneTint({ zone: 4, tint: 3 })).toBe(3)
  })

  it('keeps a lone hard sliver apart from the easy row', () => {
    expect(mergeSlivers([{ zone: 2, from: 1, percent: 97 }, { zone: 3, percent: 1 }, { zone: 4, percent: 1 }, { zone: 5, percent: 1 }])).toEqual([
      { zone: 2, from: 1, percent: 97 }, { zone: 5, from: 3, percent: 3 },
    ])
  })

  it('heads an easy session that ran mostly harder with that zone, merged as its legend row', () => {
    const footing = { ...RUN, type: 'Base' as const, hrZones: [300, 900, 2400, 150, 0].map((sec, i) => ({ ...RUN.hrZones[i]!, seconds: sec })) }
    expect(shareZones(footing)!.headline).toEqual({ percent: 68, label: 'in Z3–Z4' })
  })

  it('rounds once, to the total, and heads with the rows\' own sum', () => {
    const at = (shares: number[]) => ({ ...RUN, type: 'Base' as const, hrZones: shares.map((sec, i) => ({ ...RUN.hrZones[i]!, seconds: sec })) })
    const zones = shareZones(at([96, 766, 96, 42, 0]))!
    expect(zones.rows.map((r) => r.percent)).toEqual([86, 14])
    expect(zones.headline.percent).toBe(86)

    // Any split: the rows sum to 100, and the headline is their Z1 + Z2.
    let seed = 7
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let n = 0; n < 20; n++) {
      const sample = shareZones(at([0, 0, 0, 0, 0].map(() => Math.round(random() * 3000))))
      if (!sample) continue
      const shown = sample.rows.reduce((sum, r) => sum + r.percent, 0)
      expect(shown).toBe(100)
      const easy = sample.rows.find((r) => zoneTint(r) <= 2)?.percent ?? 0
      if (!sample.headline.label.startsWith('easy')) continue
      expect(sample.headline.percent).toBeLessThanOrEqual(easy)
      expect(sample.headline.percent).toBeGreaterThan(easy - 5)
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

  it('heads an easy run with its time in Z1-Z2, a threshold session with its time in Z4 and the sliver its legend merged', () => {
    expect(shareZones({ ...RUN, type: 'Base' })!.headline).toEqual({ percent: 79, label: 'easy · Z1–Z2' })
    expect(shareZones({ ...RUN, type: 'Threshold' })!.headline).toEqual({ percent: 7, label: 'in Z4–Z5' })
  })

  it('heads a session that never reached its zone with the hardest zone it did, never 0%', () => {
    const missed = { ...RUN, type: 'Threshold' as const, hrZones: [600, 1300, 1600, 0, 0].map((sec, i) => ({ ...RUN.hrZones[i]!, seconds: sec })) }
    expect(shareZones(missed)!.headline).toEqual({ percent: 46, label: 'in Z3' })
  })

  it('heads a run of no known kind with its main zone', () => {
    expect(shareZones(RUN)!.headline).toEqual({ percent: 79, label: 'in Z1–Z2' })
  })

  it('is null without heart rate', () => {
    expect(shareZones({ ...RUN, hrZones: [] })).toBeNull()
  })
})

const REPS = { count: 3, repSeconds: 480, paceSecPerKm: 264, paces: [262, 264, 266], target: { min: 265, max: 265 }, windows: [] }

describe('an interval session (design review, Oct 2026)', () => {
  it('takes the coach\'s name for the session, else the run\'s', () => {
    expect(shareCardTitle({ ...RUN, sessionTitle: 'Footing 40′' })).toBe('Footing 40′')
    expect(shareCardTitle({ ...RUN, sessionTitle: '  ' })).toBe('Strides 6 × 20s')
  })

  it('titles a run by its session\'s name, without the plan\'s distance', () => {
    expect(shareCardTitle({ ...RUN, distanceKm: 7.5, sessionTitle: 'Easy · 7.5 km + 6 strides' })).toBe('Easy run + 6 strides')
    expect(shareCardTitle({ ...RUN, distanceKm: 7.5, description: 'Easy · 6 km' })).toBe('Easy run')
  })

  it('leads with the reps\' pace, the plan\'s, and how far off it ran', () => {
    expect(shareRepHero({ ...RUN, reps: REPS })).toEqual({ eyebrow: 'Rep pace', pace: '4:24', unit: '/km', target: 'target 4:25 · −1 s' })
    // Inside the band: the target alone, with nothing to answer for.
    expect(shareRepHero({ ...RUN, reps: { ...REPS, target: { min: 260, max: 270 } } })!.target).toBe('target 4:20–4:30')
    expect(shareRepHero({ ...RUN, reps: { ...REPS, paceSecPerKm: 275, target: { min: 260, max: 270 } } })!.target).toBe('target 4:20–4:30 · +5 s')
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

  it('keeps four reps as chips, numbered short to fit the row', () => {
    expect(shareRepDetail({ ...RUN, reps: { ...REPS, count: 4, paces: [261, 263, 262, 262] } })).toEqual({
      kind: 'chips',
      chips: [
        { label: '#1', pace: '4:21' },
        { label: '#2', pace: '4:23' },
        { label: '#3', pace: '4:22' },
        { label: '#4', pace: '4:22' },
      ],
    })
  })

  it('draws reps a few seconds apart as bars of nearly one height', () => {
    const close = shareRepDetail({ ...RUN, reps: { ...REPS, count: 5, paces: [261, 263, 262, 262, 261] } })
    if (close?.kind !== 'bars') throw new Error('expected bars')
    expect(Math.min(...close.bars)).toBeGreaterThan(0.8)
    expect(Math.max(...close.bars)).toBe(1)
  })

  it('titles a rep session by its set and its pace, its type leading the subtitle', () => {
    const run = { ...RUN, type: 'Threshold' as const, reps: REPS, sessionTitle: 'Threshold · 3 × 8′ @ 4:25' }
    expect(shareCardTitle(run)).toBe('3 × 8′ @ 4:25')
    expect(shareCardTitle({ ...run, sessionTitle: null })).toBe('3 × 8′')
    expect(shareCardSubtitle(run, 'Hoenheim')).toBe(`Threshold · ${formatDate('2026-09-26')} · Hoenheim`)
    expect(shareCardSubtitle({ ...RUN, type: 'Threshold' }, 'Hoenheim')).toBe(`${formatDate('2026-09-26')} · Hoenheim`)
  })

  it('gives a set named after its type the same structure without reps: the set, then type · date · place', () => {
    const runWalk = { ...RUN, type: 'Base' as const, sessionTitle: 'Footing · 4 × 6′' }
    expect(shareCardTitle(runWalk)).toBe('4 × 6′')
    expect(shareCardSubtitle(runWalk, 'Hoenheim')).toBe(`Footing · ${formatDate('2026-09-26')} · Hoenheim`)
    expect(shareCardTitle({ ...RUN, sessionTitle: 'Threshold · 3 × 8′ @ 4:25' })).toBe('3 × 8′ @ 4:25')
    expect(shareCardTitle(RUN)).toBe('Strides 6 × 20s')
    expect(shareCardSubtitle(RUN, null)).toBe(formatDate('2026-09-26'))
  })

  it('leads the Stats card with the rep pace, captioned with the target', () => {
    expect(shareRepHeadline({ ...RUN, reps: REPS })).toEqual({ pace: '4:24', unit: '/km', caption: 'Reps · target 4:25' })
    expect(shareRepHeadline({ ...RUN, reps: { ...REPS, target: null } })!.caption).toBe('Reps')
    expect(shareRepHeadline(RUN)).toBeNull()
  })

  it('drops the average pace, which describes neither the reps nor the recoveries', () => {
    expect(shareStats({ ...RUN, reps: REPS }).map((s) => s.label)).toEqual(['Distance', 'Time', 'Avg HR'])
  })

  it('leads the Route card\'s row with the rep pace, then Distance, Time and Avg HR', () => {
    expect(shareStats({ ...RUN, reps: REPS }, { repPace: true }).map((s) => [s.label, s.value])).toEqual([
      ['Rep pace', '4:24'], ['Distance', '10.0'], ['Time', '57:33'], ['Avg HR', '153'],
    ])
    expect(shareStats(RUN, { repPace: true }).map((s) => s.key)).toEqual(['distance', 'time', 'pace', 'hr'])
  })

  it('says how far off the target the reps ran, in seconds per km, or that they were on it', () => {
    expect(shareRepResult({ ...RUN, reps: { ...REPS, paceSecPerKm: 256 } })).toBe('Reps 9 s/km faster than target')
    expect(shareRepResult({ ...RUN, reps: { ...REPS, paceSecPerKm: 275, target: { min: 260, max: 270 } } })).toBeNull()
    expect(shareRepResult({ ...RUN, reps: { ...REPS, target: { min: 260, max: 270 } } })).toBe('On target')
    expect(shareRepResult({ ...RUN, reps: { ...REPS, target: null } })).toBeNull()
    expect(shareRepResult(RUN)).toBeNull()
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
