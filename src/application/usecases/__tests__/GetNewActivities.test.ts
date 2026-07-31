import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { ActivitySyncState } from '@/infrastructure/repositories/FirestoreConfigRepository'

const { getAllActivities, getLastActivitySyncState, saveLastActivitySyncState } = vi.hoisted(() => ({
  getAllActivities: vi.fn(),
  getLastActivitySyncState: vi.fn(),
  saveLastActivitySyncState: vi.fn(),
}))

vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities }))
vi.mock('@/infrastructure/repositories/FirestoreConfigRepository', () => ({
  getLastActivitySyncState,
  saveLastActivitySyncState,
}))

const { getNewActivities } = await import('../GetNewActivities')

const activity = (id: string): Activity => ({ id, date: '2026-07-20', distanceKm: 10 }) as Activity

async function run(ids: string[], lastState: ActivitySyncState | null) {
  getAllActivities.mockReturnValue(ids.map(activity))
  getLastActivitySyncState.mockResolvedValue(lastState)
  saveLastActivitySyncState.mockResolvedValue(undefined)

  return getNewActivities()
}

const savedIds = () => (saveLastActivitySyncState.mock.calls[0]![0] as ActivitySyncState).knownIds

describe('getNewActivities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('says nothing on the very first run, having nothing to compare against', async () => {
    expect(await run(['a', 'b'], null)).toEqual([])
  })

  it('records what it saw on that first run, so the next one can tell', async () => {
    await run(['a', 'b'], null)

    expect(savedIds()).toEqual(['a', 'b'])
  })

  it('reports the runs that were not there last time', async () => {
    const fresh = await run(['c', 'b', 'a'], { knownIds: ['b', 'a'] })

    expect(fresh.map((a) => a.id)).toEqual(['c'])
  })

  it('says nothing when the sync brought nothing new', async () => {
    expect(await run(['b', 'a'], { knownIds: ['b', 'a'] })).toEqual([])
  })

  it('reports several new runs from one sync', async () => {
    const fresh = await run(['d', 'c', 'b'], { knownIds: ['b'] })

    expect(fresh.map((a) => a.id)).toEqual(['d', 'c'])
  })

  it('hands back the whole activity, not just its id', async () => {
    const [fresh] = await run(['c'], { knownIds: [] })

    expect(fresh).toMatchObject({ id: 'c', date: '2026-07-20', distanceKm: 10 })
  })

  it('tracks only the recent runs, so the stored state stays bounded', async () => {
    const ids = Array.from({ length: 90 }, (_, i) => `a${i}`)
    await run(ids, { knownIds: ids })

    expect(savedIds()).toHaveLength(60)
    expect(savedIds().at(-1)).toBe('a59')
  })

  it('never reports a run that has aged out of the tracked window', async () => {
    const ids = Array.from({ length: 90 }, (_, i) => `a${i}`)
    const fresh = await run(ids, { knownIds: ids.slice(0, 60) })

    expect(fresh).toEqual([])
  })

  it('always writes the state back, even when nothing was new', async () => {
    await run(['b', 'a'], { knownIds: ['b', 'a'] })

    expect(saveLastActivitySyncState).toHaveBeenCalledWith({ knownIds: ['b', 'a'] })
  })
})
