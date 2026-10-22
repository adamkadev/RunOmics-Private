import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AreaCoverage, ExploreAreaRef } from '@/domain/explore/types'
import { testArea } from '@/domain/explore/__tests__/areaFixture'
import type { ExploreEngine } from '../exploreEngine'
import type { CoverageOptions, TrackBuffers } from '../workerProtocol'
import { useDistrictsCoverage, type DistrictsCoverageInput } from '../useDistrictsCoverage'

const AREA = testArea()
const REF: ExploreAreaRef = { id: AREA.runomics.id, name: AREA.runomics.name, version: AREA.runomics.version, bbox: AREA.runomics.bbox }

/** Three runs of the cluster at global indices 0-2 (index 3 is another cluster's). */
const META = [
  { id: 'run-a', date: '2026-10-01' },
  { id: 'run-b', date: '2026-10-02' },
  { id: 'run-c', date: '2026-10-03' },
  { id: 'run-other', date: '2026-10-04' },
]
const ROUTES: [number, number][][] = [
  [[-150, 45], [-149.999, 45.001]],
  [[-150, 45.002], [-149.998, 45.002]],
  [[-149.997, 45], [-149.997, 45.003]],
]
const HOME: [number, number] = [-150, 45]

function coverageFor(ids: string[] | undefined): AreaCoverage {
  return {
    areaId: REF.id,
    version: REF.version,
    units: [],
    exploredPct: (ids?.length ?? 0) * 10,
    completeCount: 0,
    unitCount: 0,
    nextId: null,
    home: null,
  }
}

interface Pending {
  options: CoverageOptions
  resolve: (coverage: AreaCoverage) => void
  reject: (err: Error) => void
}

/** An engine whose coverage answers wait for the test (`answer`), so their order can be shuffled. */
function fakeEngine({ manual = false } = {}) {
  const sent = new Set<string>()
  const pending: Pending[] = []
  const engine = {
    loadArea: vi.fn(async () => AREA),
    addTracks: vi.fn(async (_ref: ExploreAreaRef, tracks: TrackBuffers) => {
      tracks.ids.forEach((id) => sent.add(id))
      return { added: tracks.ids }
    }),
    unsent: vi.fn((_ref: ExploreAreaRef, ids: readonly string[]) => ids.filter((id) => !sent.has(id))),
    coverage: vi.fn(
      (_ref: ExploreAreaRef, options: CoverageOptions) =>
        new Promise<AreaCoverage>((resolve, reject) => {
          if (manual) pending.push({ options, resolve, reject })
          else resolve(coverageFor(options.activityIds))
        }),
    ),
    fetchClusterTracks: vi.fn(),
    scoreRoutes: vi.fn(),
    routeStart: vi.fn(),
    dispose: vi.fn(),
  }
  const answer = (k: number) => pending[k]!.resolve(coverageFor(pending[k]!.options.activityIds))
  return { engine, engineFor: vi.fn(() => engine as unknown as ExploreEngine), pending, answer }
}

function input(overrides: Partial<DistrictsCoverageInput> = {}): DistrictsCoverageInput {
  return {
    enabled: true,
    area: REF,
    routes: ROUTES,
    clusterIndices: [0, 1, 2],
    visibleIndices: [0, 1, 2],
    routeMeta: META,
    home: HOME,
    ...overrides,
  }
}

describe('useDistrictsCoverage', () => {
  it('does nothing for a Heat user: no engine, no worker', () => {
    const { engineFor } = fakeEngine()
    const { result } = renderHook(() => useDistrictsCoverage(input({ enabled: false }), engineFor))
    expect(result.current).toEqual({ area: null, coverage: null, status: 'idle' })
    expect(engineFor).not.toHaveBeenCalled()
  })

  it('is idle where the cluster has no area', () => {
    const { engineFor } = fakeEngine()
    const { result } = renderHook(() => useDistrictsCoverage(input({ area: null }), engineFor))
    expect(result.current.status).toBe('idle')
    expect(engineFor).not.toHaveBeenCalled()
  })

  it('loads the area, sends the cluster’s runs once, and counts the runs the filters keep from home', async () => {
    const { engine, engineFor } = fakeEngine()
    const { result } = renderHook(() => useDistrictsCoverage(input(), engineFor))
    expect(result.current.status).toBe('loading')

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.area).toBe(AREA)
    expect(result.current.coverage?.exploredPct).toBe(30)
    expect(engine.loadArea).toHaveBeenCalledWith(REF)
    expect(engine.addTracks).toHaveBeenCalledTimes(1)
    expect(engine.addTracks.mock.calls[0]![1].ids).toEqual(['run-a', 'run-b', 'run-c'])
    expect(engine.coverage).toHaveBeenCalledWith(REF, { activityIds: ['run-a', 'run-b', 'run-c'], home: HOME })
  })

  it('follows the heat filters: fewer runs counted, nothing sent again', async () => {
    const { engine, engineFor } = fakeEngine()
    const { result, rerender } = renderHook((props: DistrictsCoverageInput) => useDistrictsCoverage(props, engineFor), {
      initialProps: input(),
    })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    rerender(input({ visibleIndices: [2] }))
    expect(result.current.status).toBe('loading')
    // The last answer stays up meanwhile: no flash of an empty map.
    expect(result.current.coverage?.exploredPct).toBe(30)
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(engine.coverage).toHaveBeenLastCalledWith(REF, { activityIds: ['run-c'], home: HOME })
    expect(result.current.coverage?.exploredPct).toBe(10)
    expect(engine.addTracks).toHaveBeenCalledTimes(1)
  })

  it('drops an answer to an older question', async () => {
    const { engine, engineFor, pending, answer } = fakeEngine({ manual: true })
    const { result, rerender } = renderHook((props: DistrictsCoverageInput) => useDistrictsCoverage(props, engineFor), {
      initialProps: input(),
    })
    await waitFor(() => expect(pending).toHaveLength(1))
    rerender(input({ visibleIndices: [0] }))
    await waitFor(() => expect(pending).toHaveLength(2))

    // The newer answer lands first, then the stale one.
    await act(async () => answer(1))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await act(async () => answer(0))
    expect(result.current.coverage?.exploredPct).toBe(10)
    expect(engine.coverage).toHaveBeenCalledTimes(2)
  })

  it('waits for the cluster’s tracks rather than counting no run as all fog', async () => {
    const { engine, engineFor } = fakeEngine()
    const { result, rerender } = renderHook((props: DistrictsCoverageInput) => useDistrictsCoverage(props, engineFor), {
      initialProps: input({ routes: [] }),
    })
    await waitFor(() => expect(result.current.area).toBe(AREA))
    expect(result.current.status).toBe('loading')
    expect(engine.coverage).not.toHaveBeenCalled()

    rerender(input())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(engine.coverage).toHaveBeenCalledTimes(1)
  })

  it('reports a failure', async () => {
    const { engine, engineFor } = fakeEngine()
    engine.coverage.mockRejectedValueOnce(new Error('worker died'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = renderHook(() => useDistrictsCoverage(input(), engineFor))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.coverage).toBeNull()
    warn.mockRestore()
  })
})
