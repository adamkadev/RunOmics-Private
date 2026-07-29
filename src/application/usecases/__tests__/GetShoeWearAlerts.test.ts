import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ShoeStats } from '../GetShoeStats'
import type { ShoeWearState } from '@/infrastructure/repositories/FirestoreConfigRepository'

vi.mock('../GetShoeStats', () => ({
  getShoeStats: vi.fn(),
}))

vi.mock('@/infrastructure/repositories/FirestoreConfigRepository', () => ({
  getLastShoeWearState: vi.fn(),
  saveLastShoeWearState: vi.fn(),
}))

function shoe(gearId: string, overrides: Partial<ShoeStats> = {}): ShoeStats {
  return {
    gearId,
    name: gearId,
    brand: 'Brand',
    maxKm: 800,
    alertThresholdKm: 700,
    retired: false,
    totalKm: 100,
    sessionCount: 10,
    lastUsedDate: '2026-01-01',
    wearPercent: 13,
    nearingLimit: false,
    ...overrides,
  }
}

async function run(shoes: ShoeStats[], lastState: ShoeWearState | null) {
  const { getShoeStats } = await import('../GetShoeStats')
  const { getLastShoeWearState, saveLastShoeWearState } = await import(
    '@/infrastructure/repositories/FirestoreConfigRepository'
  )
  vi.mocked(getShoeStats).mockReturnValue(shoes)
  vi.mocked(getLastShoeWearState).mockResolvedValue(lastState)
  vi.mocked(saveLastShoeWearState).mockResolvedValue(undefined)

  const { getShoeWearAlerts } = await import('../GetShoeWearAlerts')
  return { alerts: await getShoeWearAlerts(), saveLastShoeWearState: vi.mocked(saveLastShoeWearState) }
}

describe('getShoeWearAlerts', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('says nothing while every shoe is below its alert threshold', async () => {
    const { alerts } = await run([shoe('a'), shoe('b')], null)
    expect(alerts).toEqual([])
  })

  it('alerts on a shoe that has crossed its threshold', async () => {
    const { alerts } = await run([shoe('a', { totalKm: 720, nearingLimit: true })], null)

    expect(alerts).toEqual([{ gearId: 'a', name: 'a', totalKm: 720, alertThresholdKm: 700 }])
  })

  it('does not re-alert on a shoe already reported as worn', async () => {
    const { alerts } = await run([shoe('a', { nearingLimit: true })], { a: { alerted: true } })
    expect(alerts).toEqual([])
  })

  it('ignores retired shoes even once they are past the threshold', async () => {
    const { alerts } = await run([shoe('a', { retired: true, nearingLimit: true })], null)
    expect(alerts).toEqual([])
  })

  it('records the worn shoe so the next run stays quiet', async () => {
    const { saveLastShoeWearState } = await run([shoe('a', { nearingLimit: true }), shoe('b')], null)

    expect(saveLastShoeWearState).toHaveBeenCalledWith({ a: { alerted: true }, b: { alerted: false } })
  })

  it('keeps a shoe flagged once alerted, so a later reading cannot re-arm it', async () => {
    const { saveLastShoeWearState } = await run([shoe('a', { nearingLimit: false })], { a: { alerted: true } })

    expect(saveLastShoeWearState).toHaveBeenCalledWith({ a: { alerted: true } })
  })

  it('leaves retired shoes out of the stored state entirely', async () => {
    const { saveLastShoeWearState } = await run([shoe('a', { retired: true }), shoe('b')], null)

    expect(saveLastShoeWearState).toHaveBeenCalledWith({ b: { alerted: false } })
  })

  it('reports every newly worn shoe in one pass', async () => {
    const { alerts } = await run(
      [shoe('a', { nearingLimit: true }), shoe('b'), shoe('c', { nearingLimit: true })],
      { a: { alerted: false } },
    )

    expect(alerts.map((a) => a.gearId)).toEqual(['a', 'c'])
  })
})
