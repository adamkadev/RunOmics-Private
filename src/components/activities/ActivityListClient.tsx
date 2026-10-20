'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Search, SearchX, SlidersHorizontal, X } from 'lucide-react'
import { ActivityThumbRow } from './ActivityThumbRow'
import { ActivityFilterSheet } from './ActivityFilterSheet'
import {
  ALL_RUNS,
  GROUP_IDS,
  checkedTypes,
  countByType,
  filterTypes,
  normalizeTypes,
  parseFilter,
  parseSort,
  sortQuery,
  typesLabel,
  type ActivityFilter,
  type FilterKind,
  type ActivitySort,
} from './activityFilter'
import type { ActivitySummary } from '@/domain/activity/types'
import type { ActivityQueryResult } from '@/application/usecases/QueryActivities'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import type { MapShellData } from '@/application/usecases/GetAllRoutes'
import { cardClass } from '@/components/ui/Card'
import { Pill } from '@/components/ui/Pill'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import { easyShare } from '@/domain/activity/easyShare'
import { groupByWeek, type WeekGroup } from '@/domain/activity/weekGroups'

import { formatDate, formatDateRange, formatKm, formatRanKm } from '@/lib/formatters'
import { useUrlParam } from '@/lib/useUrlParam'
import { isoDate, addDays, startOfWeek } from '@/lib/calendarDate'
import { useToday } from '@/lib/useToday'
import { t } from '@/i18n'

// The map and its tiles load only once the Map tab is opened.
const GlobalMapWrapper = dynamic(() => import('@/components/map/GlobalMapWrapper').then((m) => m.GlobalMapWrapper), { ssr: false })

export type ActivitiesView = 'list' | 'map'
const VIEWS = ['list', 'map'] as const

/** The view the address bar names: ?view=map opens the map; anything else, the list. */
export function activitiesView(param: string | null): ActivitiesView {
  return param === 'map' ? 'map' : 'list'
}

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

interface WeekRow extends WeekGroup<ActivitySummary> {
  label: string
  easyPct: number | null
}

const KM_STRONG = 'font-semibold text-foreground'

/**
 * "45 km · 5 runs · 88% easy": every aggregate says what it counts (v4.17).
 * Under a filter the share is dropped (App Fixes 1d): "88% easy" of the
 * threshold runs alone says nothing about the week.
 */
function PastWeekLine({ group, showEasy }: { group: WeekRow; showEasy: boolean }) {
  const w = t.activities.weekLine
  return (
    // The line gives way on a narrow phone, wrapping, so the week's dates never do (v4.17.2).
    <span className="min-w-0 text-right text-footnote text-muted-foreground text-pretty" data-testid="past-week-line">
      <span className={KM_STRONG}>{formatKm(group.totalKm)}</span> {t.units.km} · {w.runs(group.items.length)}
      {showEasy && group.easyPct !== null && ` · ${w.easy(group.easyPct)}`}
    </span>
  )
}

/** A week's runs as rounded rows in its card, each with its route (v4.17). */
function InsetRows({ items, efforts }: { items: ActivitySummary[]; efforts: Record<string, QualifiedEffort[]> }) {
  return (
    <div className="flex flex-col px-2 pb-2">
      {items.map((a) => (
        <ActivityThumbRow key={a.id} activity={a} qualifiedEfforts={efforts[a.id]} variant="inset" />
      ))}
    </div>
  )
}

function weekRows(groups: WeekGroup<ActivitySummary>[], currentWeekStart: string): WeekRow[] {
  return groups.map((group) => {
    // Every past week is its date range (v4.17), "Sep 21 - 27", with no
    // year: the month heading above it has one (G22).
    const range = formatDateRange(group.key, isoDate(addDays(new Date(group.key + 'T00:00:00'), 6)), { year: 'never' })
    return {
      ...group,
      label: group.key === currentWeekStart ? t.activities.thisWeek : range,
      easyPct: easyShare(group.items)?.easy ?? null,
    }
  })
}

type ListBlock =
  | { kind: 'current'; week: WeekRow }
  | { kind: 'month'; key: string; label: string; km: number; runs: number; weeks: WeekRow[] }

/**
 * The weeks under their months (v4.17): consecutive past weeks that start in
 * the same month share a sticky heading, which totals the weeks under it -
 * so "132 km · 15 runs" is the sum of the cards it heads. The current week is
 * its own card, once it has a run.
 */
function listBlocks(weeks: WeekRow[]): ListBlock[] {
  const blocks: ListBlock[] = []
  for (const week of weeks) {
    if (week.isCurrent) {
      blocks.push({ kind: 'current', week })
      continue
    }
    const key = week.key.slice(0, 7)
    const open = blocks[blocks.length - 1]
    if (open?.kind === 'month' && open.key === key) {
      open.weeks.push(week)
      open.km += week.totalKm
      open.runs += week.items.length
    } else {
      const label = formatDate(`${key}-01`, { precision: 'month', year: 'always', style: 'full' })
      blocks.push({ kind: 'month', key, label, km: week.totalKm, runs: week.items.length, weeks: [week] })
    }
  }
  return blocks
}

// The search survives a visit to a run and back; the filter and the sort
// live in the URL (?group=, ?types=, ?sort=).
const SEARCH_STORAGE_KEY = 'activities:search'

function readStoredSearch(): string {
  if (typeof window === 'undefined') return ''
  try {
    return sessionStorage.getItem(SEARCH_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

interface QueryState {
  /** Comma-joined types, empty for every run. */
  types: string
  gearId: string | null
  search: string
  sort: ActivitySort
}

/** What the page's server render answered: every run, newest first. */
const INITIAL_QUERY = JSON.stringify({ types: '', gearId: null, search: '', sort: 'newest' } satisfies QueryState)

async function fetchActivities(query: QueryState, offset: number): Promise<ActivityQueryResult> {
  const { sortBy, sortOrder } = sortQuery(query.sort)
  const qs = new URLSearchParams({
    sortBy,
    sortOrder,
    offset: String(offset),
    limit: String(PAGE_SIZE),
  })
  if (query.types) qs.set('types', query.types)
  if (query.gearId) qs.set('gear', query.gearId)
  if (query.search.trim()) qs.set('search', query.search.trim())

  const res = await fetch(`/api/activities?${qs}`)
  return res.json()
}

interface Props {
  initialItems: ActivitySummary[]
  initialNextOffset: number | null
  totalCount: number
  qualifiedEffortsByActivityId?: Record<string, QualifiedEffort[]>
  /** The date the page was prerendered on; see useToday. */
  today: string
  /** Shoe names by gear id, to name the ?shoe= filter. */
  shoeNames?: Record<string, string>
  /** The map's runs and areas, for the Map tab. */
  mapData: MapShellData
}

export function ActivityListClient({
  initialItems,
  initialNextOffset,
  totalCount,
  qualifiedEffortsByActivityId = {},
  today: serverToday,
  shoeNames = {},
  mapData,
}: Props) {
  const today = useToday(serverToday)
  // List or Map, in the address bar (?view=map), so /map can open on the map.
  const [viewParam, setViewParam] = useUrlParam('view')
  const view = activitiesView(viewParam)
  const viewTabs = useSegmentedTabs({ ids: VIEWS, value: view, onChange: (next) => setViewParam(next === 'map' ? 'map' : null) })
  const [search, setSearch] = useState('')
  // ?shoe= narrows the list to one pair; it is the shoe page's way in.
  const [gearId, setGearId] = useUrlParam('shoe')
  const [groupParam, setGroupParam] = useUrlParam('group')
  const [typesParam, setTypesParam] = useUrlParam('types')
  const [sortParam, setSortParam] = useUrlParam('sort')
  const filter = useMemo(() => parseFilter(groupParam, typesParam), [groupParam, typesParam])
  const sort = parseSort(sortParam)
  const [sheetOpen, setSheetOpen] = useState(false)

  const setFilter = useCallback(
    (next: ActivityFilter) => {
      setTypesParam(next.types.length > 0 ? next.types.join(',') : null)
      setGroupParam(next.group === 'all' ? null : next.group)
    },
    [setGroupParam, setTypesParam],
  )

  const [items, setItems] = useState(initialItems)
  // How many runs the current filter matches, as the query itself counted
  // them: the list only holds a page of them (App Fixes 1d).
  const [matched, setMatched] = useState(totalCount)
  const [nextOffset, setNextOffset] = useState(initialNextOffset)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isPending, setIsPending] = useState(false)

  // Derived from the unfiltered set the page handed us, so the header and
  // the sheet's counts keep describing the archive rather than the filter.
  const totalKm = useMemo(() => initialItems.reduce((sum, a) => sum + a.distanceKm, 0), [initialItems])
  const typeCounts = useMemo(() => countByType(initialItems), [initialItems])
  // "since May 2025", only when the page handed over the whole archive: a
  // first page's oldest run is not the first run.
  const firstMonth = useMemo(() => {
    if (initialItems.length === 0 || initialItems.length < totalCount) return null
    const first = initialItems.reduce((min, a) => (a.date < min ? a.date : min), initialItems[0]!.date)
    return formatDate(first, { precision: 'month', year: 'always' })
  }, [initialItems, totalCount])

  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [search])

  const hasRestored = useRef(false)
  useLayoutEffect(() => {
    if (hasRestored.current) return
    hasRestored.current = true
    const stored = readStoredSearch()
    if (!stored) return
    // Restored from sessionStorage once, behind hasRestored, and only into a
    // still-empty field, so it can never clobber a user edit. It cannot be a
    // state initializer: the server render has no sessionStorage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch((cur) => (cur === '' ? stored : cur))
    setDebouncedSearch((cur) => (cur === '' ? stored : cur))
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(SEARCH_STORAGE_KEY, debouncedSearch)
    } catch {
    }
  }, [debouncedSearch])

  const activeTypes = filterTypes(filter)
  const typesKey = activeTypes?.join(',') ?? ''
  const query: QueryState = useMemo(
    () => ({ types: typesKey, gearId, search: debouncedSearch, sort }),
    [typesKey, gearId, debouncedSearch, sort],
  )

  // The list asks again whenever the query moves off what it last showed -
  // the server's answer at first. A URL filter reached by a client-side
  // navigation is there from the first render, so a first-render skip would
  // have shown it every run.
  const requestSeq = useRef(0)
  const shownQuery = useRef(INITIAL_QUERY)
  useEffect(() => {
    const key = JSON.stringify(query)
    if (key === shownQuery.current) return
    shownQuery.current = key
    const seq = ++requestSeq.current
    setIsPending(true)
    fetchActivities(query, 0)
      .then((result) => {
        if (seq !== requestSeq.current) return
        setIsPending(false)
        setItems(result.items)
        setMatched(result.total)
        setNextOffset(result.nextOffset)
      })
      .catch(() => {
        if (seq !== requestSeq.current) return
        setIsPending(false)
      })
  }, [query])

  const hasMore = nextOffset !== null
  const hasActiveFilter = activeTypes !== null || gearId !== null || search.trim() !== ''
  const currentWeekStart = isoDate(startOfWeek(new Date(`${today}T00:00:00`)))
  // Weeks only for newest-first. A week with no run yet - this one, on a
  // Monday morning - has no card at all (3.0).
  const groups = useMemo(
    () => (sort === 'newest' ? weekRows(groupByWeek(items, currentWeekStart), currentWeekStart) : null),
    [items, sort, currentWeekStart],
  )
  const blocks = useMemo(() => (groups ? listBlocks(groups) : null), [groups])

  // ?week= (a Monday) brings that week's card into view; it is All time's
  // way in from its biggest week (3.0). Every week is open, so it only
  // scrolls, once the list holding it has loaded.
  const [weekParam] = useUrlParam('week')
  useEffect(() => {
    if (!weekParam || !blocks) return
    const frame = requestAnimationFrame(() => document.getElementById(`week-${weekParam}`)?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(frame)
  }, [weekParam, blocks])

  const loadMore = useCallback(() => {
    if (nextOffset === null || loadingMore) return
    setLoadingMore(true)
    const seq = requestSeq.current
    fetchActivities(query, nextOffset)
      .then((result) => {
        setLoadingMore(false)
        if (seq !== requestSeq.current) return
        setItems((prev) => [...prev, ...result.items])
        setNextOffset(result.nextOffset)
      })
      .catch(() => setLoadingMore(false))
  }, [nextOffset, loadingMore, query])

  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!hasMore) return
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: '200px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  function resetFilters() {
    setFilter(ALL_RUNS)
    setGearId(null)
    setSearch('')
  }

  const archiveLine = [
    totalKm > 0 ? t.activities.countWithDistance(totalCount, formatKm(totalKm)) : t.activities.count(totalCount),
    firstMonth ? t.activities.since(firstMonth) : null,
  ].filter((part): part is string => part !== null)

  const pickedLabel = typesLabel(filter.types)
  // What the filter bar names: every run the filter matches, not the page
  // of them on screen.
  const countedLabel = t.activities.count(matched)

  return (
    <div className="flex flex-col gap-3.5">
      <header className="mb-1.5">
        <h1 className="text-display text-foreground">{t.pages.activities.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{archiveLine.join(' · ')}</p>
      </header>

      <SegmentedTabs
        tabs={viewTabs}
        items={[
          { id: 'list', label: t.activities.view.list },
          { id: 'map', label: t.activities.view.map },
        ]}
        label={t.activities.view.label}
        size="md"
        fill
      />

      <div {...viewTabs.panelProps} className="flex flex-col gap-3.5 outline-none">
        {view === 'map' ? (
          <GlobalMapWrapper data={mapData} />
        ) : (
          <>

            <label className="flex h-[42px] items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 text-muted-foreground transition-colors focus-within:border-[var(--line-2)]">
              <Search size={16} aria-hidden="true" className="shrink-0" />
              <input
                type="text"
                placeholder={t.activities.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </label>

            {/* Four groups, or the one chip for the types picked in the sheet,
                then the sheet's button (3.0). */}
            <div className="flex items-center gap-2">
              <div className="-my-1.5 flex min-w-0 flex-1 gap-2 overflow-x-auto py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-testid="type-chips">
                {filter.types.length > 0 ? (
                  <Pill as="button" variant="selected" className="min-w-0 gap-1.5" onClick={() => setFilter(ALL_RUNS)} aria-label={t.activities.filter.clearTypes(pickedLabel)}>
                    <span className="truncate">{pickedLabel}</span>
                    <X size={14} aria-hidden="true" className="shrink-0" />
                  </Pill>
                ) : (
                  GROUP_IDS.map((group) => (
                    <Pill
                      key={group}
                      as="button"
                      variant={filter.group === group ? 'selected' : 'neutral'}
                      aria-pressed={filter.group === group}
                      onClick={() => setFilter({ group, types: [] })}
                    >
                      {group === 'all' ? t.activities.all : t.activities.groups[group]}
                    </Pill>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                aria-label={t.activities.filter.title}
                aria-haspopup="dialog"
                className="hit-44 relative flex size-[38px] shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-[var(--surface-2)]"
              >
                <SlidersHorizontal size={17} aria-hidden="true" />
                {/* A sort other than newest has no chip of its own: a dot says the sheet holds one. */}
                {sort !== 'newest' && <span aria-hidden="true" className="absolute right-0.5 top-0.5 size-2 rounded-full bg-accent" />}
              </button>
            </div>

            {gearId && (
              <div>
                <Pill as="button" variant="selected" className="gap-1.5" onClick={() => setGearId(null)} aria-label={t.activities.shoeFilter.clear}>
                  {shoeNames[gearId] ?? gearId}
                  <X size={14} aria-hidden="true" />
                </Pill>
              </div>
            )}

            {/* What the totals below are counting, and one tap to stop
                counting it (App Fixes 1d): a week's "45 km" under a filter is
                the filter's km, and said nothing about it. */}
            {hasActiveFilter && (
              <div className="flex items-baseline justify-between gap-3 px-1" data-testid="filter-bar">
                <p className="min-w-0 text-[13px] text-muted-foreground text-pretty">
                  {t.activities.filter.showing}{' '}
                  <b className="font-semibold text-foreground">{countedLabel}</b>
                  {t.activities.filter.totalsCount}
                </p>
                <button type="button" onClick={resetFilters} className="hit-44 shrink-0 text-[13px] font-medium text-accent-text">
                  {t.activities.filter.clear}
                </button>
              </div>
            )}

            {isPending ? (
              <div className="flex justify-center py-10">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-accent" />
              </div>
            ) : items.length === 0 ? (
              <div className={cardClass({ padding: 'none', className: 'py-12 text-center' })}>
                <SearchX size={24} className="mx-auto text-subtle" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {hasActiveFilter ? t.activities.emptyFiltered : t.activities.empty}
                </p>
                {hasActiveFilter && (
                  <button
                    onClick={resetFilters}
                    className="mt-4 text-xs font-semibold text-accent-text transition-opacity hover:opacity-70"
                  >
                    {t.activities.resetFilters}
                  </button>
                )}
              </div>
            ) : blocks ? (
              <div className="flex flex-col gap-3.5">
                {blocks.map((block) =>
                  block.kind === 'current' ? (
                    // This week as a heading line over its runs (design review,
                    // Oct 2026): its km and runs, not the plan - Today and Plan
                    // show the week against plan. Only once it has a run (3.0).
                    <section key={block.week.key} id={`week-${block.week.key}`} className="scroll-mt-24" data-testid="current-week">
                      <div className="flex items-baseline justify-between gap-3 px-1 pb-2">
                        <h2 className="min-w-0 truncate text-[15px] font-semibold text-foreground">
                          {t.activities.thisWeek} · {formatDateRange(block.week.key, isoDate(addDays(new Date(`${block.week.key}T00:00:00`), 6)), { year: 'never' })}
                        </h2>
                        <span className="shrink-0 text-[13px] text-muted-foreground" data-testid="week-line">
                          <span className={KM_STRONG}>{formatRanKm(block.week.totalKm)}</span> {t.units.km} · {t.activities.weekLine.runs(block.week.items.length)}
                          {!hasActiveFilter && block.week.easyPct !== null && ` · ${t.activities.weekLine.easy(block.week.easyPct)}`}
                        </span>
                      </div>
                      <div className={cardClass({ padding: 'none', overflow: true, className: 'pt-2' })}>
                        <InsetRows items={block.week.items} efforts={qualifiedEffortsByActivityId} />
                      </div>
                    </section>
                  ) : (
                    <section key={block.key} data-testid="month">
                      {/* Sticky under the compact title bar while it shows, under
                          the status strip otherwise. */}
                      <div
                        className="sticky z-10 flex items-baseline justify-between gap-3 bg-background px-1 pb-2 pt-3.5"
                        style={{ top: 'var(--sticky-top, var(--safe-top))' }}
                      >
                        <h2 className="text-[15px] font-semibold capitalize text-foreground">{block.label}</h2>
                        <span className="text-[13px] text-muted-foreground" data-testid="month-line">
                          {formatKm(block.km)} {t.units.km} · {t.activities.weekLine.runs(block.runs)}
                        </span>
                      </div>
                      {/* Every week a card of its runs (3.0): a row of type dots
                          said nothing of what each run was. */}
                      <div className="flex flex-col gap-3">
                        {block.weeks.map((g) => (
                          <section key={g.key} id={`week-${g.key}`} className={cardClass({ padding: 'none', overflow: true, className: 'scroll-mt-24' })} data-testid="week">
                            <div className="flex items-baseline justify-between gap-4 px-4 pb-1.5 pt-3.5">
                              <h3 className="whitespace-nowrap text-sm font-semibold text-foreground">{g.label}</h3>
                              <PastWeekLine group={g} showEasy={!hasActiveFilter} />
                            </div>
                            <InsetRows items={g.items} efforts={qualifiedEffortsByActivityId} />
                          </section>
                        ))}
                      </div>
                    </section>
                  ),
                )}
              </div>
            ) : (
              <div className={cardClass({ padding: 'none', overflow: true, className: 'divide-y divide-border' })}>
                {items.map((a) => (
                  <ActivityThumbRow key={a.id} activity={a} qualifiedEfforts={qualifiedEffortsByActivityId[a.id]} />
                ))}
              </div>
            )}

            {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-1" />}
            {!hasMore && items.length > 0 && (
              <p className="py-2 text-center text-xs text-subtle">{t.activities.endOfList}</p>
            )}
          </>
        )}
      </div>

      {sheetOpen && (
        <ActivityFilterSheet
          types={checkedTypes(filter)}
          sort={sort}
          counts={typeCounts}
          onApply={(types, nextSort) => {
            setFilter(normalizeTypes(types))
            setSortParam(nextSort === 'newest' ? null : nextSort)
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  )
}
