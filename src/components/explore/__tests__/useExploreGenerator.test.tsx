import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AreaCoverage, ExploreAreaFile, ExploreAreaRef } from '@/domain/explore/types'
import type { ExplorePlan } from '../routeGenerator'
import { generatorUnit, useExploreGenerator, type ExploreGeneratorInput } from '../useExploreGenerator'

const owner = vi.hoisted(() => ({ isOwner: true }))
vi.mock('@/lib/useOwnerAuth', () => ({ useOwnerAuth: () => ({ user: null, isOwner: owner.isOwner, loading: false }) }))

const spots = vi.hoisted(() => ({
  read: vi.fn(async () => [] as unknown[]),
  add: vi.fn(async ([lon, lat]: [number, number], radiusM: number) => ({ id: 'new', lon, lat, radiusM, createdAt: '2026-10-27', reason: null, expiresOn: null })),
  remove: vi.fn(async () => {}),
  setReason: vi.fn(async () => {}),
  setRadius: vi.fn(async () => {}),
}))
vi.mock('@/lib/avoidSpots', () => ({ firestoreAvoidSpots: spots }))

const AREA: ExploreAreaRef = { id: 'test-area', name: 'Test', version: 'v1', bbox: [-150.05, -0.05, -149.95, 0.05] }
const CLUSTER = { labelPoint: [-150, 0] as [number, number], center: [-150, 0] as [number, number] }
const PLANS: ExplorePlan[] = [
  { date: '2026-10-27', label: 'Easy · 8 km', distanceM: 8000, paceSecPerKm: 330, session: 'easy', hour: 18 },
  { date: '2026-10-29', label: 'Intervals', distanceM: 10000, paceSecPerKm: 270, session: 'quality', hour: 7 },
]

function setup(more: Partial<ExploreGeneratorInput> = {}) {
  const onReturn = vi.fn()
  const onOpen = vi.fn()
  const input: ExploreGeneratorInput = {
    clusters: [CLUSTER],
    defaultClusterIdx: 0,
    exploreAreas: [AREA],
    explorePlans: PLANS,
    today: '2026-10-27',
    districtsArea: AREA,
    medianKm: 7,
    easyPace: 340,
    expanded: false,
    openUnitId: 'test-open',
    onReturn,
    onOpen,
    ...more,
  }
  return { ...renderHook(() => useExploreGenerator(input)), onReturn, onOpen }
}

beforeEach(() => {
  owner.isOwner = true
  window.history.replaceState(null, '', '/activities')
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useExploreGenerator', () => {
  it('stays shut without a link', () => {
    const { result } = setup()
    expect(result.current.generator).toBeNull()
    expect(result.current.generatorOpen).toBe(false)
    expect(result.current.linked).toBe(false)
    expect(result.current.mapPick).toBeNull()
  })

  it('opens on a link with its day’s plan, and close takes the link out of the address', () => {
    window.history.replaceState(null, '', '/activities?explore=route&date=2026-10-29&km=9&from=plan&tab=map')
    const { result, onReturn } = setup()
    expect(result.current.linked).toBe(true)
    expect(result.current.generator).toMatchObject({ km: 9, from: 'plan', plan: { date: '2026-10-29' }, returnTo: null })
    expect(result.current.prefs.flatForReps).toBe(true)
    expect(result.current.day).toEqual({ session: 'quality', beforeQuality: false })
    act(() => result.current.close())
    expect(result.current.generator).toBeNull()
    expect(window.location.search).toBe('?tab=map')
    expect(onReturn).not.toHaveBeenCalled()
  })

  it('ignores a link when the home cluster has no area', () => {
    window.history.replaceState(null, '', '/activities?explore=route')
    expect(setup({ exploreAreas: [] }).result.current.generator).toBeNull()
  })

  it('plans a run in a quartier with today’s plan, and gives the map back as it was on close', () => {
    const { result, onOpen, onReturn } = setup({ expanded: true })
    act(() => result.current.planRun('test-unit'))
    expect(onOpen).toHaveBeenCalled()
    expect(result.current.generator).toMatchObject({ unitId: 'test-unit', km: 8, pace: 340, plan: { date: '2026-10-27' } })
    expect(result.current.generatorOpen).toBe(true)
    act(() => result.current.setKm(10.5))
    expect(result.current.generator?.km).toBe(10.5)
    act(() => result.current.close())
    expect(onReturn).toHaveBeenCalledWith({ expanded: true, unitId: 'test-open' })
  })

  it('sends a map tap to the start, then to a new spot while marking, and to nothing from the quartier', async () => {
    const { result } = setup()
    act(() => result.current.planRun('test-unit'))
    expect(result.current.start).toEqual({ mode: 'pick', origin: null, waiting: true })
    act(() => result.current.mapPick?.([-150.01, 0.01]))
    expect(result.current.start.origin).toEqual([-150.01, 0.01])

    act(() => result.current.avoid.setMarking(true))
    await act(async () => result.current.mapPick?.([-150.02, 0.02]))
    expect(spots.add).toHaveBeenCalledWith([-150.02, 0.02], 80)
    expect(result.current.avoid.marking).toBe(false)
    expect(result.current.avoid.spots).toHaveLength(1)
    expect(result.current.start.origin).toEqual([-150.01, 0.01])

    act(() => result.current.setStartMode('quartier'))
    expect(result.current.mapPick).toBeNull()
  })

  it('keeps no spot past its expiry and removes it from Firestore', async () => {
    spots.read.mockResolvedValueOnce([
      { id: 'old', lon: -150, lat: 0, radiusM: 80, createdAt: '2026-09-01', reason: 'mud', expiresOn: '2026-09-22' },
      { id: 'live', lon: -150, lat: 0, radiusM: 80, createdAt: '2026-10-20', reason: 'mud', expiresOn: '2026-11-10' },
    ])
    const { result } = setup()
    await act(async () => result.current.planRun('test-unit'))
    expect(result.current.avoid.spots.map((s) => s.id)).toEqual(['live'])
    expect(spots.remove).toHaveBeenCalledWith('old')
  })

  it('opens the generator with no spots for a viewer who is not the owner', async () => {
    owner.isOwner = false
    const { result } = setup()
    await act(async () => result.current.planRun('test-unit'))
    expect(result.current.avoid.enabled).toBe(false)
    expect(spots.read).not.toHaveBeenCalled()
  })
})

describe('generatorUnit', () => {
  const file = { features: [{ properties: { id: 'test-a', name: 'Alpha' } }, { properties: { id: 'test-b', name: 'Bravo' } }] } as unknown as ExploreAreaFile
  const coverage = {
    nextId: null,
    units: [
      { id: 'test-a', name: 'Alpha', pct: 40 },
      { id: 'test-b', name: 'Bravo', pct: 10 },
    ],
  } as unknown as AreaCoverage

  it('is the quartier asked for, else the next, else the least explored', () => {
    expect(generatorUnit(file, null, 'test-a')).toEqual({ id: 'test-a', name: 'Alpha' })
    expect(generatorUnit(file, null, null)).toBeNull()
    expect(generatorUnit(file, { ...coverage, nextId: 'test-a' }, null)).toEqual({ id: 'test-a', name: 'Alpha' })
    expect(generatorUnit(file, coverage, null)).toEqual({ id: 'test-b', name: 'Bravo' })
    expect(generatorUnit(null, coverage, 'test-a')).toBeNull()
  })
})
