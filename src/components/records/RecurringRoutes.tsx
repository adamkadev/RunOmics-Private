'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { RecurringRoute } from '@/application/usecases/GetRecurringRoutes'
import { formatDate, formatDistance, formatMonthShortYear, formatPace } from '@/lib/formatters'
import { reverseGeocode } from '@/lib/reverseGeocode'
import { t } from '@/i18n'

interface Props {
  routes: RecurringRoute[]
}

const OUTLINE_BOX = 100
const TRAIL_KEY_COLOR = 'var(--subtle-2)'

/**
 * Three facts share this line, so the date spends as little of it as it can:
 * a day this year, a month and year before that. "Best" is dropped with it -
 * a pace beside a route already reads as the fastest one.
 */
function compactDate(isoDate: string): string {
  const thisYear = new Date().getFullYear()
  return Number(isoDate.slice(0, 4)) === thisYear
    ? formatDate(isoDate, { style: 'bare', year: 'never' })
    : formatMonthShortYear(isoDate)
}

function Outline({ path }: { path: string }) {
  return (
    <svg
      viewBox={`-6 -6 ${OUTLINE_BOX + 12} ${OUTLINE_BOX + 12}`}
      className="h-[38px] w-[30px] shrink-0 text-accent-text"
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

function PaceTrail({ route }: { route: RecurringRoute }) {
  const paces = route.runs.map((r) => r.paceSecPerKm)
  const fastest = Math.min(...paces)
  const slowest = Math.max(...paces)
  const span = slowest - fastest || 1

  return (
    <div className="flex h-8 shrink-0 items-end justify-end gap-0.5" aria-hidden="true">
      {route.runs.map((run) => (
        <span
          key={run.activityId}
          className="w-[3px] shrink-0 rounded-full bg-accent/70"
          style={{ height: `${20 + ((slowest - run.paceSecPerKm) / span) * 80}%` }}
        />
      ))}
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

export function RecurringRoutes({ routes }: Props) {
  const places = useStartPlaces(routes)

  if (routes.length === 0) return null

  return (
    <section className="space-y-3">
      {/* No subtitle: Records and Milestones carry none, and three tabs that
          introduce themselves differently read as three different screens. */}
      <div>
        <h2 className="font-display text-title3 font-bold text-foreground">{t.records.recurring.title}</h2>
        {/* Above the list, not below it: at the foot of fifteen rows the key
            arrives long after the bars it explains. */}
        <p className="mt-0.5 text-[11px]" style={{ color: TRAIL_KEY_COLOR }}>
          {t.records.recurring.trailKey}
        </p>
      </div>

      <ul>
        {routes.map((route) => (
          <li key={route.id} className="flex items-center gap-3 border-b border-foreground/10 px-0.5 py-[11px] last:border-b-0">
            <Outline path={route.outline} />

            <div className="min-w-0 flex-1">
              {/* The run count holds this slot whether or not a place resolves,
                  so it never moves line between one row and the next. */}
              <p className="truncate font-display text-subhead font-bold text-foreground">
                {formatDistance(route.distanceKm)} {t.units.km}
                <span className="text-caption font-medium text-subtle">
                  {' · '}
                  {t.records.recurring.runCount(route.runCount)}
                </span>
              </p>

              <Link
                href={`/activities/${route.bestActivityId}`}
                className="mt-0.5 block truncate text-caption text-accent-text"
              >
                {places[route.id] && <span className="text-subtle">{places[route.id]} · </span>}
                {formatPace(route.bestPaceSecPerKm)} · {compactDate(route.bestDate)}
              </Link>
            </div>

            <PaceTrail route={route} />
          </li>
        ))}
      </ul>
    </section>
  )
}
