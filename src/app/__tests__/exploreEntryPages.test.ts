import { isValidElement, type ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExploreHome } from '@/application/usecases/GetExploreAreas'

// The two ways into Explore from outside the map (E5): Plan learns only
// whether there is an area; Progress hands the Explored card the area, the
// cluster and its runs. Every data source is stubbed: what is checked is the
// wiring, not the data.

vi.mock('@/application/usecases/GetExploreAreas', () => ({ getExploreHome: vi.fn() }))

vi.mock('@/application/usecases/GetActivities', () => ({ getActivitySummaries: () => [] }))
vi.mock('@/application/usecases/GetPlannedWorkouts', () => ({ getPlannedWorkouts: async () => [] }))
vi.mock('@/application/usecases/GetTrainingPlan', () => ({ getTrainingPlan: () => null }))
vi.mock('@/application/usecases/GetNextRace', () => ({ getNextRace: async () => null }))
vi.mock('@/application/usecases/GetTrainingZones', () => ({ getTrainingZones: async () => null }))
vi.mock('@/infrastructure/repositories/JsonAthleteRepository', () => ({ getAthleteProfile: () => ({}) }))
vi.mock('@/application/coaching/GetCoachingView', () => ({ getCoachingOverview: () => null }))
vi.mock('@/components/plan/PlanClient', () => ({ PlanClient: () => null }))
vi.mock('@/components/plan/planCoachingView', () => ({ planCoachingView: () => null }))

vi.mock('@/application/usecases/GetProfileData', () => ({
  getProfileData: async () => ({ ytd: {}, prevYear: {}, allTime: {}, hero: { sinceDate: null }, goal: null, athlete: {}, shoes: [] }),
}))
vi.mock('@/application/usecases/GetHeatmapData', () => ({ getHeatmapData: () => [] }))
vi.mock('@/application/usecases/GetVO2maxHistory', () => ({ getLatestVO2max: () => null }))
vi.mock('@/application/usecases/GetVo2Grade', () => ({ getVo2Grade: () => null }))
vi.mock('@/application/usecases/GetGoalsData', () => ({ getGoalsPageData: async () => ({ nextRace: null }) }))
vi.mock('@/application/usecases/GetMilestones', () => ({ getWeeklyStreakData: () => null }))
vi.mock('@/application/usecases/GetRecords', () => ({ getRecords: async () => [] }))
vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities: () => [] }))
vi.mock('@/infrastructure/repositories/JsonVo2maxHistoryRepository', () => ({ getVo2maxSamples: () => ({ days: [] }) }))
vi.mock('@/components/profile/ProgressHub', () => ({ ProgressHub: () => null }))
vi.mock('@/components/profile/progressHubView', () => ({ progressHubView: () => ({}) }))
vi.mock('@/components/explore/ExploredCard', () => ({ ExploredCard: () => null }))

const { getExploreHome } = await import('@/application/usecases/GetExploreAreas')
const { ExploredCard } = await import('@/components/explore/ExploredCard')
const { default: PlanPage } = await import('../plan/page')
const { default: ProfilePage } = await import('../profile/page')

const HOME: ExploreHome = {
  area: { id: 'bay', name: 'Bayside', version: 'bay-20261001-abcdef12', bbox: [-150.05, -0.05, -149.95, 0.05] },
  clusterId: 'c-7',
  runs: [{ routeIdx: 0, id: 'run-a', date: '2026-10-01' }],
  dataVersion: '0123456789ab',
}

type Props = Record<string, unknown>

beforeEach(() => vi.mocked(getExploreHome).mockReset())

describe('Plan', () => {
  it('tells the client Explore is there, and nothing more', async () => {
    vi.mocked(getExploreHome).mockReturnValue(HOME)
    const page = (await PlanPage()) as ReactElement<Props>
    expect(page.props.exploreAvailable).toBe(true)
    expect(JSON.stringify(page.props)).not.toContain('run-a')
  })

  it('says it is not there when the home area has no quartiers', async () => {
    vi.mocked(getExploreHome).mockReturnValue(null)
    const page = (await PlanPage()) as ReactElement<Props>
    expect(page.props.exploreAvailable).toBe(false)
  })
})

describe('Progress', () => {
  it('slots the Explored card in with the area, the cluster, its runs and their version', async () => {
    vi.mocked(getExploreHome).mockReturnValue(HOME)
    const page = (await ProfilePage()) as ReactElement<Props>
    const explored = page.props.explored
    expect(isValidElement(explored)).toBe(true)
    const card = explored as ReactElement<Props>
    expect(card.type).toBe(ExploredCard)
    expect(card.props).toEqual({ area: HOME.area, clusterId: 'c-7', runs: HOME.runs, dataVersion: '0123456789ab' })
  })

  it('leaves the card out when the home area has no quartiers', async () => {
    vi.mocked(getExploreHome).mockReturnValue(null)
    const page = (await ProfilePage()) as ReactElement<Props>
    expect(page.props.explored).toBeUndefined()
  })
})
