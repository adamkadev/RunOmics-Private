import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TrainingStatus } from '../GetTrainingStatus'

const { getTrainingStatus, getLastOverreachingState, saveLastOverreachingState } = vi.hoisted(() => ({
  getTrainingStatus: vi.fn(),
  getLastOverreachingState: vi.fn(),
  saveLastOverreachingState: vi.fn(),
}))

vi.mock('../GetTrainingStatus', () => ({ getTrainingStatus }))
vi.mock('@/infrastructure/repositories/FirestoreConfigRepository', () => ({
  getLastOverreachingState,
  saveLastOverreachingState,
}))

const { getOverreachingAlerts } = await import('../GetOverreachingAlerts')

function status(overrides: Partial<TrainingStatus> = {}): TrainingStatus {
  return { risk: 'low', tsb: -12, acwr: 1.1, ctlDelta: 2.4, ...overrides } as TrainingStatus
}

async function run(current: TrainingStatus | null, alerted: boolean | null) {
  getTrainingStatus.mockResolvedValue(current)
  getLastOverreachingState.mockResolvedValue(alerted === null ? null : { alerted })
  saveLastOverreachingState.mockResolvedValue(undefined)

  return getOverreachingAlerts()
}

describe('getOverreachingAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('says nothing, and stores nothing, before there is a status at all', async () => {
    expect(await run(null, null)).toEqual([])
    expect(saveLastOverreachingState).not.toHaveBeenCalled()
  })

  it('stays quiet while the risk is anything short of high', async () => {
    expect(await run(status({ risk: 'low' }), null)).toEqual([])
    expect(await run(status({ risk: 'moderate' }), null)).toEqual([])
  })

  it('fires on the crossing into high risk', async () => {
    const alerts = await run(status({ risk: 'high', tsb: -34, acwr: 1.6, ctlDelta: 5.2 }), false)

    expect(alerts).toEqual([{ tsb: -34, acwr: 1.6, ctlDelta: 5.2 }])
  })

  it('fires on the first check too, when the risk is already high', async () => {
    expect(await run(status({ risk: 'high' }), null)).toHaveLength(1)
  })

  it('does not repeat itself while the risk stays high', async () => {
    expect(await run(status({ risk: 'high' }), true)).toEqual([])
  })

  it('re-arms once the risk drops back down', async () => {
    await run(status({ risk: 'moderate' }), true)

    expect(saveLastOverreachingState).toHaveBeenCalledWith({ alerted: false })
  })

  it('fires again on a relapse after that reset', async () => {
    expect(await run(status({ risk: 'high' }), false)).toHaveLength(1)
  })

  it('records the high risk so the next check stays quiet', async () => {
    await run(status({ risk: 'high' }), false)

    expect(saveLastOverreachingState).toHaveBeenCalledWith({ alerted: true })
  })

  it('carries an unknown ratio through rather than inventing one', async () => {
    const [alert] = await run(status({ risk: 'high', acwr: null }), false)

    expect(alert?.acwr).toBeNull()
  })
})
