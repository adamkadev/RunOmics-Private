import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { PrState } from '@/infrastructure/repositories/FirestoreConfigRepository'

const { getAllActivities, getLastPrState, saveLastPrState } = vi.hoisted(() => ({
  getAllActivities: vi.fn(),
  getLastPrState: vi.fn(),
  saveLastPrState: vi.fn(),
}))

vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities }))
vi.mock('@/infrastructure/repositories/FirestoreConfigRepository', () => ({ getLastPrState, saveLastPrState }))

const { getNewPrs } = await import('../GetNewPrs')

function activity(id: string, date: string, bestEfforts: Record<string, number>): Activity {
  return { id, date, description: 'Morning run', bestEfforts } as unknown as Activity
}

async function run(activities: Activity[], lastState: PrState | null) {
  getAllActivities.mockReturnValue(activities)
  getLastPrState.mockResolvedValue(lastState)
  saveLastPrState.mockResolvedValue(undefined)

  return getNewPrs()
}

const savedState = () => saveLastPrState.mock.calls[0]![0] as PrState

describe('getNewPrs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('says nothing on the very first run, having nothing to compare against', async () => {
    expect(await run([activity('a', '2026-07-20', { '5k': 1200 })], null)).toEqual([])
  })

  it('records the standing marks on that first run, so the next one can tell', async () => {
    await run([activity('a', '2026-07-20', { '5k': 1200, '10k': 2500 })], null)

    expect(savedState()).toEqual({
      '5k': { seconds: 1200, activityId: 'a' },
      '10k': { seconds: 2500, activityId: 'a' },
    })
  })

  it('reports a distance run faster than the stored mark', async () => {
    const prs = await run([activity('new', '2026-07-20', { '5k': 1150 })], {
      '5k': { seconds: 1200, activityId: 'old' },
    })

    expect(prs).toEqual([{ key: '5k', label: '5K', seconds: 1150, activityId: 'new', date: '2026-07-20' }])
  })

  it('says nothing when the distance was matched but not beaten', async () => {
    const prs = await run([activity('new', '2026-07-20', { '5k': 1200 })], {
      '5k': { seconds: 1200, activityId: 'old' },
    })

    expect(prs).toEqual([])
  })

  it('says nothing when the best effort is still the stored one', async () => {
    const prs = await run([activity('a', '2026-07-20', { '5k': 1250 })], {
      '5k': { seconds: 1200, activityId: 'old' },
    })

    expect(prs).toEqual([])
  })

  it('reports every distance improved in the same sync', async () => {
    const prs = await run([activity('new', '2026-07-20', { '5k': 1150, '10k': 2400 })], {
      '5k': { seconds: 1200, activityId: 'old' },
      '10k': { seconds: 2500, activityId: 'old' },
    })

    expect(prs.map((pr) => pr.key)).toEqual(['5k', '10k'])
  })

  it('does not celebrate a distance simply because it is the first ever recorded', async () => {
    const prs = await run([activity('a', '2026-07-20', { '5k': 1200, '10k': 2500 })], {
      '5k': { seconds: 1300, activityId: 'old' },
    })

    expect(prs.map((pr) => pr.key)).toEqual(['5k'])
    expect(savedState()['10k']).toEqual({ seconds: 2500, activityId: 'a' })
  })

  it('reads the best mark across the whole history, not the most recent one', async () => {
    const prs = await run(
      [
        activity('recent', '2026-07-20', { '5k': 1250 }),
        activity('best', '2026-03-01', { '5k': 1140 }),
      ],
      { '5k': { seconds: 1200, activityId: 'old' } }
    )

    expect(prs).toEqual([{ key: '5k', label: '5K', seconds: 1140, activityId: 'best', date: '2026-03-01' }])
  })

  it('leaves a never-run distance out of the stored state entirely', async () => {
    await run([activity('a', '2026-07-20', { '5k': 1200 })], null)

    expect(Object.keys(savedState())).toEqual(['5k'])
  })

  it('names the distance the way the records page does', async () => {
    const prs = await run([activity('a', '2026-07-20', { half: 5100 })], {
      half: { seconds: 5400, activityId: 'old' },
    })

    expect(prs[0]?.label).toBe('Half')
  })

  it('always writes the state back, even when nothing was beaten', async () => {
    await run([activity('a', '2026-07-20', { '5k': 1200 })], { '5k': { seconds: 1200, activityId: 'a' } })

    expect(saveLastPrState).toHaveBeenCalledTimes(1)
  })
})
