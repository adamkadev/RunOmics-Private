import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { RecordEntry } from '../GetRecords'

vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({
  getAllActivities: vi.fn(),
}))

vi.mock('../GetRecords', () => ({
  getRecords: vi.fn(),
}))

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3_600_000).toISOString().slice(0, 10)

function record(key: string, seconds: number | null, activityId = 'pb'): RecordEntry {
  return { key, label: key.toUpperCase(), seconds, paceSecPerKm: null, activityId, date: '2020-01-01', official: false }
}

function activity(id: string, date: string, bestEfforts: Record<string, number>): Activity {
  return { id, date, bestEfforts } as unknown as Activity
}

async function run(records: RecordEntry[], activities: Activity[]) {
  const { getAllActivities } = await import('@/infrastructure/repositories/JsonActivityRepository')
  const { getRecords } = await import('../GetRecords')
  vi.mocked(getAllActivities).mockReturnValue(activities)
  vi.mocked(getRecords).mockResolvedValue(records)

  const { getPbAlerts } = await import('../GetPbAlerts')
  return getPbAlerts()
}

describe('getPbAlerts', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('flags a recent effort that lands just short of the record', async () => {
    const alerts = await run([record('5k', 1200)], [activity('a1', daysAgo(5), { '5k': 1220 })])

    expect(alerts).toEqual([
      { key: '5k', label: '5K', recordSeconds: 1200, recentSeconds: 1220, diffSeconds: 20, activityId: 'a1', date: daysAgo(5) },
    ])
  })

  it('stays quiet on an effort further than 3% off the record', async () => {
    const alerts = await run([record('5k', 1200)], [activity('a1', daysAgo(5), { '5k': 1300 })])
    expect(alerts).toEqual([])
  })

  it('stays quiet on an effort older than the recency window', async () => {
    const alerts = await run([record('5k', 1200)], [activity('a1', daysAgo(60), { '5k': 1220 })])
    expect(alerts).toEqual([])
  })

  it('stays quiet when the effort is itself a new record', async () => {
    const alerts = await run([record('5k', 1200)], [activity('a1', daysAgo(5), { '5k': 1190 })])
    expect(alerts).toEqual([])
  })

  it('skips the activity the record was set on, so a PB never flags itself', async () => {
    const alerts = await run([record('5k', 1200, 'pb')], [activity('pb', daysAgo(5), { '5k': 1200 })])
    expect(alerts).toEqual([])
  })

  it('skips the longest-run record, which is a distance rather than a time', async () => {
    const alerts = await run([record('longest', 1200)], [activity('a1', daysAgo(5), { longest: 1220 })])
    expect(alerts).toEqual([])
  })

  it('skips a record that has never been set', async () => {
    const alerts = await run([record('5k', null)], [activity('a1', daysAgo(5), { '5k': 1220 })])
    expect(alerts).toEqual([])
  })

  it('keeps the closest recent attempt when several qualify', async () => {
    const alerts = await run(
      [record('5k', 1200)],
      [activity('a1', daysAgo(5), { '5k': 1230 }), activity('a2', daysAgo(3), { '5k': 1210 })],
    )

    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ activityId: 'a2', recentSeconds: 1210, diffSeconds: 10 })
  })

  it('orders alerts by how close they came, relative to the record', async () => {
    const alerts = await run(
      [record('5k', 1200, 'pb5'), record('10k', 2400, 'pb10')],
      [activity('a1', daysAgo(5), { '5k': 1230, '10k': 2410 })],
    )

    expect(alerts.map((a) => a.key)).toEqual(['10k', '5k'])
  })
})
