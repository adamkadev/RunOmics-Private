import { describe, expect, it } from 'vitest'
import { hrDistrust, withHrTrust, type HrTrust } from '../hrTrust'
import { aerobicDecoupling } from '../decoupling'
import { easyShare } from '../easyShare'
import { toActivitySummary } from '../summary'
import { easyHardShare } from '@/domain/training/easyHard'
import { efficiencyFactor } from '@/application/usecases/GetAnalyticsData'
import { dailyTrimpByDate } from '@/application/usecases/GetTrainingLoad'
import type { Activity } from '../types'

const TRUST: HrTrust = { reliableFrom: '2026-10-16', unreliableIds: new Set(['marked']) }

function run(id: string, date: string, overrides: Partial<Activity> = {}): Activity {
  return {
    id,
    date,
    week: 202642,
    dayOfWeek: 'Monday',
    type: 'Base',
    description: '',
    durationSeconds: 3600,
    distanceKm: 8,
    paceSecPerKm: 450,
    hrZones: [{ zone: 4, seconds: 3000, percent: 83, minBpm: 165, maxBpm: 175 }, { zone: 2, seconds: 600, percent: 17, minBpm: 130, maxBpm: 145 }],
    avgHeartRate: 172,
    rpe: 3,
    comment: '',
    route: null,
    elevationGain: null,
    aerTrainingEffect: null,
    anaTrainingEffect: null,
    hrSamples: [...Array(75).fill(150), ...Array(75).fill(175)],
    elevationProfile: null,
    calories: null,
    cadenceSpm: null,
    groundContactMs: null,
    verticalOscillationMm: null,
    verticalRatioPct: null,
    strideLengthM: null,
    bestEfforts: null,
    splits: [{ type: 'interval_active', durationSec: 300, distanceM: 700, avgSpeedMs: 2.3, avgHr: 176, laps: [{ durationSec: 150, distanceM: 350, avgSpeedMs: 2.3, avgHr: 178 }] }],
    paceSamples: Array(150).fill(450),
    vo2maxGarmin: null,
    avgTemperature: null,
    cadenceSamples: null,
    gearId: null,
    weather: null,
    ...overrides,
  }
}

const [beforeArmband, marked, onWrist, trusted] = withHrTrust([
  run('old', '2026-10-10', { hrSource: 'wrist' }),
  run('marked', '2026-10-20', { hrSource: 'external' }),
  run('wrist', '2026-10-21', { hrSource: 'wrist' }),
  run('armband', '2026-10-22', { hrSource: 'external' }),
], TRUST)
const untrusted = [beforeArmband!, marked!, onWrist!]

describe('hrDistrust', () => {
  it('names why a run is not trusted', () => {
    expect(untrusted.map((a) => a.hrUntrusted)).toEqual(['beforeReliable', 'marked', 'wrist'])
    expect(trusted!.hrUntrusted).toBeUndefined()
  })

  it('trusts every run of a profile with no reliable date and no marks', () => {
    expect(hrDistrust(run('a', '2020-01-01', { hrSource: 'wrist' }), { unreliableIds: new Set() })).toBeNull()
  })

  it('trusts a run without a recorded source after the reliable date, as before a reprocess', () => {
    expect(hrDistrust(run('a', '2026-10-20'), TRUST)).toBeNull()
  })
})

describe('an untrusted run', () => {
  it('loads from effort, not from its heart rate', () => {
    const load = dailyTrimpByDate(untrusted)
    expect(load.get('2026-10-10')).toBeCloseTo(3 * 60 * 0.42, 6)
  })

  it('adds no time in zones', () => {
    expect(easyShare(untrusted)).toBeNull()
    expect(easyHardShare(untrusted)).toEqual({ easyPct: null, hardPct: null })
    expect(toActivitySummary(beforeArmband!).zones.every((seconds) => seconds === 0)).toBe(true)
    expect(easyShare([trusted!])).toEqual({ easy: 17, hard: 83 })
  })

  it('gives no easy or workout heart rate', () => {
    expect(untrusted.map((a) => a.avgHeartRate)).toEqual([null, null, null])
    expect(untrusted.flatMap((a) => a.splits ?? []).map((split) => [split.avgHr, ...split.laps.map((lap) => lap.avgHr)])).toEqual([
      [null, null], [null, null], [null, null],
    ])
  })

  it('has no efficiency', () => {
    expect(efficiencyFactor(untrusted)).toBeNull()
    expect(efficiencyFactor([trusted!])).not.toBeNull()
  })

  it('has no aerobic decoupling', () => {
    expect(untrusted.map((a) => aerobicDecoupling({ ...a, splits: null }))).toEqual([null, null, null])
    expect(aerobicDecoupling({ ...trusted!, splits: null })).not.toBeNull()
  })
})
