import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReturnProgress } from '../GetReturnProgress'

const { read, write } = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }))
vi.mock('@/infrastructure/repositories/FirestoreConfigRepository', () => ({
  getLastReturnMilestoneState: read,
  saveLastReturnMilestoneState: write,
}))

const { getNewReturnMilestones } = await import('../GetNewReturnMilestones')

const progress: ReturnProgress = {
  breakStart: '2026-03-01',
  breakEnd: '2026-10-05',
  milestones: [
    { key: 'continuous10', date: '2026-10-12', activityId: 'r1' },
    { key: 'continuous20', date: '2026-10-26', activityId: 'r2' },
  ],
  pending: ['continuous30', 'nonstop3k', 'nonstop5k', 'blockCompleted'],
  longestSec: 1260,
  weeks: [],
  ongoing: true,
}

describe('getNewReturnMilestones', () => {
  beforeEach(() => vi.clearAllMocks())

  it('announces only a recent milestone not announced before, and stores every one reached on commit', async () => {
    read.mockResolvedValue(null)

    const { newMilestones, commit } = await getNewReturnMilestones('2026-10-27', progress)
    expect(newMilestones.map((milestone) => milestone.key)).toEqual(['continuous20'])
    expect(write).not.toHaveBeenCalled()

    await commit()
    expect(write).toHaveBeenCalledWith({ announced: ['2026-10-05:continuous10', '2026-10-05:continuous20'] })
  })

  it('does not announce a milestone twice', async () => {
    read.mockResolvedValue({ announced: ['2026-10-05:continuous20'] })

    expect((await getNewReturnMilestones('2026-10-27', progress)).newMilestones).toEqual([])
  })

  it('reads nothing without a return under way', async () => {
    const { newMilestones } = await getNewReturnMilestones('2026-10-27', null)

    expect(newMilestones).toEqual([])
    expect(read).not.toHaveBeenCalled()
  })
})
