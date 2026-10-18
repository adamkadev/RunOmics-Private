'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Search, SearchX, ChevronDown, X } from 'lucide-react'
import { ActivityThumbRow } from './ActivityThumbRow'
import { ACTIVITY_TYPES, isActivityType, type ActivitySummary, type ActivityType } from '@/domain/activity/types'
import { runTypeColor } from '@/lib/colors'
import type { ActivityQueryResult, ActivitySortKey, ActivitySortOrder } from '@/application/usecases/QueryActivities'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import { weeklyTargetKm, type WeekTarget } from '@/domain/training/weekTarget'
import { formatWeekKm } from '@/components/plan/weekPlanDays'
import { cardClass } from '@/components/ui/Card'
import { Pill } from '@/components/ui/Pill'
import { TypeDot } from '@/components/ui/TypeDot'
import { Legend, LegendItem } from '@/components/ui/Legend'
import { SortDropdown } from '@/components/ui/SortDropdown'
import { easyShare } from '@/domain/activity/easyShare'
import { groupByWeek, withCurrentWeek, type WeekGroup } from '@/domain/activity/weekGroups'

import { formatDate, formatDateRange, formatKm, formatRanKm } from '@/lib/formatters'
import { useUrlParam } from '@/lib/useUrlParam'
import { isoDate, addDays, startOfWeek } from '@/lib/calendarDate'
import { cn } from '@/lib/utils'
import { useToday } from '@/lib/useToday'
import { t } from '@/i18n'

const ALL_TYPES: readonly ActivityType[] = ACTIVITY_TYPES

// Registry order is the intensity ramp, which puts Sprint and Anaerobic - the
// two rarest - in the first two chip slots. Order the filter by how much of the
// archive each type actually accounts for, commonest first.
function chipOrder(items: ActivitySummary[]): ActivityType[] {
  const counts = new Map<ActivityType, number>()
  for (const a of items) counts.set(a.type, (counts.get(a.type) ?? 0) + 1)
  return [...ALL_TYPES].sort(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || ALL_TYPES.indexOf(a) - ALL_TYPES.indexOf(b)
  )
}
const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300
/** The chip rail's right edge fading out over 24 pt while there is more to scroll (v4.17.2). */
const CHIP_FADE = 'linear-gradient(to right, #000 calc(100% - 24px), transparent)'

const SORT_OPTIONS: { value: ActivitySortKey; label: string }[] = [
  { value: 'date', label: t.activities.sort.date },
  { value: 'distance', label: t.activities.sort.distance },
  { value: 'duration', label: t.activities.sort.duration },
  { value: 'pace', label: t.activities.sort.pace },
  { value: 'avgHr', label: t.activities.sort.avgHr },
]

interface WeekRow extends WeekGroup<ActivitySummary> {
  label: string
  easyPct: number | null
  shape: string
}

const KM_STRONG = 'font-semibold text-foreground'

/**
 * "0 of 51 km · 0 of 5 runs": the current week against its plan, as Today
 * says it (v4.17), then the easy share once there is a run to measure.
 */
function CurrentWeekLine({
  group,
  ranKm,
  targetKm,
  plan,
}: {
  group: WeekRow
  ranKm: number
  targetKm: number | null
  plan: { done: number; sessions: number } | null
}) {
  const w = t.activities.weekLine
  return (
    <span className="text-footnote text-muted-foreground" data-testid="week-line">
      <span className={KM_STRONG}>{formatRanKm(ranKm)}</span>
      {targetKm !== null ? w.ofKm(formatWeekKm(targetKm)) : ` ${t.units.km}`}
      {' · '}
      {plan && plan.sessions > 0 ? w.runsOf(plan.done, plan.sessions) : w.runs(group.items.length)}
      {group.easyPct !== null && ` · ${w.easy(group.easyPct)}`}
    </span>
  )
}

/** "50 km · 5 runs · 89% easy": every aggregate says what it counts (v4.17). */
function PastWeekLine({ group }: { group: WeekRow }) {
  const w = t.activities.weekLine
  return (
    // The line gives way on a narrow phone, wrapping, so the week's dates never do (v4.17.2).
    <span className="min-w-0 text-right text-footnote text-muted-foreground text-pretty" data-testid="past-week-line">
      <span className={KM_STRONG}>{Math.round(group.totalKm)}</span> {t.units.km} · {w.runs(group.items.length)}
      {group.easyPct !== null && ` · ${w.easy(group.easyPct)}`}
    </span>
  )
}

/** Runs as rounded rows inside their open week, each with its route (v4.17). */
function InsetRows({ items, efforts }: { items: ActivitySummary[]; efforts: Record<string, QualifiedEffort[]> }) {
  return (
    <div className="flex flex-col px-2 pb-2">
      {items.map((a) => (
        <ActivityThumbRow key={a.id} activity={a} qualifiedEfforts={efforts[a.id]} variant="inset" />
      ))}
    </div>
  )
}

const DOT_CAP = 8

/**
 * What the week rows' dots mean, the types on screen only: a race's hollow
 * ring and the neighbouring blues and purples had no key (screen audit,
 * Oct 2026).
 */
function TypeKey({ items }: { items: ActivitySummary[] }) {
  const present = new Set(items.map((a) => a.type))
  const types = ALL_TYPES.filter((type) => present.has(type))
  if (types.length === 0) return null
  return (
    <Legend className="px-1">
      {types.map((type) => (
        <LegendItem key={type} swatch={type === 'Race' ? 'ring' : 'dot'} color={runTypeColor(type)}>
          {t.activityTypes[type] ?? type}
        </LegendItem>
      ))}
    </Legend>
  )
}

/** The week's runs as their type dots, in the order they were run. */
function WeekCompositionDots({ items, label }: { items: ActivitySummary[]; label: string }) {
  const chronological = [...items].sort((a, b) => a.date.localeCompare(b.date))
  const shown = chronological.slice(0, DOT_CAP)
  const overflow = chronological.length - shown.length

  return (
    <span className="flex items-center" role="img" aria-label={label}>
      <span className="flex items-center gap-1" aria-hidden="true">
        {shown.map((a) => (
          <TypeDot key={a.id} type={a.type} />
        ))}
      </span>
      {overflow > 0 && (
        <span aria-hidden="true" className="ml-1 text-[11px] leading-none text-subtle">
          +{overflow}
        </span>
      )}
    </span>
  )
}

// The bar measures the week against the plan's km, the one weekly target
// Today and Plan read (weeklyTargetKm).
function WeekTargetBar({ ranKm, targetKm }: { ranKm: number; targetKm: number }) {
  const pct = Math.min(100, Math.round((ranKm / targetKm) * 100))
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]" data-testid="week-target-bar">
      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  )
}

// "3 base · 1 threshold · 1 tempo" - the seven real ActivityTypes, in descending
// count. There is no "long" type, whatever the review's example said.
function weekShape(items: ActivitySummary[]): string {
  const counts = new Map<ActivityType, number>()
  for (const a of items) counts.set(a.type, (counts.get(a.type) ?? 0) + 1)

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || ALL_TYPES.indexOf(a[0]) - ALL_TYPES.indexOf(b[0]))
    // A type this build does not know yet has no label; name it as it came.
    .map(([type, count]) => `${count} ${(t.activityTypes[type] ?? type).toLowerCase()}`)
    .join(' · ')
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
      shape: weekShape(group.items),
    }
  })
}

type ListBlock =
  | { kind: 'current'; week: WeekRow }
  | { kind: 'month'; key: string; label: string; km: number; runs: number; weeks: WeekRow[] }

/**
 * The weeks under their months (v4.17): consecutive past weeks that start in
 * the same month share a sticky heading, which totals the weeks under it -
 * so "132 km · 15 runs" is the sum of the rows it heads. The current week is
 * its own card, wherever the sort puts it.
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

const FILTERS_STORAGE_KEY = 'activities:filters'

interface StoredFilters {
  search: string
  selectedType: ActivityType | null
  sortBy: ActivitySortKey
  sortOrder: ActivitySortOrder
  expandedWeeks: string[]
}

function readStoredFilters(): StoredFilters | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(FILTERS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredFilters>
    return {
      search: typeof parsed.search === 'string' ? parsed.search : '',
      selectedType: isActivityType(parsed.selectedType) ? parsed.selectedType : null,
      sortBy: SORT_OPTIONS.some((o) => o.value === parsed.sortBy) ? (parsed.sortBy as ActivitySortKey) : 'date',
      sortOrder: parsed.sortOrder === 'asc' || parsed.sortOrder === 'desc' ? parsed.sortOrder : 'desc',
      expandedWeeks: Array.isArray(parsed.expandedWeeks) ? parsed.expandedWeeks.filter((k) => typeof k === 'string') : [],
    }
  } catch {
    return null
  }
}

async function fetchActivities(params: {
  type: ActivityType | null
  gearId: string | null
  search: string
  sortBy: ActivitySortKey
  sortOrder: ActivitySortOrder
  offset: number
}): Promise<ActivityQueryResult> {
  const qs = new URLSearchParams({
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    offset: String(params.offset),
    limit: String(PAGE_SIZE),
  })
  if (params.type) qs.set('type', params.type)
  if (params.gearId) qs.set('gear', params.gearId)
  if (params.search.trim()) qs.set('search', params.search.trim())

  const res = await fetch(`/api/activities?${qs}`)
  return res.json()
}

interface Props {
  /** This week against its plan and the volume goal, from the same selector as Today and Plan. */
  weekTarget: WeekTarget | null
  initialItems: ActivitySummary[]
  initialNextOffset: number | null
  totalCount: number
  qualifiedEffortsByActivityId?: Record<string, QualifiedEffort[]>
  /** The date the page was prerendered on; see useToday. */
  today: string
  /** Shoe names by gear id, to name the ?shoe= filter. */
  shoeNames?: Record<string, string>
}

export function ActivityListClient({
  weekTarget,
  initialItems,
  initialNextOffset,
  totalCount,
  qualifiedEffortsByActivityId = {},
  today: serverToday,
  shoeNames = {},
}: Props) {
  const today = useToday(serverToday)
  const [search, setSearch] = useState('')
  // ?shoe= narrows the list to one pair; it is the shoe page's way in.
  const [gearId, setGearId] = useUrlParam('shoe')
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null)
  const [sortBy, setSortBy] = useState<ActivitySortKey>('date')
  const [sortOrder, setSortOrder] = useState<ActivitySortOrder>('desc')

  const [items, setItems] = useState(initialItems)
  const [nextOffset, setNextOffset] = useState(initialNextOffset)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set())

  const chipRailRef = useRef<HTMLDivElement>(null)
  const [chipFade, setChipFade] = useState(false)
  const updateChipFade = useCallback(() => {
    const el = chipRailRef.current
    if (!el) return
    setChipFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useLayoutEffect(() => {
    updateChipFade()
    const el = chipRailRef.current
    if (!el) return
    const obs = new ResizeObserver(updateChipFade)
    obs.observe(el)
    return () => obs.disconnect()
  }, [updateChipFade])

  // Derived from the unfiltered set the page handed us, so the header keeps
  // describing the archive rather than the current filter.
  const totalKm = useMemo(() => initialItems.reduce((sum, a) => sum + a.distanceKm, 0), [initialItems])
  const chipTypes = useMemo(() => chipOrder(initialItems), [initialItems])
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
    const stored = readStoredFilters()
    if (!stored) return
    // Restored from sessionStorage once, behind hasRestored, and merged only
    // into still-default values, so it can never clobber a user edit. It cannot
    // be a state initializer: the server render has no sessionStorage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch((cur) => (cur === '' ? stored.search : cur))
    setDebouncedSearch((cur) => (cur === '' ? stored.search : cur))
    setSelectedType((cur) => (cur === null ? stored.selectedType : cur))
    setSortBy((cur) => (cur === 'date' ? stored.sortBy : cur))
    setSortOrder((cur) => (cur === 'desc' ? stored.sortOrder : cur))
    setExpandedWeeks((cur) => (cur.size === 0 ? new Set(stored.expandedWeeks) : cur))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const toStore: StoredFilters = {
      search: debouncedSearch,
      selectedType,
      sortBy,
      sortOrder,
      expandedWeeks: Array.from(expandedWeeks),
    }
    try {
      sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(toStore))
    } catch {
    }
  }, [debouncedSearch, selectedType, sortBy, sortOrder, expandedWeeks])

  const requestSeq = useRef(0)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const seq = ++requestSeq.current
    setIsPending(true)
    fetchActivities({ type: selectedType, gearId, search: debouncedSearch, sortBy, sortOrder, offset: 0 })
      .then((result) => {
        if (seq !== requestSeq.current) return
        setIsPending(false)
        setItems(result.items)
        setNextOffset(result.nextOffset)
      })
      .catch(() => {
        if (seq !== requestSeq.current) return
        setIsPending(false)
      })
  }, [selectedType, gearId, debouncedSearch, sortBy, sortOrder])

  const hasMore = nextOffset !== null
  const hasActiveFilter = selectedType !== null || gearId !== null || search.trim() !== ''
  const currentWeekStart = isoDate(startOfWeek(new Date(`${today}T00:00:00`)))
  // `items` answers the filter the last request was made with, which is the
  // debounced search rather than the half-typed one.
  const itemsAreFiltered = selectedType !== null || gearId !== null || debouncedSearch.trim() !== ''
  const groups = useMemo(() => {
    if (sortBy !== 'date') return null
    const grouped = groupByWeek(items, currentWeekStart)
    // Only the unfiltered newest-first view opens on this week whether or not
    // it has a run yet; a filtered or oldest-first list shows the week where
    // (and if) its runs put it.
    const opensOnThisWeek = sortOrder === 'desc' && !itemsAreFiltered
    return weekRows(opensOnThisWeek ? withCurrentWeek(grouped, currentWeekStart) : grouped, currentWeekStart)
  }, [items, sortBy, sortOrder, itemsAreFiltered, currentWeekStart])
  const blocks = useMemo(() => (groups ? listBlocks(groups) : null), [groups])
  // Before this week's first run its card is empty, so the latest runs would
  // otherwise all sit behind collapsed rows. The newest week that has any
  // starts open instead - under its own label, not the current card's.
  // The current week reads the plan's selector, the same ran km and target
  // Today and Plan show (H04).
  const currentTargetKm = weekTarget ? weeklyTargetKm(weekTarget) : null
  const currentRanKm = weekTarget?.ranKm ?? groups?.find((g) => g.isCurrent)?.totalKm ?? 0
  const openByDefault = groups?.[0]?.isCurrent && groups[0].items.length === 0 ? groups[1]?.key : undefined

  const loadMore = useCallback(() => {
    if (nextOffset === null || loadingMore) return
    setLoadingMore(true)
    const seq = requestSeq.current
    fetchActivities({ type: selectedType, gearId, search: debouncedSearch, sortBy, sortOrder, offset: nextOffset })
      .then((result) => {
        setLoadingMore(false)
        if (seq !== requestSeq.current) return
        setItems((prev) => [...prev, ...result.items])
        setNextOffset(result.nextOffset)
      })
      .catch(() => setLoadingMore(false))
  }, [nextOffset, loadingMore, selectedType, gearId, debouncedSearch, sortBy, sortOrder])

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
    setSelectedType(null)
    setGearId(null)
    setSearch('')
  }

  const archiveLine = [
    totalKm > 0 ? t.activities.countWithDistance(totalCount, formatKm(totalKm)) : t.activities.count(totalCount),
    firstMonth ? t.activities.since(firstMonth) : null,
  ].filter((part): part is string => part !== null)

  const toggleWeek = (key: string) =>
    setExpandedWeeks((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="flex flex-col gap-3.5">
      {/* The page header (v4.17): the H1 and its line, the page's controls on
          the title's row. They top-align: the sort menu opens in the flow,
          and a bottom-aligned row would drag the title down with it. */}
      <header className="mb-1.5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-display text-foreground">{t.pages.activities.title}</h1>
          {/* Each part carries its " · " in front, pulled out by the row's
              negative margin: beside the phone's controls "since May 2025"
              wraps onto its own line, its dot clipped at the edge. */}
          <p className="mt-1 overflow-hidden text-sm text-muted-foreground">
            <span className="-ml-3.5 flex flex-wrap">
              {archiveLine.map((part) => (
                <span key={part} className="whitespace-nowrap">
                  <span aria-hidden="true" className="inline-block w-3.5 text-center">·</span>
                  {part}
                </span>
              ))}
            </span>
          </p>
        </div>
        {/* Level with the subtitle (v4.17): the sort menu floats, so it no
            longer drags the title down when it opens. */}
        <div className="flex shrink-0 items-center gap-2 self-end">
          {/* Drawn at 34 pt like the sort menu, tapped at 44 (design review,
              Oct 2026). */}
          <Link
            href="/map"
            className="hit-44 flex h-[34px] items-center justify-center rounded-[9px] border border-[var(--line-2)] bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-[var(--surface-2)]"
          >
            {t.activities.mapButton}
          </Link>
          <SortDropdown
            options={SORT_OPTIONS}
            sortBy={sortBy}
            order={sortOrder}
            onChange={(value, order) => {
              setSortBy(value)
              setSortOrder(order)
            }}
            label={t.activities.sort.label}
          />
        </div>
      </header>

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

      <div className="relative -mx-4 sm:mx-0">
        <div
          ref={chipRailRef}
          onScroll={updateChipFade}
          // The chips' 44 pt hit areas reach 6 pt past them; the padding keeps
          // them inside the scroller, so the rail never scrolls vertically.
          // While there is more to scroll, the rail's last 24 pt fade out
          // (v4.17.2) - a chip cut at the edge read as the row's end - and
          // the end padding lets the last chip scroll clear of the fade.
          className="-my-1.5 flex gap-2 overflow-x-auto py-1.5 pl-4 pr-6 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            scrollPaddingInline: '16px 24px',
            ...(chipFade ? { maskImage: CHIP_FADE, WebkitMaskImage: CHIP_FADE } : {}),
          }}
          data-fade={chipFade || undefined}
          data-testid="type-chips"
        >
          <Pill as="button" variant={selectedType === null ? 'selected' : 'neutral'} className="px-3" onClick={() => setSelectedType(null)}>
            {t.activities.all}
          </Pill>
          {/* Each type chip carries its category's dot (v4.17); a race is the
              zone of its effort as a ring, never filled. */}
          {chipTypes.map((type) => {
            const active = selectedType === type
            return (
              <Pill
                key={type}
                as="button"
                variant={active ? 'selected' : 'neutral'}
                className="px-3"
                dotColor={type === 'Race' ? undefined : runTypeColor(type)}
                onClick={() => setSelectedType(active ? null : type)}
              >
                {type === 'Race' && <TypeDot type={type} />}
                {t.activityTypes[type] ?? type}
              </Pill>
            )
          })}
        </div>
      </div>

      {gearId && (
        <div>
          <Pill as="button" variant="selected" className="gap-1.5" onClick={() => setGearId(null)} aria-label={t.activities.shoeFilter.clear}>
            {shoeNames[gearId] ?? gearId}
            <X size={14} aria-hidden="true" />
          </Pill>
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
          <TypeKey items={items} />
          {blocks.map((block) =>
            block.kind === 'current' ? (
              <section key={block.week.key} className={cardClass({ padding: 'none', overflow: true })} data-testid="current-week">
                <div className="flex flex-col gap-2.5 px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h2 className="truncate text-[15px] font-semibold text-foreground">{block.week.label}</h2>
                    <CurrentWeekLine
                      group={block.week}
                      ranKm={currentRanKm}
                      targetKm={currentTargetKm}
                      plan={weekTarget ? { done: weekTarget.plannedDone, sessions: weekTarget.planSessions } : null}
                    />
                  </div>
                  {currentTargetKm !== null && <WeekTargetBar ranKm={currentRanKm} targetKm={currentTargetKm} />}
                </div>
                {block.week.items.length > 0 && <InsetRows items={block.week.items} efforts={qualifiedEffortsByActivityId} />}
              </section>
            ) : (
              <section key={block.key} data-testid="month">
                {/* Sticky under the compact title bar while it shows, under
                    the status strip otherwise. */}
                <div
                  className="sticky z-10 flex items-baseline justify-between gap-3 bg-background px-1 pb-2 pt-3.5"
                  style={{ top: 'var(--sticky-top, var(--safe-top))' }}
                >
                  <h2 className="text-footnote font-semibold capitalize tracking-[0.02em] text-foreground">{block.label}</h2>
                  <span className="text-xs text-muted-foreground" data-testid="month-line">
                    {formatKm(block.km)} {t.units.km} · {t.activities.weekLine.runs(block.runs)}
                  </span>
                </div>
                <div className={cardClass({ padding: 'none', overflow: true, className: 'divide-y divide-border' })}>
                  {block.weeks.map((g) => {
                    // A toggle flips a week from its default, so for the week
                    // that starts open, being in expandedWeeks means the
                    // reader closed it.
                    const isExpanded = expandedWeeks.has(g.key) !== (g.key === openByDefault)
                    return (
                      <div key={g.key}>
                        <button
                          type="button"
                          onClick={() => toggleWeek(g.key)}
                          aria-expanded={isExpanded}
                          className="flex w-full items-center gap-4 px-5 py-3.5 text-left"
                        >
                          <span className="flex flex-1 flex-col gap-1.5">
                            <span className="whitespace-nowrap text-sm font-semibold text-foreground">{g.label}</span>
                            <WeekCompositionDots items={g.items} label={g.shape} />
                          </span>
                          <PastWeekLine group={g} />
                          <ChevronDown size={14} aria-hidden="true" className={cn('shrink-0 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                        </button>
                        {isExpanded && g.items.length > 0 && <InsetRows items={g.items} efforts={qualifiedEffortsByActivityId} />}
                      </div>
                    )
                  })}
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
    </div>
  )
}
