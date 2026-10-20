'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { RecurringRoute } from '@/application/usecases/GetRecurringRoutes'
import { formatClock, formatDate, formatKm, formatMonthShortYear } from '@/lib/formatters'
import { reverseGeocode } from '@/lib/reverseGeocode'
import { useAccent } from '@/lib/useAccent'
import { t } from '@/i18n'
import { cardClass } from '@/components/ui/Card'
import { TRAIL_RUNS, formatGap, routeLatest, trailBars, type TrailTone } from './recordsView'

interface Props {
  routes: RecurringRoute[]
  thisYear: number
}

const OUTLINE_BOX = 100

/**
 * A route's distance by the app's one rule (design review, Oct 2026): one
 * decimal under 100 km, none above. formatDistance's second decimal under
 * 10 km put "7.20 km" in the same list as "12.9 km".
 */
function routeKm(km: number): string {
  return formatKm(km, km >= 100 ? 0 : 1)
}

/**
 * A date in as little width as it can take - the latest run's line and the
 * trail's two ends are narrow: a day this year, a month and year before
 * that.
 */
function compactDate(isoDate: string, thisYear: number): string {
  return Number(isoDate.slice(0, 4)) === thisYear
    ? formatDate(isoDate, { style: 'bare', year: 'never' })
    : formatMonthShortYear(isoDate)
}

function Outline({ path }: { path: string }) {
  return (
    <svg
      viewBox={`-6 -6 ${OUTLINE_BOX + 12} ${OUTLINE_BOX + 12}`}
      className="h-9 w-8 shrink-0 text-foreground/85"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const BAR_TONE = {
  best: 'bg-accent',
  latest: 'bg-foreground',
  other: 'bg-[var(--band)] opacity-60',
} as const

/**
 * With the white accent the best bar and the latest one are both near-white
 * and the pair reads as one (App Fixes 5a, rule 4). The latest becomes an
 * outline then, so the two still tell apart; every other accent keeps the
 * filled ink bar.
 */
function barTone(tone: TrailTone, monoAccent: boolean): string {
  if (tone === 'latest' && monoAccent) return 'border border-foreground bg-transparent'
  return BAR_TONE[tone]
}

/**
 * One bar per run in date order, taller for faster: the best in the accent,
 * the latest in ink, the rest dim. The dates of its two ends name the axis
 * (design review, Oct 2026): the bars are runs, not days.
 */
function PaceTrail({ route, thisYear, monoAccent }: { route: RecurringRoute; thisYear: number; monoAccent: boolean }) {
  const bars = trailBars(route)
  const runs = route.runs.slice(-TRAIL_RUNS)
  const first = runs[0] ? compactDate(runs[0].date, thisYear) : null
  const last = runs.length > 0 ? compactDate(runs[runs.length - 1]!.date, thisYear) : null

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <div data-testid="pace-trail" className="flex h-[38px] items-end gap-0.5" aria-hidden="true">
        {bars.map((bar) => (
          <span
            key={bar.activityId}
            data-tone={bar.tone}
            className={cn('box-border w-1 rounded-sm', barTone(bar.tone, monoAccent))}
            style={{ height: `${bar.heightPx}px` }}
          />
        ))}
      </div>
      {first && last && (
        <p data-testid="pace-trail-span" className="whitespace-nowrap text-caption leading-none text-muted-foreground">
          {first === last ? last : t.records.recurring.trailSpan(first, last)}
        </p>
      )}
    </div>
  )
}

/** The key to the bars' two colours, beside the line that says what a bar is. */
function TrailKey({ monoAccent }: { monoAccent: boolean }) {
  const r = t.records.recurring
  return (
    <div className="flex items-center justify-between gap-3 px-0.5 text-xs text-muted-foreground">
      <p>{r.trailKey}</p>
      <p className="flex shrink-0 items-center gap-2.5" aria-hidden="true">
        <span className="flex items-center gap-1">
          <span className={cn('h-2.5 w-1 rounded-sm', BAR_TONE.best)} />
          {r.legendBest}
        </span>
        <span className="flex items-center gap-1">
          <span className={cn('box-border h-2.5 w-1 rounded-sm', barTone('latest', monoAccent))} />
          {r.legendLatest}
        </span>
      </p>
    </div>
  )
}

/** "best 5:07 · last 5:19 +12s", or "best 5:16 · new best Sep 17" when the latest run set it. */
function BestAndLast({ route, thisYear }: { route: RecurringRoute; thisYear: number }) {
  const r = t.records.recurring
  const latest = routeLatest(route)
  return (
    <p className="truncate text-xs text-foreground/85" data-testid="route-best">
      <Link href={`/activities/${route.bestActivityId}`} className="hit-44">
        {r.bestPace(formatClock(route.bestPaceSecPerKm))}
      </Link>
      {latest?.kind === 'new-best' && (
        <>
          {' · '}
          {r.newBest} <span className="text-accent-text">{compactDate(latest.date, thisYear)}</span>
        </>
      )}
      {latest?.kind === 'behind' && (
        <>
          {' · '}
          {r.lastPace(formatClock(latest.run.paceSecPerKm))}{' '}
          <span data-testid="route-gap" className={latest.gapSeconds > 0 ? 'text-[var(--warn)]' : 'text-muted-foreground'}>
            {latest.gapSeconds > 0 ? `+${formatGap(latest.gapSeconds)}` : `±${formatGap(0)}`}
          </span>
        </>
      )}
    </p>
  )
}

/**
 * Where each route starts, named. Street grain rather than town: these routes
 * are mostly in one place, so "Metz" would name half of them at once. The
 * lookup is cached in localStorage for a month by reverseGeocode, so this costs
 * one round of requests on a cold browser and nothing after.
 */
function useStartPlaces(routes: RecurringRoute[]): Record<string, string> {
  const [places, setPlaces] = useState<Record<string, string>>({})

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPTILER_TOKEN
    if (!token) return

    let live = true
    Promise.all(
      routes.map(async (route) => {
        if (!route.start) return null
        const name = await reverseGeocode(route.start[0], route.start[1], token, 'street')
        return name ? ([route.id, name] as const) : null
      }),
    ).then((pairs) => {
      if (!live) return
      setPlaces(Object.fromEntries(pairs.filter((pair): pair is readonly [string, string] => pair !== null)))
    })

    return () => {
      live = false
    }
  }, [routes])

  return places
}

export function RecurringRoutes({ routes, thisYear }: Props) {
  const places = useStartPlaces(routes)
  const monoAccent = useAccent() === 'mono'

  if (routes.length === 0) return null

  return (
    <section className="space-y-3">
      {/* The key above the list, not below it: at the foot of fifteen rows it
          arrives long after the bars it explains. */}
      <TrailKey monoAccent={monoAccent} />

      <ul className={cardClass({ padding: 'none', className: 'px-4 py-0.5' })}>
        {routes.map((route, i) => (
          <li
            key={route.id}
            className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-3 last:border-b-0"
          >
            <Outline path={route.outline} />

            <div data-testid="route-text" className="min-w-0 space-y-0.5">
              {/* Named after where it starts, at street grain; a number
                  until a place comes back. */}
              <p className="truncate text-subhead font-semibold text-foreground" data-testid="route-name">
                {places[route.id] ?? t.records.recurring.unnamed(i + 1)}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {routeKm(route.distanceKm)} {t.units.km} · {t.records.recurring.runCount(route.runCount)}
              </p>
              <BestAndLast route={route} thisYear={thisYear} />
            </div>

            <PaceTrail route={route} thisYear={thisYear} monoAccent={monoAccent} />
          </li>
        ))}
      </ul>
    </section>
  )
}
