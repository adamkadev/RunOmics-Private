'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { t } from '@/i18n'
import type { SessionDay } from '@/domain/explore/climbBudget'
import { runDarkness } from '@/domain/explore/daylight'
import type { ExploreAreaRef, RoutePreferences, ScoredRoute } from '@/domain/explore/types'
import { formatWeekday } from '@/lib/formatters'
import { reverseGeocode } from '@/lib/reverseGeocode'
import { useOwnerAuth } from '@/lib/useOwnerAuth'
import { useNavigationOrigin } from '@/components/layout/NavigationHistory'
import { Glass, GlassLayers, GLASS_CIRCLE, glassClass } from '@/components/ui/GlassSurface'
import { MapAttribution, type MapCredit } from '@/components/ui/MapAttribution'
import { planRouteKm, type ExploreFrom } from './exploreHref'
import { RouteGeneratorPanel } from './RouteGeneratorPanel'
import { generatorBack, routeStats, runStart, type ExplorePlan } from './routeGenerator'
import { routeGpxFile } from './routeGpx'
import { startLineOf, type RouteStartMode, type RouteStartState } from './routeStart'
import type { AvoidSpots } from './useAvoidSpots'
import { useRouteGenerator } from './useRouteGenerator'
import type { LonLat } from './workerProtocol'

/** The ending time is a guess without a pace: 6:00/km is a typical easy pace. */
const FALLBACK_PACE_SEC_PER_KM = 360

const NOW_TICK_MS = 60_000

/** A clock read once a minute, so the daylight rule follows the time while the panel stays open. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), NOW_TICK_MS)
    return () => clearInterval(id)
  }, [])
  return now
}

/** The loops' credit, shown in the ⓘ while the generator is open (the routing proxy's own line). */
export const ROUTE_CREDIT: MapCredit = { text: '© openrouteservice by HeiGIT' }

export interface RouteGeneratorModeProps {
  area: ExploreAreaRef
  /** The quartier to loop in; null until the area (or its coverage, for the next one) is in. */
  target: { id: string; name: string; distanceKm?: number | null } | null
  /** The runs are in the worker: loops can be scored against them. */
  tracksReady: boolean
  /** The runs never came: no loop can be scored until they are fetched again. */
  tracksFailed?: boolean
  onRetryTracks?: () => void
  distanceKm: number
  onDistanceChange: (km: number) => void
  prefs: RoutePreferences
  onPrefsChange: (prefs: RoutePreferences) => void
  /** The parent owns it: the map draws the start and takes the tap that picks one. */
  start: RouteStartState
  onStartModeChange: (mode: RouteStartMode) => void
  /** The session the loop is for and whether a quality one follows it. */
  day: SessionDay
  /** The kind of the quality session the next day, "Threshold", or null. */
  nextKind?: string | null
  avoid: AvoidSpots
  home: LonLat | null
  paceSecPerKm: number | null
  /** The session it plans for (the linked day's, or today's), or null. */
  plan: ExplorePlan | null
  /** 'YYYY-MM-DD' on this device: whether that session is today's. */
  today: string | null
  /** Where the link came from: Back goes there. */
  from: ExploreFrom | null
  /** The area's own credits, beside the map's. */
  credits: readonly MapCredit[]
  onClose: () => void
  /** The loop to draw on the map (the parent owns the map), or null. */
  onDrawnChange: (route: ScoredRoute | null) => void
  /** The panel, for the camera to keep the loop above it. */
  panelRef?: Ref<HTMLDivElement>
}

/** Mounted only while it is open, so the owner check and the requests start with it, never for the heat. */
export function RouteGeneratorMode({
  area,
  target,
  tracksReady,
  tracksFailed = false,
  onRetryTracks,
  distanceKm,
  onDistanceChange,
  prefs,
  onPrefsChange,
  start,
  onStartModeChange,
  day,
  nextKind = null,
  avoid,
  home,
  paceSecPerKm,
  plan,
  today,
  from,
  credits,
  onClose,
  onDrawnChange,
  panelRef,
}: RouteGeneratorModeProps) {
  const e = t.pages.map.explore
  const router = useRouter()
  const origin = useNavigationOrigin()
  const owner = useOwnerAuth()
  const now = useNow()
  const [west, south, east, north] = area.bbox
  const [sunLon, sunLat] = start.origin ?? [(west + east) / 2, (south + north) / 2]
  const darkness = useMemo(
    () =>
      runDarkness({
        ...runStart(plan, today, now),
        lat: sunLat,
        lon: sunLon,
        durationS: distanceKm * (paceSecPerKm ?? FALLBACK_PACE_SEC_PER_KM),
      }),
    [plan, today, now, sunLat, sunLon, distanceKm, paceSecPerKm],
  )
  const context = useMemo(() => ({ day, dark: darkness !== null }), [day, darkness])
  const generator = useRouteGenerator({
    enabled: true,
    area,
    unitId: target?.id ?? null,
    km: distanceKm,
    prefs,
    tracksReady,
    user: owner.isOwner ? owner.user : null,
    authReady: !owner.loading,
    origin: start.origin,
    waiting: start.waiting,
    home,
    context,
    avoidSpots: avoid.spots,
  })
  const { route, drawn } = generator
  const noTracks = tracksFailed && !tracksReady

  const onDrawnRef = useRef(onDrawnChange)
  useLayoutEffect(() => {
    onDrawnRef.current = onDrawnChange
  })
  useEffect(() => {
    onDrawnRef.current(drawn)
  }, [drawn])
  // Closed, the map draws no loop.
  useEffect(() => () => onDrawnRef.current(null), [])

  const stats = useMemo(() => (route ? routeStats(route, paceSecPerKm) : null), [route, paceSecPerKm])
  const allCredits = useMemo(() => [...credits, ROUTE_CREDIT], [credits])

  const backAction = generatorBack(from, origin)
  const back = () => {
    if (backAction.kind === 'back') router.back()
    else if (backAction.kind === 'push') router.push(backAction.href)
  }
  const street = useStartStreet(start.mode === 'pick' ? start.origin : null)
  const startLine = startLineOf(start, target, street, home)

  const gpxFile = () =>
    route && target
      ? routeGpxFile({ unitName: target.name, coordinates: route.candidate.coordinates, distanceM: route.candidate.distanceM, time: new Date().toISOString() })
      : null

  return (
    <>
      <div data-testid="route-generator-bar" className="absolute inset-x-4 top-3 z-30 flex items-center gap-3">
        {/* Without a page to go back to, ✕ on the panel is the one way out. */}
        {backAction.kind !== 'close' && (
          <button type="button" onClick={back} aria-label={e.back} className={glassClass('regular', GLASS_CIRCLE)}>
            <GlassLayers />
            <ChevronLeft size={22} strokeWidth={2.2} aria-hidden="true" />
          </button>
        )}
        <Glass data-testid="route-generator-pill" className="flex h-11 min-w-0 flex-1 items-center justify-center px-4 text-[16px] font-semibold leading-5 text-foreground">
          {e.loop}
        </Glass>
      </div>

      <div className="pointer-events-none absolute inset-x-[var(--sheet-inset)] bottom-[var(--sheet-inset)] z-40 mx-auto flex max-w-[420px] flex-col items-end gap-2">
        <MapAttribution className="pointer-events-auto mr-3" extraCredits={allCredits} />
        <RouteGeneratorPanel
          ref={panelRef}
          unitName={target?.name ?? null}
          distanceKm={distanceKm}
          onDistanceChange={onDistanceChange}
          plan={plan ? { heading: !today || plan.date === today ? e.todaysPlan : e.planFor(formatWeekday(plan.date, true)), label: plan.label, km: planRouteKm(plan.distanceM) } : null}
          start={start}
          startLine={startLine}
          onStartModeChange={onStartModeChange}
          day={day}
          nextKind={nextKind}
          darkness={darkness}
          avoid={avoid}
          prefs={prefs}
          onPrefsChange={onPrefsChange}
          status={noTracks ? 'error' : generator.status === 'idle' ? 'generating' : generator.status}
          failure={noTracks ? 'tracks' : generator.failure}
          minKm={generator.minKm}
          stats={stats}
          paceSecPerKm={paceSecPerKm}
          routeKey={generator.routeKey}
          gpxFile={gpxFile}
          onRegenerate={generator.regenerate}
          onRetry={noTracks ? (onRetryTracks ?? generator.retry) : generator.retry}
          onClose={onClose}
        />
      </div>
    </>
  )
}

/** The tapped start's street, once MapTiler names it; null without a token or an answer. */
function useStartStreet(origin: LonLat | null): string | null {
  const [found, setFound] = useState<{ key: string; street: string | null } | null>(null)
  const key = origin ? `${origin[0]},${origin[1]}` : null
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPTILER_TOKEN
    if (!origin || !key || !token) return
    let live = true
    void reverseGeocode(origin[0], origin[1], token, 'street').then((street) => {
      if (live) setFound({ key, street })
    })
    return () => {
      live = false
    }
  }, [origin, key])
  return found && found.key === key ? found.street : null
}
