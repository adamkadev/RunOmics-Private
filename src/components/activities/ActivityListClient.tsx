'use client'

import { startTransition, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
} from './activityFilter'
import type { ActivitySummary, ActivityType } from '@/domain/activity/types'
import { queryRuns, type ActivityQueryKind } from '@/domain/activity/activityQuery'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import type { ExploreAreaRef } from '@/domain/explore/types'
import type { ExplorePlan } from '@/components/explore/routeGenerator'
import { cardClass } from '@/components/ui/Card'
import { Pill } from '@/components/ui/Pill'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import { easyShare } from '@/domain/activity/easyShare'
import { groupByWeek, type WeekGroup } from '@/domain/activity/weekGroups'

import { formatDate, formatDateRange, formatKm, formatRanKm } from '@/lib/formatters'
import { useUrlParam } from '@/lib/useUrlParam'
import { isPopNavigation } from '@/lib/popNavigation'
import { isoDate, addDays, startOfWeek } from '@/lib/calendarDate'
import { useToday } from '@/lib/useToday'
import { t } from '@/i18n'

// The map and its tiles load only once the Map tab is opened.
const GlobalMapWrapper = dynamic(() => import('@/components/map/GlobalMapWrapper').then((m) => m.GlobalMapWrapper), { ssr: false })

export type ActivitiesView = 'list' | 'map'
const VIEWS = ['list', 'map'] as const

export function activitiesView(param: string | null): ActivitiesView {
  return param === 'map' ? 'map' : 'list'
}

const SEARCH_DEBOUNCE_MS = 300

interface WeekRow extends WeekGroup<ActivitySummary> {
  label: string
  easyPct: number | null
}

const KM_STRONG = 'font-semibold text-foreground'

/** Under a filter the easy share is dropped: "88% easy" of the threshold runs alone says nothing about the week. */
function PastWeekLine({ group, showEasy, weekTotal }: { group: WeekRow; showEasy: boolean; weekTotal: number | null }) {
  const w = t.activities.weekLine
  if (weekTotal !== null) {
    return (
      <span className="min-w-0 text-right text-[13px] text-muted-foreground text-pretty" data-testid="past-week-line">
        {w.ofRuns(group.items.length, weekTotal)}
      </span>
    )
  }
  return (
    // The line wraps on a narrow phone so the week's dates never do.
    <span className="min-w-0 text-right text-footnote text-muted-foreground text-pretty" data-testid="past-week-line">
      <span className={KM_STRONG}>{formatKm(group.totalKm)}</span> {t.units.km} · {w.runs(group.items.length)}
      {showEasy && group.easyPct !== null && ` · ${w.easy(group.easyPct)}`}
    </span>
  )
}

/** This week and about three months: a screen and a half on a phone, and what most visits read. */
const FIRST_BLOCKS = 4
const MORE_BLOCKS = 6
const SHOWN_BLOCKS_KEY = 'activities-shown-blocks'

/** Read only on Back, which never hydrates: the server render has no sessionStorage. */
function savedShownBlocks(): number {
  try {
    const saved = Number(sessionStorage.getItem(SHOWN_BLOCKS_KEY))
    return saved > FIRST_BLOCKS ? saved : FIRST_BLOCKS
  } catch {
    return FIRST_BLOCKS
  }
}

const WEEK_HEADER_PX = 42
/** An inset row's min-h-16. */
const ROW_PX = 64
/** A sorted list has no months: it grows by about a month's runs per block. */
const ROWS_PER_BLOCK = 12

function InsetRows({ items, efforts, types }: { items: ActivitySummary[]; efforts: Record<string, QualifiedEffort[]>; types: Record<string, ActivityType> }) {
  return (
    <div className="inset-group flex flex-col">
      {items.map((a) => (
        <ActivityThumbRow key={a.id} activity={a} qualifiedEfforts={efforts[a.id]} type={types[a.id]} variant="inset" />
      ))}
    </div>
  )
}

function weekRows(groups: WeekGroup<ActivitySummary>[], currentWeekStart: string): WeekRow[] {
  return groups.map((group) => {
    // No year: the month heading above has one.
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

/** A month heading totals the weeks under it, so its km is the sum of the cards it heads. */
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

interface Props {
  /** The whole archive: filters, search and sort run on it here. */
  initialItems: ActivitySummary[]
  totalCount: number
  qualifiedEffortsByActivityId?: Record<string, QualifiedEffort[]>
  /** The date the page was prerendered on; see useToday. */
  today: string
  /** By gear id. */
  shoeNames?: Record<string, string>
  /** The map's data version and the cluster it opens on: the map's data is fetched only once the map is opened. */
  map: { version: string; clusterId: string | null }
  exploreAreas?: ExploreAreaRef[]
  explorePlans?: ExplorePlan[]
  /** Unit id → the day it passed 90 %. */
  exploreCompletedSince?: Record<string, string>
  /** Session types that override the watch's, by activity id. */
  sessionTypes?: Record<string, ActivityType>
}

export function ActivityListClient({
  initialItems,
  totalCount,
  qualifiedEffortsByActivityId = {},
  today: serverToday,
  shoeNames = {},
  map,
  exploreAreas,
  explorePlans,
  exploreCompletedSince,
  sessionTypes = {},
}: Props) {
  const today = useToday(serverToday)
  // In the URL so /map can open on the map.
  const [viewParam, setViewParam] = useUrlParam('view')
  const view = activitiesView(viewParam)
  const viewTabs = useSegmentedTabs({ ids: VIEWS, value: view, onChange: (next) => setViewParam(next === 'map' ? 'map' : null) })
  const [search, setSearch] = useState('')
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
    // Once, and only into a still-empty field, so it never clobbers a user edit.
    // Not a state initializer: the server render has no sessionStorage.
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
  const matches = useMemo(
    () =>
      queryRuns(initialItems, {
        types: typesKey ? (typesKey.split(',') as ActivityQueryKind[]) : null,
        gearId,
        search: debouncedSearch,
        ...sortQuery(sort),
      }),
    [initialItems, typesKey, gearId, debouncedSearch, sort],
  )
  // The chip answers the tap at once; the list behind it renders just after.
  const items = useDeferredValue(matches)
  const matched = matches.length

  const hasActiveFilter = activeTypes !== null || gearId !== null || search.trim() !== ''
  const currentWeekStart = isoDate(startOfWeek(new Date(`${today}T00:00:00`)))
  const groups = useMemo(
    // groupByWeek keeps the order it is given.
    () => (sort === 'newest' || sort === 'oldest' ? weekRows(groupByWeek(items, currentWeekStart), currentWeekStart) : null),
    [items, sort, currentWeekStart],
  )
  const blocks = useMemo(() => (groups ? listBlocks(groups) : null), [groups])
  const [weekParam] = useUrlParam('week')
  // The archive renders a few months at a time: the whole of it at once was the slowest page to become usable.
  // Back renders as far as the list was read, so the shell's scroll restore lands on the run just left.
  const [shownBlocks, setShownBlocks] = useState(() => (isPopNavigation() ? savedShownBlocks() : FIRST_BLOCKS))
  useEffect(() => {
    try {
      sessionStorage.setItem(SHOWN_BLOCKS_KEY, String(shownBlocks))
    } catch {
    }
  }, [shownBlocks])
  const shown = blocks && !weekParam ? blocks.slice(0, shownBlocks) : blocks
  const shownRows = blocks ? null : items.slice(0, shownBlocks * ROWS_PER_BLOCK)
  const moreToShow = blocks ? !!shown && shown.length < blocks.length : shownRows!.length < items.length
  // State, not a ref: the sentinel remounts when the map gives way to the list, and the observer must follow it.
  const [moreNode, setMoreNode] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    const node = moreNode
    if (!moreToShow || !node) return
    if (typeof IntersectionObserver === 'undefined') {
      startTransition(() => setShownBlocks(Number.POSITIVE_INFINITY))
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) startTransition(() => setShownBlocks((n) => n + MORE_BLOCKS))
      },
      { rootMargin: '1500px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [moreToShow, shownBlocks, moreNode])

  // ?week= (a Monday) scrolls that week's card into view once the list holding it has loaded.
  useEffect(() => {
    if (!weekParam || !blocks) return
    const frame = requestAnimationFrame(() => document.getElementById(`week-${weekParam}`)?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(frame)
  }, [weekParam, blocks])

  function resetFilters() {
    setFilter(ALL_RUNS)
    setGearId(null)
    setSearch('')
    setSortParam(null)
  }

  const archiveLine = [
    totalKm > 0 ? t.activities.countWithDistance(totalCount, formatKm(totalKm)) : t.activities.count(totalCount),
    firstMonth ? t.activities.since(firstMonth) : null,
  ].filter((part): part is string => part !== null)

  const pickedLabel = typesLabel(filter.types)
  const onlyGroup = filter.types.length === 0 && filter.group !== 'all' && gearId === null && search.trim() === '' ? filter.group : null
  // Only when the page handed over the whole archive, so "1 of 5 runs" is never a page's count.
  const weekTotals = useMemo(() => {
    if (initialItems.length < totalCount) return null
    const totals = new Map<string, number>()
    for (const a of initialItems) {
      const monday = isoDate(startOfWeek(new Date(`${a.date.slice(0, 10)}T00:00:00`)))
      totals.set(monday, (totals.get(monday) ?? 0) + 1)
    }
    return totals
  }, [initialItems, totalCount])
  const countedLabel = onlyGroup
    ? t.activities.filter.groupCount[onlyGroup](matched)
    : hasActiveFilter
      ? t.activities.count(matched)
      : t.activities.weekLine.runs(matched)
  const totalsLabel = onlyGroup ? t.activities.filter.groupTotals[onlyGroup] : t.activities.filter.totalsCount

  return (
    <div className="flex flex-col gap-3">
      <header>
        <div className="flex items-center justify-between gap-4">
          <h1 className="min-w-0 text-display text-foreground">{t.pages.activities.title}</h1>
          <SegmentedTabs
            tabs={viewTabs}
            items={[
              { id: 'list', label: t.activities.view.list },
              { id: 'map', label: t.activities.view.map },
            ]}
            label={t.activities.view.label}
            barMirror
          />
        </div>
        <p data-title-sub className="mt-0.5 text-[15px] leading-5 text-muted-foreground">{archiveLine.join(' · ')}</p>
      </header>

      <div {...viewTabs.panelProps} className="flex flex-col gap-3 outline-none">
        {view === 'map' ? (
          // This device's today, so a page kept from another day still finds the right plan.
          <GlobalMapWrapper version={map.version} clusterId={map.clusterId} exploreAreas={exploreAreas} explorePlans={explorePlans} completedSince={exploreCompletedSince} today={today} />
        ) : (
          <>

            <div className="on-aura-group">
              <i aria-hidden="true" className="on-aura-blur inset-0 rounded-full" />
              <label className="on-aura flex h-11 items-center gap-2 rounded-full px-3.5 text-muted-foreground transition-shadow focus-within:shadow-[0_0_0_2px_var(--ring)]">
                <Search size={18} strokeWidth={2.2} aria-hidden="true" className="shrink-0" />
                <input
                  type="text"
                  placeholder={t.activities.searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-full min-w-0 flex-1 bg-transparent text-[17px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </label>
            </div>

            {/* The rail reaches past its row, to the screen's edges and 36 pt down, so
                its scroll box does not clip the chips' glass drop; what follows paints,
                and takes taps, over that margin. One blur lies under the whole row, not
                one per chip. */}
            <div className="on-aura-group flex items-center gap-2">
              <i aria-hidden="true" className="on-aura-blur on-aura-blur-row -inset-x-4 inset-y-0" />
              <div className="-mx-4 -mb-9 -mt-1.5 flex min-w-0 flex-1 gap-2 overflow-x-auto px-4 pb-9 pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-testid="type-chips">
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
                      variant={filter.group === group ? 'selected' : 'onAura'}
                      // 12 pt a side, so French's four fit beside the button at 393 pt.
                      className="px-3"
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
                className="on-aura hit-44 relative flex size-9 shrink-0 items-center justify-center rounded-full text-foreground"
              >
                <SlidersHorizontal size={17} aria-hidden="true" />
                {(sort !== 'newest' || hasActiveFilter) && (
                  <span aria-hidden="true" data-testid="sheet-dot" className="absolute right-0.5 top-0.5 box-content size-2 rounded-full border-2 border-[var(--background)] bg-accent" />
                )}
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

            {(hasActiveFilter || sort !== 'newest') && (
              <div
                className="flex items-center justify-between gap-3 rounded-xl border px-3 py-[9px] text-[12.5px]"
                style={{
                  background: 'color-mix(in srgb, var(--accent) 9%, var(--background))',
                  borderColor: 'color-mix(in srgb, var(--accent) 22%, var(--background))',
                }}
                data-testid="filter-bar"
              >
                <p className="min-w-0 text-[var(--text-2)] text-pretty">
                  {t.activities.filter.showing}{' '}
                  <b className="font-semibold text-foreground">{countedLabel}</b>
                  {hasActiveFilter && totalsLabel}
                  {sort !== 'newest' && ` · ${t.activities.filter.sortedBy[sort]}`}
                </p>
                <button type="button" onClick={resetFilters} className="hit-44 shrink-0 font-medium text-accent-text">
                  {t.activities.filter.clear}
                </button>
              </div>
            )}

            {items.length === 0 ? (
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
                {shown!.map((block) =>
                  block.kind === 'current' ? (
                    // Its km and runs, not the plan: Today and Plan show the week against plan.
                    <section key={block.week.key} id={`week-${block.week.key}`} className="scroll-mt-24" data-testid="current-week">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-1 pb-2">
                        <h2 className="text-title-3 text-foreground">{t.activities.thisWeek}</h2>
                        <span className="text-[13px] text-muted-foreground" data-testid="week-line">
                          <span className={KM_STRONG}>{formatRanKm(block.week.totalKm)}</span> {t.units.km} · {t.activities.weekLine.runs(block.week.items.length)}
                          {!hasActiveFilter && block.week.easyPct !== null && ` · ${t.activities.weekLine.easy(block.week.easyPct)}`}
                        </span>
                      </div>
                      <div className={cardClass({ padding: 'none', overflow: true })}>
                        <InsetRows items={block.week.items} efforts={qualifiedEffortsByActivityId} types={sessionTypes} />
                      </div>
                    </section>
                  ) : (
                    <section key={block.key} data-testid="month">
                      {/* Sticky under the compact title bar while it shows; on a phone not
                          otherwise (--sticky-alone, globals.css). */}
                      <div
                        data-sticky-strip
                        className="sticky z-30 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 bg-background px-1 pb-2 pt-3.5 max-lg:bg-transparent"
                        style={{ top: 'var(--sticky-top, var(--sticky-alone, var(--safe-top)))' }}
                      >
                        <h2 className="text-title-3 capitalize text-foreground">{block.label}</h2>
                        <span className="text-[13px] text-muted-foreground" data-testid="month-line">
                          {onlyGroup
                            ? `${t.activities.filter.groupCount[onlyGroup](block.runs)} · ${formatKm(block.km)} ${t.units.km}`
                            : `${formatKm(block.km)} ${t.units.km} · ${t.activities.weekLine.runs(block.runs)}`}
                        </span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {block.weeks.map((g) => (
                          // Off screen, a week is skipped by style and layout: the whole archive is one page.
                          <section
                            key={g.key}
                            id={`week-${g.key}`}
                            className={cardClass({ padding: 'none', overflow: true, className: 'scroll-mt-24 [content-visibility:auto]' })}
                            style={{ containIntrinsicSize: `auto ${WEEK_HEADER_PX + g.items.length * ROW_PX}px` }}
                            data-testid="week"
                          >
                            <div className="flex items-baseline justify-between gap-4 px-4 pb-1.5 pt-3.5">
                              <h3 className="whitespace-nowrap text-headline text-foreground">{g.label}</h3>
                              <PastWeekLine group={g} showEasy={!hasActiveFilter} weekTotal={hasActiveFilter ? (weekTotals?.get(g.key) ?? null) : null} />
                            </div>
                            <InsetRows items={g.items} efforts={qualifiedEffortsByActivityId} types={sessionTypes} />
                          </section>
                        ))}
                      </div>
                    </section>
                  ),
                )}
              </div>
            ) : (
              // Separators start under the titles, past the 48 pt thumbs.
              // Off screen, a row is skipped by style and layout, as a week is under the months.
              <div className={cardClass({ padding: 'none', overflow: true, className: 'inset-group [--row-thumb-inset:78px] *:[content-visibility:auto] *:[contain-intrinsic-size:auto_72px]' })}>
                {shownRows!.map((a) => (
                  <ActivityThumbRow key={a.id} activity={a} qualifiedEfforts={qualifiedEffortsByActivityId[a.id]} type={sessionTypes[a.id]} />
                ))}
              </div>
            )}

            {moreToShow && <div ref={setMoreNode} aria-hidden="true" className="h-px" />}
            {items.length > 0 && !moreToShow && (
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
