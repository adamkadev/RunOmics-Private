import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExploreAreaRef } from '@/domain/explore/types'
import type { WorkoutPrescription } from '@/domain/coaching/types'

// The Activities page hands the route generator the sessions of the next
// four weeks (Explore, S3) - today's, and the one a Plan link names:
// trimmed copies - name, distance, pace - never the coach's overview, and
// only where the map has Districts to plan a run in. Every data source is
// stubbed: what is checked is the wiring.

const TODAY = '2026-10-22'
const AREA: ExploreAreaRef = { id: 'bay', name: 'Bayside', version: 'bay-20261001-abcdef12', bbox: [-150.05, -0.05, -149.95, 0.05] }
const PRESCRIPTION = {
  id: `w:${TODAY}`,
  revision: 1,
  date: TODAY,
  type: 'easy',
  title: 'Easy · 8 km + 6 strides',
  description: 'The coach’s reasoning for the day.',
  status: 'prescribed',
  totalDistanceMeters: 9462,
  totalDurationSeconds: 3336,
  blocks: [{ kind: 'effort', target: { distanceMeters: 9462 } }],
  provenance: { source: 'demo', trigger: 'bootstrap', createdAt: '2026-09-20T00:00:00Z' },
} as WorkoutPrescription
const SATURDAY = { ...PRESCRIPTION, id: 'w:2026-10-24', date: '2026-10-24', type: 'long_run', title: 'Long run', totalDistanceMeters: 16000, totalDurationSeconds: 5760 } as WorkoutPrescription
const OVERVIEW = {
  plan: { summary: 'The block’s private focus' },
  workouts: [PRESCRIPTION, SATURDAY].map((prescription) => ({ prescription, state: 'prescribed', garminStatus: 'not_scheduled', activityId: null })),
}

const data = vi.hoisted(() => ({ areas: [] as ExploreAreaRef[], planned: vi.fn(async () => []) }))

vi.mock('@/lib/calendarDate', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/calendarDate')>()), appTodayIso: () => '2026-10-22' }))
vi.mock('@/application/usecases/QueryActivities', () => ({ queryActivities: () => ({ items: [], total: 0, nextOffset: null }) }))
vi.mock('@/application/usecases/GetRecords', () => ({ getRecords: async () => [], getQualifiedEffortsByActivityId: () => ({}) }))
vi.mock('@/application/usecases/GetAllRoutes', () => ({ getMapShellData: () => ({ routeMeta: [], clusters: [] }) }))
vi.mock('@/application/usecases/GetExploreAreas', () => ({ getExploreAreas: () => data.areas }))
vi.mock('@/application/usecases/GetShoeStats', () => ({ getShoeStats: () => [] }))
vi.mock('@/application/coaching/GetCoachingView', () => ({ getCoachingOverview: () => OVERVIEW }))
vi.mock('@/application/usecases/GetPlannedWorkouts', () => ({ getPlannedWorkouts: data.planned }))
vi.mock('@/application/usecases/GetTrainingZones', () => ({ getTrainingZones: async () => null }))
vi.mock('@/components/activities/ActivityListClient', () => ({ ActivityListClient: () => null }))

const { default: ActivitiesPage } = await import('../activities/page')

type Props = Record<string, unknown>

describe('the Activities page and the route generator', () => {
  beforeEach(() => {
    data.planned.mockClear()
  })

  it('passes today’s session and those to come, trimmed to their name, distance and pace', async () => {
    data.areas = [AREA]
    const page = (await ActivitiesPage()) as ReactElement<Props>
    expect(page.props.explorePlans).toEqual([
      { date: TODAY, label: 'Easy · 8 km + 6 strides', distanceM: 9462, paceSecPerKm: 353 },
      { date: '2026-10-24', label: 'Long run', distanceM: 16000, paceSecPerKm: 360 },
    ])
    // Nothing of the coach's overview reaches the client.
    const payload = JSON.stringify(page.props)
    expect(payload).not.toContain('reasoning')
    expect(payload).not.toContain('private focus')
    expect(page.props.exploreAreas).toEqual([AREA])
  })

  it('passes none where the map has no Districts, without reading the plan', async () => {
    data.areas = []
    const page = (await ActivitiesPage()) as ReactElement<Props>
    expect(page.props.explorePlans).toEqual([])
    expect(data.planned).not.toHaveBeenCalled()
  })
})
