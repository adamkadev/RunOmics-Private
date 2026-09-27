'use client'

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { SearchX, ChevronDown, X } from 'lucide-react'
import { ActivityThumbRow, ThumbRowDivider } from './ActivityThumbRow'
import { ACTIVITY_TYPES, isActivityType, type ActivitySummary, type ActivityType } from '@/domain/activity/types'
import { sessionZone, zoneColor } from '@/lib/colors'
import type { ActivityQueryResult, ActivitySortKey, ActivitySortOrder } from '@/application/usecases/QueryActivities'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import { weeklyTargetKm, type WeekTarget } from '@/domain/training/weekTarget'
import { formatWeekKm } from '@/components/plan/weekPlanDays'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Pill } from '@/components/ui/Pill'
import { SortDropdown } from '@/components/ui/SortDropdown'
import { easyShare } from '@/domain/activity/easyShare'
import { groupByWeek, withCurrentWeek, type WeekGroup } from '@/domain/activity/weekGroups'

import { formatDateRange, formatKm, formatRanKm } from '@/lib/formatters'
import { SectionDivider } from '@/components/ui/SectionLabel'
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

/** "27/48 km · 3 runs · 85% easy": the current week's header, one line (H08, M8). */
function CurrentWeekLine({ group, ranKm, targetKm }: { group: WeekRow; ranKm: number; targetKm: number | null }) {
  const w = t.activities.weekLine
  return (
    <span className="shrink-0 text-footnote tabular-nums text-muted-foreground" data-testid="week-line">
      <span className={KM_STRONG}>{formatRanKm(ranKm)}</span>
      {targetKm !== null ? w.ofKm(formatWeekKm(targetKm)) : ` ${t.units.km}`}
      {' · '}
      {w.runs(group.items.length)}
      {group.easyPct !== null && ` · ${w.easy(group.easyPct)}`}
    </span>
  )
}

/**
 * "45 km · 5 runs · 89% easy" on the first collapsed week, which teaches the
 * short "45 km · 5 · 89%" every week under it (v5.5 #24).
 */
function PastWeekLine({ group, long = false }: { group: WeekRow; long?: boolean }) {
  const w = t.activities.weekLine
  return (
    <span className="shrink-0 text-footnote tabular-nums text-muted-foreground" data-testid="past-week-line">
      <span className={KM_STRONG}>{Math.round(group.totalKm)}</span> {t.units.km} · {long ? w.runs(group.items.length) : group.items.length}
      {group.easyPct !== null && ` · ${long ? w.easy(group.easyPct) : `${group.easyPct}%`}`}
    </span>
  )
}

/** Runs as flat rows in one card, each with its route (H09, M8). */
function ThumbRows({ items, efforts }: { items: ActivitySummary[]; efforts: Record<string, QualifiedEffort[]> }) {
  return (
    <>
      {items.map((a, i) => (
        <Fragment key={a.id}>
          {i > 0 && <ThumbRowDivider />}
          <ActivityThumbRow activity={a} qualifiedEfforts={efforts[a.id]} withDay />
        </Fragment>
      ))}
    </>
  )
}

const DOT_CAP = 8

function WeekCompositionDots({ items, label }: { items: ActivitySummary[]; label: string }) {
  const chronological = [...items].sort((a, b) => a.date.localeCompare(b.date))
  const shown = chronological.slice(0, DOT_CAP)
  const overflow = chronological.length - shown.length

  return (
    <div className="mt-1.5 flex items-center" role="img" aria-label={label}>
      <div className="flex items-center" style={{ gap: '4px' }} aria-hidden="true">
        {shown.map((a) =>
          a.type === 'Race' ? (
            <span
              key={a.id}
              className="shrink-0 rounded-[4px]"
              style={{ width: '7px', height: '7px', border: `1.5px solid ${zoneColor(sessionZone({ type: 'Race' }))}` }}
            />
          ) : (
            <span
              key={a.id}
              className="shrink-0 rounded-[4px]"
              style={{ width: '7px', height: '7px', background: zoneColor(sessionZone(a)) }}
            />
          )
        )}
      </div>
      {overflow > 0 && (
        <span aria-hidden="true" style={{ marginLeft: '3px', fontSize: '11.5px', color: 'var(--subtle-2)' }}>
          +{overflow}
        </span>
      )}
    </div>
  )
}

// The bar measures the week against the plan's km, the one weekly target
// Today and Plan read (weeklyTargetKm).
function WeekTargetBar({ ranKm, targetKm }: { ranKm: number; targetKm: number }) {
  const pct = Math.min(100, Math.round((ranKm / targetKm) * 100))
  return (
    <div className="mx-4 mb-2 h-1 overflow-hidden rounded-full" style={{ background: 'var(--track)' }} data-testid="week-target-bar">
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
  const lastWeekStart = isoDate(addDays(new Date(currentWeekStart + 'T00:00:00'), -7))

  return groups.map((group) => {
    // No year in the row: it truncated to "Dec 29, 2025 – J…". The year is a
    // section header above the weeks it covers (G22).
    const range = formatDateRange(group.key, isoDate(addDays(new Date(group.key + 'T00:00:00'), 6)), { year: 'never' })
    return {
      ...group,
      label: group.key === currentWeekStart ? t.activities.thisWeek : group.key === lastWeekStart ? t.activities.lastWeek : range,
      easyPct: easyShare(group.items)?.easy ?? null,
      shape: weekShape(group.items),
    }
  })
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
  // The first collapsed week spells its stats out; the rest use the short form.
  const firstPastWeek = groups?.find((g) => !g.isCurrent)?.key
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

  return (
    <div className="space-y-4">
      <div className="px-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-display text-title1 font-bold leading-[1.1] tracking-tight text-foreground">
              {t.pages.activities.title}
            </h1>
            <p className="mt-0.5 text-footnote font-medium text-muted-foreground">
              {totalKm > 0 ? t.activities.countWithDistance(totalCount, formatKm(totalKm)) : t.activities.count(totalCount)}
            </p>
          </div>
          <div className="flex shrink-0 items-start gap-2 pt-1">
            <Link
              href="/map"
              className="flex h-9 items-center justify-center rounded-control border border-foreground/[0.12] px-3 text-footnote text-foreground transition-colors hover:bg-foreground/[0.06]"
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
        </div>

        <div className="relative mt-3">
          <input
            type="text"
            placeholder={t.activities.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-[14px] bg-foreground/[0.05] px-3.5 text-subhead text-foreground placeholder-subtle-2 focus:outline-none"
          />
        </div>
      </div>

      <div className="relative -mx-4 sm:mx-0">
        <div
          ref={chipRailRef}
          onScroll={updateChipFade}
          className="flex gap-2 overflow-x-auto px-4 pb-1 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollPaddingInline: '16px' }}
        >
          <Pill
            as="button"
            variant={selectedType === null ? 'accent' : 'neutral'}
            className={cn('h-9 py-0 text-footnote font-semibold', selectedType === null ? 'px-4' : 'px-2.5')}
            onClick={() => setSelectedType(null)}
          >
            {t.activities.all}
          </Pill>
          {chipTypes.map((type) => {
            const active = selectedType === type
            return (
              <Pill
                key={type}
                as="button"
                variant={active ? 'accent' : 'neutral'}
                className={cn('h-9 py-0 text-footnote font-semibold', active ? 'px-4' : 'px-2.5')}
                onClick={() => setSelectedType(active ? null : type)}
              >
                {t.activityTypes[type] ?? type}
              </Pill>
            )
          })}
        </div>
        {chipFade && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 w-[30px]"
            style={{ height: '36px', background: 'linear-gradient(90deg, transparent, var(--background) 85%)' }}
          />
        )}
      </div>

      {gearId && (
        <div className="px-1">
          <Pill as="button" variant="accent" className="h-9 gap-1.5 py-0 text-footnote font-semibold" onClick={() => setGearId(null)} aria-label={t.activities.shoeFilter.clear}>
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
        <GlassSurface variant="card" className="rounded-2xl py-12 text-center">
          <SearchX size={24} className="mx-auto text-subtle" />
          <p className="mt-3 text-sm text-subtle">
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
        </GlassSurface>
      ) : groups ? (
        <div className="space-y-2">
          {groups.map((g, i) => {
            // A toggle flips a week from its default, so for the week that
            // starts open, being in expandedWeeks means the reader closed it.
            const isExpanded = g.isCurrent || expandedWeeks.has(g.key) !== (g.key === openByDefault)
            const year = g.key.slice(0, 4)
            const prevYear = i > 0 ? groups[i - 1]!.key.slice(0, 4) : today.slice(0, 4)
            return (
              <div key={g.key}>
                {year !== prevYear && <SectionDivider as="h2" className="px-1 pb-2 pt-1">{year}</SectionDivider>}
                {g.isCurrent ? (
                  <GlassSurface variant="card" className="overflow-hidden rounded-[22px]" data-testid="current-week">
                    <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-2.5">
                      <span className="truncate font-display text-base font-semibold text-foreground">{g.label}</span>
                      <CurrentWeekLine group={g} ranKm={currentRanKm} targetKm={currentTargetKm} />
                    </div>
                    {currentTargetKm !== null && <WeekTargetBar ranKm={currentRanKm} targetKm={currentTargetKm} />}
                    <ThumbRows items={g.items} efforts={qualifiedEffortsByActivityId} />
                    {g.items.length > 0 && <div className="h-1" />}
                  </GlassSurface>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedWeeks((prev) => {
                          const next = new Set(prev)
                          if (next.has(g.key)) next.delete(g.key)
                          else next.add(g.key)
                          return next
                        })
                      }
                      aria-expanded={isExpanded}
                      className="flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-display text-base font-semibold text-foreground">{g.label}</div>
                        <WeekCompositionDots items={g.items} label={g.shape} />
                      </div>
                      <PastWeekLine group={g} long={g.key === firstPastWeek} />
                      <ChevronDown size={14} aria-hidden="true" className={cn('shrink-0 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                    </button>
                    {isExpanded && g.items.length > 0 && (
                      <GlassSurface variant="card" className="mt-2 overflow-hidden rounded-[22px] py-0.5">
                        <ThumbRows items={g.items} efforts={qualifiedEffortsByActivityId} />
                      </GlassSurface>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <GlassSurface variant="card" className="overflow-hidden rounded-[22px] py-0.5">
          <ThumbRows items={items} efforts={qualifiedEffortsByActivityId} />
        </GlassSurface>
      )}

      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-1" />}
      {!hasMore && items.length > 0 && (
        <p className="py-2 text-center text-xs text-subtle">{t.activities.endOfList}</p>
      )}
    </div>
  )
}
