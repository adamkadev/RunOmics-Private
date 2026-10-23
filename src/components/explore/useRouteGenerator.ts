'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import type { ExploreAreaRef, RouteCandidate, RoutePreferences, ScoredRoute } from '@/domain/explore/types'
import { getExploreEngine, type ExploreEngine } from './exploreEngine'
import { RouteRequestError, requestRouteBatch, type RouteFailure } from './routeApi'
import { FIRST_SEED, ROUTE_BATCH, ROUTE_DEBOUNCE_MS, batchSeeds } from './routeGenerator'
import { areaKey } from './workerProtocol'

export interface RouteGeneratorInput {
  /** Only then does anything run. */
  enabled: boolean
  area: ExploreAreaRef | null
  /** The quartier to loop in; null until it is known. */
  unitId: string | null
  /** The distance asked for, on the stepper's grid. */
  km: number
  prefs: RoutePreferences
  /** The runs are in the worker (the coverage is in): before that every street would score as new. */
  tracksReady: boolean
  /** The signed-in owner, whose token the route wants on a public site; null for none. */
  user: User | null
  /** False while the owner check is still running: a request then would go out without the token. */
  authReady: boolean
}

export type RouteGeneratorStatus = 'idle' | 'generating' | 'ready' | 'error'

export interface RouteGenerator {
  status: RouteGeneratorStatus
  failure: RouteFailure | null
  /** The loop the panel's numbers are for; null while generating or failed. */
  route: ScoredRoute | null
  /** The loop to draw: the one shown, or the last one for this quartier while the next is found. */
  drawn: ScoredRoute | null
  /** Changes with every loop shown. */
  routeKey: string | null
  /** The next best loop; past the batch's last, a new batch (seeds + 5). */
  regenerate: () => void
  /** The same batch again, after a failure. */
  retry: () => void
}

export interface RouteGeneratorDeps {
  engineFor?: () => ExploreEngine
  request?: typeof requestRouteBatch
  debounceMs?: number
}

interface Cursor {
  /** The request these seeds are for; another request starts again at the first seed. */
  forKey: string
  seedBase: number
  attempt: number
}

interface Result {
  fetchKey: string
  unitKey: string
  candidates: RouteCandidate[]
  ranked: ScoredRoute[]
  /** The preferences the ranking was scored with. */
  prefsKey: string
  index: number
  failure: RouteFailure | null
}

const prefsKeyOf = (p: RoutePreferences) => `${p.avoidBusyRoads ? 1 : 0}${p.newStreetsFirst ? 1 : 0}`

/**
 * The route generator's loops (S3): the quartier's public start from the
 * worker, a batch of five loops from the routing proxy, ranked by the worker
 * against every run, best first.
 *
 * A new distance waits for the stepper to rest; "Avoid busy roads" asks for
 * a new batch (the provider routes around them), "New streets first" only
 * re-ranks the one in hand. Regenerate walks down the ranking, then asks
 * for the next five seeds. An answer to an older question is dropped.
 */
export function useRouteGenerator(input: RouteGeneratorInput, deps: RouteGeneratorDeps = {}): RouteGenerator {
  const { enabled, area, unitId, km, prefs, tracksReady, user, authReady } = input
  const { engineFor = getExploreEngine, request = requestRouteBatch, debounceMs = ROUTE_DEBOUNCE_MS } = deps
  const active = enabled && !!area && !!unitId && tracksReady && authReady
  const unitKey = `${area ? areaKey(area) : ''}|${unitId ?? ''}`
  const requestKey = `${unitKey}|${km}|${prefs.avoidBusyRoads ? 1 : 0}`
  const prefsKey = prefsKeyOf(prefs)

  const [cursorState, setCursor] = useState<Cursor | null>(null)
  const cursor = cursorState?.forKey === requestKey ? cursorState : { forKey: requestKey, seedBase: FIRST_SEED, attempt: 0 }
  const fetchKey = `${requestKey}|${cursor.seedBase}|${cursor.attempt}`
  const [result, setResult] = useState<Result | null>(null)

  // Read by the effects, which key on the strings built from them.
  const inputs = useRef({ area, unitId, km, prefs, user, seedBase: cursor.seedBase, result, unitKey })
  useLayoutEffect(() => {
    inputs.current = { area, unitId, km, prefs, user, seedBase: cursor.seedBase, result, unitKey }
  })

  // The quartier whose first batch has gone out: every request after it waits for the stepper to rest.
  const sentFor = useRef<string | null>(null)

  useEffect(() => {
    if (!active) return
    const { area: ref, unitId: unit, km: distanceKm, prefs: wanted, user: owner, seedBase, result: shown, unitKey: forUnit } = inputs.current
    if (!ref || !unit) return
    // Back on the question the batch in hand answers (the stepper went there
    // and back): nothing to ask, and the loop shown - Regenerate's place, a
    // save - stays.
    if (shown && shown.fetchKey === fetchKey && !shown.failure) return
    const controller = new AbortController()
    // The first loops of a quartier at once; any change after that - even
    // before they come back - once the stepper rests. An aborted request
    // still costs the provider's quota on the server.
    const delay = sentFor.current === forUnit ? debounceMs : 0
    const timer = setTimeout(() => {
      sentFor.current = forUnit
      void (async () => {
        const engine = engineFor()
        const targetM = distanceKm * 1000
        try {
          const start = await engine.routeStart(ref, { unitId: unit })
          if (!start) throw new RouteRequestError('noRoute')
          const batch = await request(
            { start, distanceM: targetM, seeds: batchSeeds(seedBase), avoidBusyRoads: wanted.avoidBusyRoads },
            { user: owner, signal: controller.signal },
          )
          if (controller.signal.aborted) return
          const ranked = await engine.scoreRoutes(ref, { candidates: batch.candidates, targetM, prefs: wanted })
          if (controller.signal.aborted) return
          if (ranked.length === 0) throw new RouteRequestError('noRoute')
          setResult({ fetchKey, unitKey: forUnit, candidates: batch.candidates, ranked, prefsKey: prefsKeyOf(wanted), index: 0, failure: null })
        } catch (err) {
          if (controller.signal.aborted) return
          if (!(err instanceof RouteRequestError)) console.warn('Route generation failed', err)
          const failure: RouteFailure = err instanceof RouteRequestError ? err.reason : 'upstream'
          setResult({ fetchKey, unitKey: forUnit, candidates: [], ranked: [], prefsKey: prefsKeyOf(wanted), index: 0, failure })
        }
      })()
    }, delay)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [active, fetchKey, engineFor, request, debounceMs])

  // "New streets first" re-ranks the batch in hand; nothing is asked of the provider.
  const current = active && result?.fetchKey === fetchKey ? result : null
  const rescore = current && !current.failure && current.prefsKey !== prefsKey ? current : null
  useEffect(() => {
    if (!rescore) return
    let stale = false
    const { area: ref, km: distanceKm, prefs: wanted } = inputs.current
    if (!ref) return
    engineFor()
      .scoreRoutes(ref, { candidates: rescore.candidates, targetM: distanceKm * 1000, prefs: wanted })
      .then((ranked) => {
        if (stale) return
        setResult((prev) => (prev === rescore ? { ...rescore, ranked, prefsKey: prefsKeyOf(wanted), index: 0 } : prev))
      })
      .catch((err) => {
        if (stale) return
        console.warn('Route scoring failed', err)
        setResult((prev) => (prev === rescore ? { ...rescore, prefsKey: prefsKeyOf(wanted), failure: 'upstream' } : prev))
      })
    return () => {
      stale = true
    }
  }, [rescore, engineFor])

  const status: RouteGeneratorStatus = !active
    ? enabled
      ? 'generating'
      : 'idle'
    : !current || rescore
      ? 'generating'
      : current.failure
        ? 'error'
        : 'ready'
  const route = status === 'ready' && current ? (current.ranked[current.index] ?? null) : null
  // While the next loop is found, the last one of this quartier stays drawn; a failure clears it.
  const last = result && !result.failure && result.unitKey === unitKey ? (result.ranked[result.index] ?? null) : null
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
    setCursor({ forKey: requestKey, seedBase: cursor.seedBase, attempt: cursor.attempt + 1 })
  }, [requestKey, cursor.seedBase, cursor.attempt])

  return {
    status,
    failure: status === 'error' ? (current?.failure ?? null) : null,
    route,
    drawn,
    // The batch and the loop's own seed: a re-rank that brings another loop first is another key.
    routeKey: route && current ? `${current.fetchKey}#${route.candidate.seed}` : null,
    regenerate,
    retry,
  }
}
