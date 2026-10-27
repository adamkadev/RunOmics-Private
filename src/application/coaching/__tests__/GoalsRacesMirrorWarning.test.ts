import { beforeEach, describe, expect, it, vi } from 'vitest'

const repos = vi.hoisted(() => ({ live: vi.fn(), races: vi.fn(), goals: vi.fn() }))
vi.mock('@/infrastructure/repositories/FirestoreGoalsRacesRepository', () => ({ getGoalsRacesEntries: repos.live }))
vi.mock('@/infrastructure/repositories/JsonUpcomingRaceRepository', () => ({ getRaceEntriesBackup: repos.races, getUpcomingRaceYears: () => [] }))
vi.mock('@/infrastructure/repositories/JsonGoalRepository', () => ({ getGoalEntriesBackup: repos.goals, getGoalYears: () => [] }))

const { warnOnUnmirroredGoalsRaces } = await import('../GetCoachingContext')

const race = { id: 'abc', name: 'Harbor 10K', date: '2027-04-11', distanceKm: 10, priority: 'A' as const }
const goal = { year: 2027, targets: { '10k': 2_700 } }

describe('warnOnUnmirroredGoalsRaces', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    repos.races.mockReturnValue([race])
    repos.goals.mockReturnValue([goal])
  })

  it('stays quiet when the mirror matches Firestore, whatever the order', async () => {
    repos.live.mockResolvedValue({ available: true, races: [race], goals: [goal] })
    expect(await warnOnUnmirroredGoalsRaces()).toBe(false)
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('names a race edited in the app since the last sync', async () => {
    repos.live.mockResolvedValue({ available: true, races: [{ ...race, priority: 'B' }], goals: [goal] })
    expect(await warnOnUnmirroredGoalsRaces()).toBe(true)
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('run a sync'))
  })

  it('says nothing it cannot know when Firestore does not answer', async () => {
    repos.live.mockResolvedValue({ available: false, races: [], goals: [] })
    expect(await warnOnUnmirroredGoalsRaces()).toBe(false)
  })
})
