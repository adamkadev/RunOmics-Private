'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { t } from '@/i18n'
import type { SessionDay } from '@/domain/explore/climbBudget'
import { runDarkness } from '@/domain/explore/daylight'
import type { ExploreAreaRef, RoutePreferences, ScoredRoute } from '@/domain/explore/types'
import { formatPercent, formatWeekday } from '@/lib/formatters'
import { useOwnerAuth } from '@/lib/useOwnerAuth'
import { useNavigationOrigin } from '@/components/layout/NavigationHistory'
import { Glass, GlassLayers, GLASS_CIRCLE, glassClass } from '@/components/ui/GlassSurface'
import { MapAttribution, type MapCredit } from '@/components/ui/MapAttribution'
import { planRouteKm, type ExploreFrom } from './exploreHref'
import { RouteGeneratorPanel } from './RouteGeneratorPanel'
import { generatorBack, routeStats, runStart, type ExplorePlan } from './routeGenerator'
import { routeGpxFile } from './routeGpx'
import type { RouteStartMode, RouteStartState } from './routeStart'
import type { AvoidSpots } from './useAvoidSpots'
import { useFitsWhole } from './useFitsWhole'
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
  target: { id: string; name: string } | null
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

  const back = () => {
    const action = generatorBack(from, origin)
    if (action.kind === 'back') router.back()
    else if (action.kind === 'push') router.push(action.href)
    else onClose()
  }

  const gpxFile = () =>
    route && target
      ? routeGpxFile({ unitName: target.name, coordinates: route.candidate.coordinates, distanceM: route.candidate.distanceM, time: new Date().toISOString() })
      : null

  const name = target?.name ?? area.name
  const newText = stats ? e.newShare(formatPercent(stats.newPct)) : null
  // "Loop" stays while the name fits whole beside it.
  const { textRef: nameRef, whole: loopShown } = useFitsWhole<HTMLSpanElement>(`${name}|${newText ?? ''}`)
  const tail = [...(loopShown ? [e.loop] : []), ...(newText ? [newText] : [])].join(' · ')

  return (
    <>
      <div data-testid="route-generator-bar" className="absolute inset-x-4 top-3 z-30 flex items-center gap-3">
        <button type="button" onClick={back} aria-label={e.back} className={glassClass('regular', GLASS_CIRCLE)}>
          <GlassLayers />
          <ChevronLeft size={22} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <Glass data-testid="route-generator-pill" className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 px-4 text-[16px] leading-5">
          {/* "N% new" always whole: short of room, "Loop" goes first (the
              panel says it too), then the name gives way. */}
          <span ref={nameRef} className="min-w-0 truncate font-semibold text-foreground">
            {name}
          </span>
          {tail && <span className="shrink-0 whitespace-nowrap text-[var(--text-2)]">· {tail}</span>}
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
          onStartModeChange={onStartModeChange}
          day={day}
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

