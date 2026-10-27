'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { areaForCluster } from '@/domain/explore/areaForCluster'
import type { SessionDay } from '@/domain/explore/climbBudget'
import type { AreaCoverage, ExploreAreaFile, ExploreAreaRef, RoutePreferences, ScoredRoute } from '@/domain/explore/types'
import type { RouteCluster } from '@/application/usecases/GetAllRoutes'
import { removeUrlParams, useUrlParam } from '@/lib/useUrlParam'
import { parseExploreRoute } from './exploreHref'
import { generatorDay, generatorPlan, generatorTarget, type ExplorePlan, type GeneratorTarget } from './routeGenerator'
import { routeStartState, type RouteStartMode, type RouteStartState } from './routeStart'
import { useAvoidSpots, type AvoidSpots } from './useAvoidSpots'
import type { LonLat } from './workerProtocol'

export const EXPLORE_PARAMS = ['explore', 'quartier', 'km', 'pace', 'date', 'from'] as const

export interface GeneratorOpener {
  element: HTMLElement | null
  /** Its card unmounts with the generator open: focus goes to the new card's button instead. */
  fromNextCard: boolean
}

export interface GeneratorState extends GeneratorTarget {
  plan: ExplorePlan | null
  /** null when a link opened it. */
  returnTo: { expanded: boolean; unitId: string | null } | null
  /** Where focus goes back to on close; null when a link opened it. */
  opener: GeneratorOpener | null
}

export interface ExploreGeneratorInput {
  clusters: readonly Pick<RouteCluster, 'labelPoint' | 'center'>[]
  /** The cluster a link opens the generator on. */
  defaultClusterIdx: number
  exploreAreas: readonly ExploreAreaRef[]
  explorePlans: readonly ExplorePlan[]
  today: string | null
  /** The selected cluster's area; none keeps the generator shut. */
  districtsArea: ExploreAreaRef | null
  medianKm: number | null
  easyPace: number | null
  /** The map's own state, given back on close as it was when the generator opened. */
  expanded: boolean
  openUnitId: string | null
  onReturn: (back: { expanded: boolean; unitId: string | null }) => void
  /** The quartier sheet closes as the generator opens. */
  onOpen: () => void
}

export interface ExploreGenerator {
  generator: GeneratorState | null
  generatorOpen: boolean
  /** A link opened it on mount. */
  linked: boolean
  prefs: RoutePreferences
  setPrefs: (prefs: RoutePreferences) => void
  planRun: (unitId: string) => void
  close: () => void
  setKm: (km: number) => void
  drawn: ScoredRoute | null
  setDrawn: (route: ScoredRoute | null) => void
  start: RouteStartState
  setStartMode: (mode: RouteStartMode) => void
  avoid: AvoidSpots
  day: SessionDay
  /** What a tap on the map does while it is open: mark a spot, set the start, or nothing. */
  mapPick: ((lngLat: LonLat) => void) | null
  /** The opener of the generator closed last, once: focus goes back to it when the map it gives back has rendered. */
  takeClosedOpener: () => GeneratorOpener | null
}

export function useExploreGenerator(input: ExploreGeneratorInput): ExploreGenerator {
  const { clusters, defaultClusterIdx, exploreAreas, explorePlans, today, districtsArea, medianKm, easyPace, expanded, openUnitId, onReturn, onOpen } =
    input
  const [exploreParam] = useUrlParam('explore')
  const [kmParam] = useUrlParam('km')
  const [paceParam] = useUrlParam('pace')
  const [fromParam] = useUrlParam('from')
  const [dateParam] = useUrlParam('date')
  const [quartierParam] = useUrlParam('quartier')
  const [generator, setGenerator] = useState<GeneratorState | null>(() => {
    const link = parseExploreRoute({ explore: exploreParam, quartier: quartierParam, km: kmParam, pace: paceParam, date: dateParam, from: fromParam })
    const home = clusters[defaultClusterIdx]
    if (!link || !home || exploreAreas.length === 0 || !areaForCluster(exploreAreas, home)) return null
    const plan = generatorPlan(explorePlans, link, today)
    return { ...generatorTarget(link, { plan, medianKm, easyPace }), plan, returnTo: null, opener: null }
  })
  const [linked] = useState(generator !== null)
  const generatorOpen = generator !== null && !!districtsArea

  const [prefs, setPrefs] = useState<RoutePreferences>(() => ({
    avoidBusyRoads: true,
    newStreetsFirst: true,
    flatForReps: generator?.plan?.session === 'quality',
  }))
  const [drawn, setDrawn] = useState<ScoredRoute | null>(null)
  const [startMode, setStartMode] = useState<RouteStartMode>('pick')
  const [picked, setPicked] = useState<LonLat | null>(null)
  const start = useMemo(() => routeStartState(startMode, picked), [startMode, picked])
  const avoid = useAvoidSpots(generatorOpen, today ?? undefined)
  const { setMarking } = avoid
  const planDay = generator?.plan ?? null
  const day = useMemo(() => generatorDay(explorePlans, planDay, today), [explorePlans, planDay, today])
  const closedOpener = useRef<GeneratorOpener | null>(null)

  const planRun = useCallback(
    (unitId: string) => {
      const active = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
      const opener = { element: active, fromNextCard: !!active?.closest("[data-testid='next-quartier-card']") }
      const plan = generatorPlan(explorePlans, null, today)
      setGenerator({ ...generatorTarget(null, { unitId, plan, medianKm, easyPace }), plan, returnTo: { expanded, unitId: openUnitId }, opener })
      setPrefs((p) => ({ ...p, flatForReps: plan?.session === 'quality' }))
      onOpen()
    },
    [explorePlans, today, medianKm, easyPace, expanded, openUnitId, onOpen],
  )

  const close = useCallback(() => {
    const back = generator?.returnTo ?? null
    closedOpener.current = generator?.opener ?? null
    setGenerator(null)
    setDrawn(null)
    setStartMode('pick')
    setPicked(null)
    setMarking(false)
    if (back) onReturn(back)
    if (exploreParam !== null) removeUrlParams(EXPLORE_PARAMS)
  }, [generator, exploreParam, setMarking, onReturn])

  const setKm = useCallback((km: number) => setGenerator((g) => (g ? { ...g, km } : g)), [])

  const takeClosedOpener = useCallback(() => {
    const opener = closedOpener.current
    closedOpener.current = null
    return opener
  }, [])

  const mapPick = !generatorOpen ? null : avoid.marking ? avoid.mark : startMode === 'pick' ? setPicked : null

  return {
    generator,
    generatorOpen,
    linked,
    prefs,
    setPrefs,
    planRun,
    close,
    setKm,
    drawn,
    setDrawn,
    start,
    setStartMode,
    avoid,
    day,
    mapPick,
    takeClosedOpener,
  }
}

/** The quartier asked for, else the next one, else the least explored; null until the area (or its coverage) is in. */
export function generatorUnit(
  file: ExploreAreaFile | null,
  coverage: AreaCoverage | null,
  unitId: string | null,
): { id: string; name: string } | null {
  if (!file) return null
  const asked = unitId ? file.features.find((f) => f.properties.id === unitId) : undefined
  if (asked) return { id: asked.properties.id, name: asked.properties.name }
  if (!coverage) return null
  const next = coverage.units.find((u) => u.id === coverage.nextId) ?? [...coverage.units].sort((a, b) => a.pct - b.pct)[0]
  return next ? { id: next.id, name: next.name } : null
}
