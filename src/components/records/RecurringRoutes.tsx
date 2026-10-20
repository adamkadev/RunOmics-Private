'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RecurringRoute } from '@/application/usecases/GetRecurringRoutes'
import { formatClock, formatDate, formatKm, formatMonthShortYear } from '@/lib/formatters'
import { reverseGeocode } from '@/lib/reverseGeocode'
import { useAccent } from '@/lib/useAccent'
import { t } from '@/i18n'
import { cardClass } from '@/components/ui/Card'
import { formatGap, routeLatest, trailBars, type TrailTone } from './recordsView'

interface Props {
  routes: RecurringRoute[]
  thisYear: number
}


/** Routes listed before "Show all". */
const TOP_ROUTES = 6
/**
 * A route's distance by the app's one rule (design review, Oct 2026): one
 * decimal under 100 km, none above. formatDistance's second decimal under
 * 10 km put "7.20 km" in the same list as "12.9 km".
 */
function routeKm(km: number): string {
  return formatKm(km, km >= 100 ? 0 : 1)
}

/**
 * A date in as little width as it can take - the latest run's line is
 * narrow: a day this year, a month and year before that.
 */
function compactDate(isoDate: string, thisYear: number): string {
  return Number(isoDate.slice(0, 4)) === thisYear
    ? formatDate(isoDate, { style: 'bare', year: 'never' })
    : formatMonthShortYear(isoDate)
}

/** The trail's colours (App Fixes 1g): the other runs dim, the best in the accent, the latest in ink. */
const BAR_TONE = {
  best: 'bg-accent',
  latest: 'bg-foreground',
  other: 'bg-[var(--rest-bar)]',
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
 * The last six runs in date order, taller for faster (App Fixes 1g): a fixed
 * 74 x 36 px trail, square-ended bars sharing the width 2 px apart.
 */
function PaceTrail({ route, monoAccent }: { route: RecurringRoute; monoAccent: boolean }) {
  return (
    <div data-testid="pace-trail" className="flex h-9 w-[74px] items-end justify-end gap-0.5" aria-hidden="true">
      {trailBars(route).map((bar) => (
        <span
          key={bar.activityId}
          data-tone={bar.tone}
          className={cn('box-border min-w-1 max-w-2 flex-1', barTone(bar.tone, monoAccent))}
          style={{ height: `${bar.heightPct}%` }}
        />
      ))}
    </div>
  )
}

/** The key to the bars' two colours, beside the line that says what a bar is: 4 x 10 px swatches. */
function TrailKey({ monoAccent }: { monoAccent: boolean }) {
  const r = t.records.recurring
  return (
    <div className="flex items-center justify-between gap-3 px-0.5 text-xs text-muted-foreground">
      <p>{r.trailKey}</p>
      <p className="flex shrink-0 items-center gap-2" aria-hidden="true">
        <span className="flex items-center gap-1">
          <span className={cn('h-2.5 w-1 rounded-[2px]', BAR_TONE.best)} />
          <span>{r.legendBest}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className={cn('box-border h-2.5 w-1 rounded-[2px]', barTone('latest', monoAccent))} />
          <span>{r.legendLatest}</span>
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
    <p className="truncate text-[12.5px] text-[var(--text-2)]" data-testid="route-best">
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
 * Where each route goes, named (Wave 4, App Fixes 1g): the street, park or
 * place at its far point, with its shape - "… loop", "… out & back". Every
 * route from home shares the start street, so naming by the start gave a
 * list of one name. The lookup is cached in localStorage for a month by
 * reverseGeocode.
 */
function usePlaceNames(routes: RecurringRoute[]): Record<string, string> {
  const [places, setPlaces] = useState<Record<string, string>>({})

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPTILER_TOKEN
    if (!token) return

    let live = true
    Promise.all(
      routes.map(async (route) => {
        const at = route.far ?? route.start
        if (!at) return null
        const name = await reverseGeocode(at[0], at[1], token, 'street')
        return name ? ([route.id, t.records.recurring.named[route.shape](name)] as const) : null
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

/** The reader's own route names, kept on this device, by the route's first run. */
const ROUTE_NAMES_KEY = 'runomics-route-names'

function routeKey(route: RecurringRoute): string {
  return route.runs[0]?.activityId ?? route.id
}

function readRouteNames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ROUTE_NAMES_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function useRouteNames(): [Record<string, string>, (key: string, name: string) => void] {
  const [names, setNames] = useState<Record<string, string>>({})
  useEffect(() => setNames(readRouteNames()), [])
  const rename = (key: string, name: string) => {
    setNames((prev) => {
      const next = { ...prev }
      if (name.trim()) next[key] = name.trim()
      else delete next[key]
      try {
        localStorage.setItem(ROUTE_NAMES_KEY, JSON.stringify(next))
      } catch {
        // The name still shows until the page reloads.
      }
      return next
    })
  }
  return [names, rename]
}

/** The route's name; a tap turns it into a field to rename it, empty to go back to the place. */
function RouteName({ name, custom, onRename }: { name: string; custom: string | undefined; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <input
        autoFocus
        defaultValue={custom ?? name}
        aria-label={t.records.recurring.rename}
        placeholder={t.records.recurring.renameHint}
        data-testid="route-name-input"
        className="w-full rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[15px] font-semibold text-foreground outline-none"
        onBlur={(e) => {
          onRename(e.currentTarget.value)
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setEditing(false)
        }}
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={`${name} · ${t.records.recurring.rename}`}
      className="block w-full truncate text-left text-[15px] font-semibold text-foreground"
      data-testid="route-name"
    >
      {name}
    </button>
  )
}

export function RecurringRoutes({ routes, thisYear }: Props) {
  const places = usePlaceNames(routes)
  const [names, rename] = useRouteNames()
  const monoAccent = useAccent() === 'mono'
  const [all, setAll] = useState(false)

  if (routes.length === 0) return null
  // The top six, then a row that opens the rest (Wave 5 G).
  const shown = all ? routes : routes.slice(0, TOP_ROUTES)

  return (
    <section className="space-y-3">
      {/* The key above the list, not below it: at the foot of fifteen rows it
          arrives long after the bars it explains. */}
      <TrailKey monoAccent={monoAccent} />

      <ul className={cardClass({ padding: 'none', className: 'px-4 py-0.5' })}>
        {shown.map((route, i) => {
          const key = routeKey(route)
          const custom = names[key]
          return (
            <li
              key={route.id}
              className="grid grid-cols-[minmax(0,1fr)_74px] items-center gap-2.5 border-b border-border py-3 last:border-b-0"
            >
              <div data-testid="route-text" className="flex min-w-0 flex-col gap-0.5">
                <RouteName
                  name={custom ?? places[route.id] ?? t.records.recurring.unnamed(i + 1)}
                  custom={custom}
                  onRename={(name) => rename(key, name)}
                />
                {/* The distance leads, so similar loops tell apart. */}
                <p className="truncate text-[12.5px] text-muted-foreground">
                  {routeKm(route.distanceKm)} {t.units.km} · {t.records.recurring.runCount(route.runCount)}
                </p>
                <BestAndLast route={route} thisYear={thisYear} />
              </div>

              <PaceTrail route={route} monoAccent={monoAccent} />
            </li>
          )
        })}
        {!all && routes.length > TOP_ROUTES && (
          <li>
            <button
              type="button"
              onClick={() => setAll(true)}
              className="flex min-h-11 w-full items-center justify-between py-3 text-[13px] font-medium text-accent-text"
              data-testid="routes-show-all"
            >
              {t.records.recurring.showAll(routes.length)}
              <ChevronRight size={14} strokeWidth={2.2} aria-hidden />
            </button>
          </li>
        )}
      </ul>
    </section>
  )
}
