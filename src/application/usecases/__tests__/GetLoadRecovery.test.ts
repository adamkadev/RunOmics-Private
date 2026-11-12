import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HealthDay, RecoveryDay } from '@/domain/training/recovery'

const watch: RecoveryDay[] = []
const tracker: HealthDay[] = []

vi.mock('@/infrastructure/repositories/JsonRecoveryRepository', () => ({ getRecoveryDays: () => watch }))
vi.mock('@/infrastructure/repositories/JsonHealthRepository', () => ({ getHealthDays: () => tracker }))
vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities: () => [] }))
vi.mock('@/infrastructure/repositories/JsonTrainingStatusRepository', () => ({ getTrainingStatusDays: () => [] }))

const { getRecoveryHistory } = await import('../GetLoadRecovery')

describe('getRecoveryHistory', () => {
  beforeEach(() => {
    watch.length = 0
    tracker.length = 0
  })

  it('reads the watch for a deployment without a tracker', () => {
    watch.push({ date: '2026-03-01', restingHr: 55 }, { date: '2026-03-02', restingHr: 56 })
    expect(getRecoveryHistory()).toEqual(watch)
  })

  it('reads the tracker alone once it has a resting HR, the watch days before it included', () => {
    watch.push({ date: '2026-02-20', restingHr: 58 }, { date: '2026-03-02', restingHr: 60 })
    tracker.push({ date: '2026-03-01', hrvMs: 70 }, { date: '2026-03-02', restingHr: 47 }, { date: '2026-03-03', restingHr: 48, steps: 9000 })
    expect(getRecoveryHistory()).toEqual([
      { date: '2026-03-02', restingHr: 47 },
      { date: '2026-03-03', restingHr: 48 },
    ])
  })

  it('stays on the watch while the tracker holds no resting HR', () => {
    watch.push({ date: '2026-03-01', restingHr: 55 })
    tracker.push({ date: '2026-03-01', steps: 4000 })
    expect(getRecoveryHistory()).toEqual(watch)
  })
})
