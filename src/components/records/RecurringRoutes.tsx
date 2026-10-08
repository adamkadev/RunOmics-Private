'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { RecurringRoute } from '@/application/usecases/GetRecurringRoutes'
import { formatDate, formatKm, formatMonthShortYear, formatPace } from '@/lib/formatters'
import { reverseGeocode } from '@/lib/reverseGeocode'
import { t } from '@/i18n'

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
 * A date in as little width as it can take - the best run's line and the
 * trail's two ends are narrow: a day this year, a month and year before
 * that. "Best" is dropped beside it - a pace beside a route already reads as
 * the fastest one.
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
      className="h-[38px] w-[30px] shrink-0 text-foreground"
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

/** The trail shows this many runs at most, the latest ones. */
export const TRAIL_RUNS = 24

/**
 * The trail fills whatever the text column leaves and scales its bars to fit.
 * It used to grow a 3 px bar per run, so the most-run routes pushed their own
 * text down to "9.…" and "3:3…".
 */
function PaceTrail({ route, thisYear }: { route: RecurringRoute; thisYear: number }) {
  const runs = route.runs.slice(-TRAIL_RUNS)
  const paces = runs.map((r) => r.paceSecPerKm)
  const fastest = Math.min(...paces)
  const slowest = Math.max(...paces)
  const span = slowest - fastest || 1
  const first = runs[0] ? compactDate(runs[0].date, thisYear) : null
  const last = runs.length > 0 ? compactDate(runs[runs.length - 1]!.date, thisYear) : null

  return (
    <div className="flex min-w-0 flex-1 flex-col items-end gap-1.5">
      <div data-testid="pace-trail" className="flex h-8 w-full items-end justify-end gap-0.5" aria-hidden="true">
        {/* Band grey, the latest run in ink (v5.5 #14): the accent is for "now". */}
        {runs.map((run, i) => (
          <span
            key={run.activityId}
            data-latest={i === runs.length - 1 ? '' : undefined}
            className={cn('min-w-px max-w-[5px] flex-1 rounded-full', i === runs.length - 1 ? 'bg-foreground' : 'bg-[var(--band)]')}
            style={{ height: `${20 + ((slowest - run.paceSecPerKm) / span) * 80}%` }}
          />
        ))}
      </div>
      {/* The axis, named by its ends (design review, Oct 2026): the bars are
          runs in order, not days, so the dates of the first and the latest
          say how much time they cover. */}
      {first && last && (
        <p data-testid="pace-trail-span" className="whitespace-nowrap text-caption leading-none text-muted-foreground">
          {first === last ? last : t.records.recurring.trailSpan(first, last)}
        </p>
      )}
    </div>
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

  if (routes.length === 0) return null

  return (
    <section className="space-y-3">
      {/* No subtitle: Records and Milestones carry none, and three tabs that
          introduce themselves differently read as three different screens. */}
      <div>
        <h2 className="font-display text-title3 font-bold text-foreground">{t.records.recurring.title}</h2>
        {/* Above the list, not below it: at the foot of fifteen rows the key
            arrives long after the bars it explains. Muted, not subtle: a key
            too faint to read explains nothing. */}
        <p className="mt-0.5 text-caption text-muted-foreground">
          {t.records.recurring.trailKey}
        </p>
      </div>

      <ul>
        {routes.map((route) => (
          <li key={route.id} className="flex items-center gap-3 border-b border-foreground/10 px-0.5 py-[11px] last:border-b-0">
            <Outline path={route.outline} />

            {/* A fixed column: the text never gives way to the trail. */}
            <div data-testid="route-text" className="w-[150px] shrink-0">
              {/* The run count holds this slot whether or not a place resolves,
                  so it never moves line between one row and the next. */}
              <p className="truncate font-display text-subhead font-bold text-foreground">
                {routeKm(route.distanceKm)} {t.units.km}
                <span className="text-caption font-medium text-subtle">
                  {' · '}
                  {t.records.recurring.runCount(route.runCount)}
                </span>
              </p>

              {/* Never cut (design review, Oct 2026): a street name ahead of
                  the pace took the date off the end of one truncated line.
                  The best run keeps its line; the place wraps under it. */}
              <Link
                href={`/activities/${route.bestActivityId}`}
                className="hit-44 mt-0.5 block text-caption text-muted-foreground"
                data-testid="route-best"
              >
                {formatPace(route.bestPaceSecPerKm)} · {compactDate(route.bestDate, thisYear)}
              </Link>
              {places[route.id] && (
                <p className="mt-0.5 break-words text-caption leading-snug text-subtle" data-testid="route-place">
                  {places[route.id]}
                </p>
              )}
            </div>

            <PaceTrail route={route} thisYear={thisYear} />
          </li>
        ))}
      </ul>
    </section>
  )
}
