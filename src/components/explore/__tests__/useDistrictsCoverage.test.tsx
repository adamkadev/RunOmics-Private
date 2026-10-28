import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AreaCoverage, ExploreAreaFile, ExploreAreaRef } from '@/domain/explore/types'
import type { ExploreEngine } from '../exploreEngine'
import { COVERAGE_STALL_MS, useDistrictsCoverage, type DistrictsCoverageInput } from '../useDistrictsCoverage'

const AREA: ExploreAreaRef = { id: 'test-area', name: 'Test', version: 'v1', bbox: [-150.05, -0.05, -149.95, 0.05] }
const AREA_FILE = { type: 'FeatureCollection', runomics: {}, features: [] } as unknown as ExploreAreaFile
const COVERAGE: AreaCoverage = { areaId: 'test-area', version: 'v1', units: [], exploredPct: 40, completeCount: 2, unitCount: 7, nextId: null, home: null }
const INPUT: DistrictsCoverageInput = {
  enabled: true,
  area: AREA,
  routes: [[[-150, 0], [-149.99, 0]]],
  clusterIndices: [0],
  visibleIndices: [0],
  routeMeta: [{ id: 'test-run', date: '2026-10-20' }],
  home: null,
}

function setup(...answers: (() => Promise<AreaCoverage>)[]) {
  const engine = {
    loadArea: vi.fn(async () => AREA_FILE),
    unsent: vi.fn((_ref: ExploreAreaRef, ids: readonly string[]) => [...ids]),
    addTracks: vi.fn(async () => ({ added: [] })),
    coverage: vi.fn(() => (answers.shift() ?? (async () => COVERAGE))()),
    dispose: vi.fn(),
  }
  const engineFor = () => engine as unknown as ExploreEngine
  return { ...renderHook(() => useDistrictsCoverage(INPUT, engineFor)), engine }
}

const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
const never = () => new Promise<AreaCoverage>(() => {})

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useDistrictsCoverage', () => {
  it('counts until the coverage answers', async () => {
    const { result } = setup()
    expect(result.current.status).toBe('loading')
    await wait(0)
    expect(result.current.status).toBe('ready')
    expect(result.current.coverage).toEqual(COVERAGE)
  })

  it('turns a coverage that never answers into the error, and its retry asks a fresh worker', async () => {
    const { result, engine } = setup(never)
    await wait(COVERAGE_STALL_MS - 1)
    expect(result.current.status).toBe('loading')
    await wait(1)
    expect(result.current.status).toBe('error')
    expect(result.current.coverage).toBeNull()

    act(() => result.current.retry())
    expect(engine.dispose).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('loading')
    await wait(0)
    expect(result.current.status).toBe('ready')
    expect(result.current.coverage).toEqual(COVERAGE)
  })

  it('takes an answer that comes after the stall', async () => {
    let answer!: (coverage: AreaCoverage) => void
    const { result, engine } = setup(() => new Promise((resolve) => (answer = resolve)))
    await wait(COVERAGE_STALL_MS)
    expect(result.current.status).toBe('error')

    await act(async () => answer(COVERAGE))
    expect(result.current.status).toBe('ready')
    expect(result.current.coverage).toEqual(COVERAGE)
    expect(engine.dispose).not.toHaveBeenCalled()
  })

  it('retries a failed answer on the same worker, and no stall follows an answer', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result, engine } = setup(() => Promise.reject(new Error('area file unreadable')))
    await wait(0)
    expect(result.current.status).toBe('error')

    act(() => result.current.retry())
    await wait(COVERAGE_STALL_MS)
    expect(result.current.status).toBe('ready')
    expect(engine.coverage).toHaveBeenCalledTimes(2)
    expect(engine.dispose).not.toHaveBeenCalled()
  })
})
