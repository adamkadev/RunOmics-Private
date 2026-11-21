import { describe, expect, it } from 'vitest'
import { buildVdotProfile } from '../GetVdotProfile'
import type { Activity, ActivitySplit } from '@/domain/activity/types'
import type { RecordEntry } from '@/domain/race/records'

const record = (key: string, seconds: number | null, activityId: string | null = null): RecordEntry => ({
  key,
  label: key,
  seconds,
  paceSecPerKm: null,
  activityId,
  date: '2026-10-01',
  official: false,
})

const split = (type: ActivitySplit['type'], durationSec: number, distanceM: number): ActivitySplit =>
  ({ type, durationSec, distanceM, avgSpeedMs: distanceM / durationSec, avgHr: null, laps: [] }) as ActivitySplit

const runWalk: Activity = {
  id: 'rw',
  type: 'Base',
  date: '2026-10-01T08:00:00',
  splits: [
    split('interval_active', 180, 500),
    split('interval_recovery', 120, 150),
    split('interval_active', 180, 500),
    split('interval_recovery', 120, 150),
    split('interval_active', 180, 500),
  ],
} as Activity

const steady: Activity = { id: 'steady', type: 'Base', date: '2026-10-01T08:00:00', splits: [] } as unknown as Activity

describe('buildVdotProfile', () => {
  it('builds the profile from the records over the known distances', () => {
    const p = buildVdotProfile([record('1k', 200), record('5k', 1200, 'steady'), record('10k', 2640), record('marathon', null)], [steady], '2026-11-21')
    expect(p?.rows.map((r) => r.key)).toEqual(['5k', '10k'])
  })

  it('hides the card when any record was set on a run/walk', () => {
    expect(buildVdotProfile([record('5k', 2100, 'rw'), record('10k', 4500)], [runWalk], '2026-11-21')).toBeNull()
  })

  it('hides the card with fewer than two records', () => {
    expect(buildVdotProfile([record('5k', 1200)], [], '2026-11-21')).toBeNull()
  })
})
