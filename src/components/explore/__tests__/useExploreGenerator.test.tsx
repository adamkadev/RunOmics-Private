import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AreaCoverage, ExploreAreaFile, ExploreAreaRef } from '@/domain/explore/types'
import type { ExplorePlan } from '../routeGenerator'
import { generatorChoices, generatorUnit, useExploreGenerator, type ExploreGeneratorInput } from '../useExploreGenerator'



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

  it('switches the loop to another quartier, keeping its distance and start', () => {
    const { result } = setup()
    act(() => result.current.planRun('test-unit'))
    act(() => result.current.mapPick?.([-150.01, 0.01]))
    act(() => result.current.setKm(10.5))
    act(() => result.current.setUnit('test-other'))
    expect(result.current.generator).toMatchObject({ unitId: 'test-other', km: 10.5 })
    expect(result.current.picked).toEqual([-150.01, 0.01])
  })

  it('switches nothing while the generator is shut', () => {
    const { result } = setup()
    act(() => result.current.setUnit('test-other'))
    expect(result.current.generator).toBeNull()
  })

  it('sends a map tap to the start while open, and nowhere once shut', () => {
    const { result } = setup()
    expect(result.current.mapPick).toBeNull()
    act(() => result.current.planRun('test-unit'))
    expect(result.current.picked).toBeNull()
    act(() => result.current.mapPick?.([-150.01, 0.01]))
    expect(result.current.picked).toEqual([-150.01, 0.01])
    act(() => result.current.close())
    expect(result.current.picked).toBeNull()
    expect(result.current.mapPick).toBeNull()
  })
})

describe('generatorUnit', () => {
  const file = { features: [{ properties: { id: 'test-a', name: 'Alpha' } }, { properties: { id: 'test-b', name: 'Bravo' } }] } as unknown as ExploreAreaFile
  const coverage = {
    nextId: null,
    units: [
      { id: 'test-a', name: 'Alpha', pct: 40, distanceKm: 0.9 },
      { id: 'test-b', name: 'Bravo', pct: 10 },
    ],
  } as unknown as AreaCoverage

  it('is the quartier asked for, else the next, else the least explored', () => {
    expect(generatorUnit(file, null, 'test-a')).toEqual({ id: 'test-a', name: 'Alpha', distanceKm: null })
    expect(generatorUnit(file, coverage, 'test-a')).toEqual({ id: 'test-a', name: 'Alpha', distanceKm: 0.9 })
    expect(generatorUnit(file, null, null)).toBeNull()
    expect(generatorUnit(file, { ...coverage, nextId: 'test-a' }, null)).toEqual({ id: 'test-a', name: 'Alpha', distanceKm: 0.9 })
    expect(generatorUnit(file, coverage, null)).toEqual({ id: 'test-b', name: 'Bravo', distanceKm: null })
    expect(generatorUnit(null, coverage, 'test-a')).toBeNull()
  })
})

describe('generatorChoices', () => {
  const coverage = {
    nextId: 'test-c',
    units: [
      { id: 'test-a', name: 'Bravo', pct: 40, total: 12 },
      { id: 'test-b', name: 'Alpha', pct: 10, total: 30 },
      { id: 'test-c', name: 'Charlie', pct: 0, total: 8 },
      { id: 'test-d', name: 'Delta', pct: 0, total: 0 },
    ],
  } as unknown as AreaCoverage

  it('puts the automatic pick first, then the others by name', () => {
    expect(generatorChoices(coverage)).toEqual([
      { id: 'test-c', name: 'Charlie', pct: 0, auto: true },
      { id: 'test-b', name: 'Alpha', pct: 10, auto: false },
      { id: 'test-a', name: 'Bravo', pct: 40, auto: false },
    ])
  })

  it('falls back to the least explored as the automatic pick without a next one', () => {
    expect(generatorChoices({ ...coverage, nextId: null }).map((c) => [c.id, c.auto])).toEqual([
      ['test-c', true],
      ['test-b', false],
      ['test-a', false],
    ])
  })

  it('leaves out a quartier with no runnable street unless it is the one shown', () => {
    expect(generatorChoices(coverage).some((c) => c.id === 'test-d')).toBe(false)
    expect(generatorChoices(coverage, 'test-d').map((c) => c.id)).toEqual(['test-c', 'test-b', 'test-a', 'test-d'])
  })

  it('is empty until the coverage is in', () => {
    expect(generatorChoices(null)).toEqual([])
  })
})
