'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RecurringRoute } from '@/application/usecases/GetRecurringRoutes'
import { formatClock, formatDate, formatKm, formatMonthShortYear } from '@/lib/formatters'
import { reverseGeocode } from '@/lib/reverseGeocode'
import { useAccent } from '@/lib/useAccent'
import { useOwnerAuth } from '@/lib/useOwnerAuth'
import { readRouteNames, routeKey, writeRouteName, ROUTE_NAME_MAX_LENGTH } from '@/lib/routeNames'
import { t } from '@/i18n'
import { cardClass } from '@/components/ui/Card'
import { formatGap, routeLatest, trailBars, type TrailTone } from './recordsView'

interface Props {
  routes: RecurringRoute[]
  thisYear: number
}


const TOP_ROUTES = 6
/** Not formatDistance: its second decimal under 10 km put "7.20 km" beside "12.9 km". */
function routeKm(km: number): string {
  return formatKm(km, km >= 100 ? 0 : 1)
}

function compactDate(isoDate: string, thisYear: number): string {
  return Number(isoDate.slice(0, 4)) === thisYear
    ? formatDate(isoDate, { style: 'bare', year: 'never' })
    : formatMonthShortYear(isoDate)
}

const BAR_TONE = {
  best: 'bg-accent',
  latest: 'bg-foreground',
  other: 'bg-[var(--rest-bar)]',
} as const

/** Under the white accent the best and latest bars are both near-white, so the latest becomes an outline. */
function barTone(tone: TrailTone, monoAccent: boolean): string {
  if (tone === 'latest' && monoAccent) return 'border border-foreground bg-transparent'
  return BAR_TONE[tone]
}

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

/** Named by the far point: every route from home shares the start street. */
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

function useRouteNames(): { names: Map<string, string>; save: (key: string, name: string) => Promise<void> } {
  const [names, setNames] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    let live = true
    readRouteNames().then((saved) => {
      if (live) setNames(saved)
    })
    return () => {
      live = false
    }
  }, [])

  const save = useCallback(async (key: string, name: string) => {
    await writeRouteName(key, name)
    setNames((held) => {
      const next = new Map(held)
      const trimmed = name.trim()
      if (trimmed === '') next.delete(key)
      else next.set(key, trimmed.slice(0, ROUTE_NAME_MAX_LENGTH))
      return next
    })
  }, [])

  return { names, save }
}

function RouteName({ name, onRename }: { name: string; onRename: ((name: string) => Promise<void>) | null }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  if (!onRename) {
    return (
      <p className="truncate text-subhead font-semibold text-foreground" data-testid="route-name">
        {name}
      </p>
    )
  }

  async function commit() {
    setEditing(false)
    if (draft.trim() !== name) await onRename!(draft)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={ROUTE_NAME_MAX_LENGTH}
        aria-label={t.records.recurring.rename}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void commit()
          if (e.key === 'Escape') {
            setDraft(name)
            setEditing(false)
          }
        }}
        className="w-full min-w-0 rounded-md bg-[var(--surface-2)] px-1 text-subhead font-semibold text-foreground outline-none"
        data-testid="route-name-input"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(name)
        setEditing(true)
      }}
      title={t.records.recurring.rename}
      className="block w-full min-w-0 truncate text-left text-subhead font-semibold text-foreground"
      data-testid="route-name"
    >
      {name}
    </button>
  )
}

export function RecurringRoutes({ routes, thisYear }: Props) {
  const places = usePlaceNames(routes)
  const { names, save } = useRouteNames()
  const { isOwner } = useOwnerAuth()
  const monoAccent = useAccent() === 'mono'
  const [all, setAll] = useState(false)

  if (routes.length === 0) return null
  const shown = all ? routes : routes.slice(0, TOP_ROUTES)

  return (
    <section className="space-y-3">
      <TrailKey monoAccent={monoAccent} />

      <ul className={cardClass({ padding: 'none', className: 'px-4 py-0.5' })}>
        {shown.map((route, i) => {
          const key = routeKey(route)
          const custom = key ? names.get(key) : undefined
          return (
            <li
              key={route.id}
              className="grid grid-cols-[minmax(0,1fr)_74px] items-center gap-2.5 border-b border-border py-3 last:border-b-0"
            >
              <div data-testid="route-text" className="flex min-w-0 flex-col gap-0.5">
                <RouteName name={custom ?? places[route.id] ?? t.records.recurring.unnamed(i + 1)} onRename={isOwner && key ? (name) => save(key, name) : null} />
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
