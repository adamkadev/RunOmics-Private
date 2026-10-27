'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { circleOf, clearOfSpots, spotsInReach, type AvoidCircle, type AvoidSpot } from '@/domain/explore/avoidSpots'
import type { RouteContext } from '@/domain/explore/routeScore'
import type { ExploreAreaRef, RouteCandidate, RoutePreferences, ScoredRoute } from '@/domain/explore/types'
import { getExploreEngine, type ExploreEngine } from './exploreEngine'
import { RouteRequestError, requestRouteBatch, type RouteFailure } from './routeApi'
import { FIRST_SEED, ROUTE_BATCH, ROUTE_DEBOUNCE_MS, batchSeeds } from './routeGenerator'
import { areaKey, type LonLat } from './workerProtocol'
import { reportClientError } from '@/lib/reportClientError'

export interface RouteGeneratorInput {
  enabled: boolean
  area: ExploreAreaRef | null
  unitId: string | null
  km: number
  prefs: RoutePreferences
  /** The runs are in the worker: before that every street would score as new. */
  tracksReady: boolean
  /** Whose token the route wants on a public site. */
  user: User | null
  /** False while the owner check is still running: a request then would go out without the token. */
  authReady: boolean
  /** The point tapped on the map, where the loop starts; null starts inside the quartier. */
  origin: LonLat | null
  /** True until the start is tapped. */
  waiting: boolean
  /** On the device only: the worker picks no via near it. */
  home: LonLat | null
  /** The day's session and whether the loop runs into the dark: they re-rank, they ask nothing new. */
  context: RouteContext
  /** Marked by the owner and not expired: the start, the vias and the provider keep clear of those within reach. */
  avoidSpots: readonly AvoidSpot[]
}

export type RouteGeneratorStatus = 'idle' | 'generating' | 'ready' | 'error'

/** The client's own failures: no loop of this distance reaches the quartier from the start, or the runs never came. */
export type GeneratorFailure = RouteFailure | 'tooFar' | 'tracks'

export interface RouteGenerator {
  status: RouteGeneratorStatus
  failure: GeneratorFailure | null
  /** With `tooFar`: the shortest distance whose loop reaches the quartier. */
  minKm: number | null
  /** The loop the panel's numbers are for. */
  route: ScoredRoute | null
  /** Also the last one for this quartier while the next is found. */
  drawn: ScoredRoute | null
  /** Changes with every loop shown. */
  routeKey: string | null
  regenerate: () => void
  retry: () => void
}

export interface RouteGeneratorDeps {
  engineFor?: () => ExploreEngine
  request?: typeof requestRouteBatch
  debounceMs?: number
}

interface Cursor {
  forKey: string
  seedBase: number
  attempt: number
}

interface Result {
  fetchKey: string
  unitKey: string
  startKey: string
  candidates: RouteCandidate[]
  ranked: ScoredRoute[]
  /** The preferences the ranking was scored with. */
  prefsKey: string
  index: number
  failure: GeneratorFailure | null
  minKm: number | null
}

interface QuartierStart {
  forKey: string
  start: LonLat | null
  failed: boolean
}

/** Back and forth on the stepper, or Regenerate past the last loop and back: a batch seen lately costs no new request. */
export const BATCH_CACHE_SIZE = 4

/** About a metre: GPS noise under it asks for no new batch. */
const startKeyOf = (origin: LonLat | null) => (origin ? `${origin[0].toFixed(5)},${origin[1].toFixed(5)}` : 'quartier')

const bit = (on: boolean) => (on ? 1 : 0)

const prefsKeyOf = (p: RoutePreferences, c: RouteContext) =>
  `${bit(p.avoidBusyRoads)}${bit(p.newStreetsFirst)}${bit(p.flatForReps)}|${c.day.session ?? '-'}${bit(c.day.beforeQuality)}${bit(c.dark)}`

const circlesKeyOf = (circles: readonly AvoidCircle[]) => circles.map((c) => c.join(':')).join(',')

/** Every toggle, the session and the daylight re-rank the batch in hand; the start, the distance and the spots in reach ask again. */
export function useRouteGenerator(input: RouteGeneratorInput, deps: RouteGeneratorDeps = {}): RouteGenerator {
  const { enabled, area, unitId, km, prefs, tracksReady, user, authReady, origin, waiting, home, context, avoidSpots } = input
  const { engineFor = getExploreEngine, request = requestRouteBatch, debounceMs = ROUTE_DEBOUNCE_MS } = deps
  const unitKey = `${area ? areaKey(area) : ''}|${unitId ?? ''}`
  const allCircles = useMemo(() => avoidSpots.map(circleOf), [avoidSpots])
  const allCirclesKey = circlesKeyOf(allCircles)

  // The quartier's own start depends on the spots too: it is worked out first, so the request can be keyed on it.
  const [startAttempt, setStartAttempt] = useState(0)
  const quartierStartKey = `${unitKey}|${allCirclesKey}|${startAttempt}`
  const needsQuartierStart = enabled && !!area && !!unitId && !origin && !waiting
  const [quartierStart, setQuartierStart] = useState<QuartierStart | null>(null)
  const resolvedStart = quartierStart?.forKey === quartierStartKey ? quartierStart : null
  const start = origin ?? resolvedStart?.start ?? null

  const active = enabled && !!area && !!unitId && tracksReady && authReady && !waiting && (!!origin || !!resolvedStart)
  const startKey = waiting ? 'waiting' : origin ? startKeyOf(origin) : `quartier@${startKeyOf(start)}`
  const inReach = useMemo(() => (start ? spotsInReach(avoidSpots, start, km * 1000) : []), [avoidSpots, start, km])
  const inReachKey = circlesKeyOf(inReach)
  const requestKey = `${unitKey}|${startKey}|${km}|${inReachKey}`
  const prefsKey = prefsKeyOf(prefs, context)

  const [cursorState, setCursor] = useState<Cursor | null>(null)
  const cursor = cursorState?.forKey === requestKey ? cursorState : { forKey: requestKey, seedBase: FIRST_SEED, attempt: 0 }
  const fetchKey = `${requestKey}|${cursor.seedBase}|${cursor.attempt}`
  const [result, setResult] = useState<Result | null>(null)

  // Read by the effects, which key on the strings built from them.
  const inputs = useRef({ area, unitId, km, prefs, context, user, seedBase: cursor.seedBase, result, unitKey, startKey, origin, start, home, inReach, allCircles })
  useLayoutEffect(() => {
    inputs.current = { area, unitId, km, prefs, context, user, seedBase: cursor.seedBase, result, unitKey, startKey, origin, start, home, inReach, allCircles }
  })

  // The quartier whose first batch has gone out: every request after it waits for the stepper to rest.
  const sentFor = useRef<string | null>(null)
  const batches = useRef(new Map<string, RouteCandidate[]>())

  useEffect(() => {
    if (!needsQuartierStart) return
    const { area: ref, unitId: unit, allCircles: circles } = inputs.current
    if (!ref || !unit) return
    let live = true
    engineFor()
      .routeStart(ref, { unitId: unit, avoid: [...circles] })
      .then(
        (found) => {
          if (live) setQuartierStart({ forKey: quartierStartKey, start: found, failed: false })
        },
        (err) => {
          if (!live) return
          console.warn('Route start failed', err)
          setQuartierStart({ forKey: quartierStartKey, start: null, failed: true })
        },
      )
    return () => {
      live = false
    }
  }, [needsQuartierStart, quartierStartKey, engineFor])

  useEffect(() => {
    if (!active) return
    const {
      area: ref,
      unitId: unit,
      km: distanceKm,
      prefs: wanted,
      context: scoredFor,
      user: owner,
      seedBase,
      result: shown,
      unitKey: forUnit,
      startKey: forStart,
      origin: from,
      start: startPoint,
      home: homePoint,
      inReach: avoid,
    } = inputs.current
    if (!ref || !unit) return
    // Back on the question the batch in hand answers (the stepper went there and back): the loop shown stays.
    if (shown && shown.fetchKey === fetchKey && !shown.failure) return
    const controller = new AbortController()
    const cached = batches.current.get(fetchKey)
    // Any change after a quartier's first batch, even before it comes back, waits for the stepper to rest:
    // an aborted request still costs the provider's quota on the server.
    const delay = cached || sentFor.current !== forUnit ? 0 : debounceMs
    const timer = setTimeout(() => {
      if (!cached) sentFor.current = forUnit
      void (async () => {
        const engine = engineFor()
        const targetM = distanceKm * 1000
        const seeds = batchSeeds(seedBase)
        const failed = (failure: GeneratorFailure, minKm: number | null = null) =>
          setResult({ fetchKey, unitKey: forUnit, startKey: forStart, candidates: [], ranked: [], prefsKey: prefsKeyOf(wanted, scoredFor), index: 0, failure, minKm })
        try {
          let candidates = cached
          if (!candidates) {
            let begin: LonLat | null = startPoint
            let vias: LonLat[][] | undefined
            if (from) {
              const plan = await engine.routePlan(ref, { unitId: unit, origin: from, home: homePoint, homeFromTracks: true, distanceM: targetM, seeds, avoid })
              if (controller.signal.aborted) return
              if (plan?.kind === 'tooFar') return failed('tooFar', plan.minKm)
              begin = plan ? from : null
              vias = plan?.vias.some((list) => list.length > 0) ? plan.vias : undefined
            }
            if (!begin) throw new RouteRequestError('noRoute')
            const batch = await request(
              { start: begin, distanceM: targetM, seeds, ...(vias ? { vias } : {}), ...(avoid.length ? { avoid } : {}) },
              { user: owner, signal: controller.signal },
            )
            if (controller.signal.aborted) return
            const stopsOf = (seed: number): LonLat[] => [begin, ...(vias?.[seeds.indexOf(seed)] ?? [])]
            // ORS leaves out a spot by the start or a via, and may cut the corner of one it was given.
            candidates = batch.candidates.filter((c) => clearOfSpots(c.coordinates, avoid, stopsOf(c.seed)))
            remember(batches.current, fetchKey, candidates)
          }
          if (candidates.length === 0) throw new RouteRequestError('noRoute')
          const ranked = await engine.scoreRoutes(ref, { candidates, targetM, prefs: wanted, context: scoredFor })
          if (controller.signal.aborted) return
          if (ranked.length === 0) throw new RouteRequestError('noRoute')
          setResult({
            fetchKey,
            unitKey: forUnit,
            startKey: forStart,
            candidates,
            ranked,
            prefsKey: prefsKeyOf(wanted, scoredFor),
            index: 0,
            failure: null,
            minKm: null,
          })
        } catch (err) {
          if (controller.signal.aborted) return
          if (!(err instanceof RouteRequestError)) {
            console.warn('Route generation failed', err)
            reportClientError('route', err)
          }
          failed(err instanceof RouteRequestError ? err.reason : 'upstream')
        }
      })()
    }, delay)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [active, fetchKey, engineFor, request, debounceMs])

  const current = active && result?.fetchKey === fetchKey ? result : null
  const rescore = current && !current.failure && current.prefsKey !== prefsKey ? current : null
  useEffect(() => {
    if (!rescore) return
    let stale = false
    const { area: ref, km: distanceKm, prefs: wanted, context: scoredFor } = inputs.current
    if (!ref) return
    engineFor()
      .scoreRoutes(ref, { candidates: rescore.candidates, targetM: distanceKm * 1000, prefs: wanted, context: scoredFor })
      .then((ranked) => {
        if (stale) return
        setResult((prev) => (prev === rescore ? { ...rescore, ranked, prefsKey: prefsKeyOf(wanted, scoredFor), index: 0 } : prev))
      })
      .catch((err) => {
        if (stale) return
        console.warn('Route scoring failed', err)
        setResult((prev) => (prev === rescore ? { ...rescore, prefsKey: prefsKeyOf(wanted, scoredFor), failure: 'upstream' } : prev))
      })
    return () => {
      stale = true
    }
  }, [rescore, engineFor])

  const startFailed = needsQuartierStart && !!resolvedStart && (resolvedStart.failed || !resolvedStart.start)
  const status: RouteGeneratorStatus = startFailed
    ? 'error'
    : !active
    ? enabled
      ? 'generating'
      : 'idle'
    : !current || rescore
      ? 'generating'
      : current.failure
        ? 'error'
        : 'ready'
  const route = status === 'ready' && current ? (current.ranked[current.index] ?? null) : null
  // While the next loop is found, the last one of this quartier and start stays drawn; a failure clears it.
  const last = result && !result.failure && result.unitKey === unitKey && result.startKey === startKey ? (result.ranked[result.index] ?? null) : null
  const drawn = route ?? (enabled && status === 'generating' ? last : null)

  const nextBatch = useCallback(() => {
    setCursor({ forKey: requestKey, seedBase: cursor.seedBase + ROUTE_BATCH, attempt: cursor.attempt })
  }, [requestKey, cursor.seedBase, cursor.attempt])

  const regenerate = useCallback(() => {
    if (!current) return
    if (current.failure) {
      // No loop from these seeds: the next five may find one.
      if (current.failure === 'noRoute') nextBatch()
      return
    }
    if (current.index + 1 < current.ranked.length) setResult({ ...current, index: current.index + 1 })
    else nextBatch()
  }, [current, nextBatch])

  const retry = useCallback(() => {
    if (startFailed) setStartAttempt((n) => n + 1)
    else setCursor({ forKey: requestKey, seedBase: cursor.seedBase, attempt: cursor.attempt + 1 })
  }, [startFailed, requestKey, cursor.seedBase, cursor.attempt])

  return {
    status,
    failure: status === 'error' ? (startFailed ? (resolvedStart?.failed ? 'upstream' : 'noRoute') : (current?.failure ?? null)) : null,
    minKm: status === 'error' ? (current?.minKm ?? null) : null,
    route,
    drawn,
    // The batch and the loop's own seed: a re-rank that brings another loop first is another key.
    routeKey: route && current ? `${current.fetchKey}#${route.candidate.seed}` : null,
    regenerate,
    retry,
  }
}

function remember(cache: Map<string, RouteCandidate[]>, key: string, candidates: RouteCandidate[]) {
  cache.delete(key)
  cache.set(key, candidates)
  for (const oldest of cache.keys()) {
    if (cache.size <= BATCH_CACHE_SIZE) break
    cache.delete(oldest)
  }
}
