'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Search, SearchX, ChevronDown } from 'lucide-react'
import { ActivityListCard } from './ActivityListCard'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import type { ActivitySummary, ActivityType } from '@/domain/activity/types'
import type { ActivityQueryResult, ActivitySortKey, ActivitySortOrder } from '@/application/usecases/QueryActivities'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Pill } from '@/components/ui/Pill'
import { SortDropdown } from '@/components/ui/SortDropdown'
import { easyHardShare } from '@/domain/training/easyHard'
import { weekRangeLabel } from '@/lib/formatters'
import { isoDate, addDays, startOfWeek } from '@/lib/calendarDate'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const ALL_TYPES = Object.keys(ACTIVITY_TYPE_CONFIG) as ActivityType[]
const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300
const ACTIVE_CHIP_SHADOW = 'shadow-[0_4px_12px_-4px_var(--ring)]'

const SORT_OPTIONS: { value: ActivitySortKey; label: string }[] = [
  { value: 'date', label: t.activities.sort.date },
  { value: 'distance', label: t.activities.sort.distance },
  { value: 'duration', label: t.activities.sort.duration },
  { value: 'pace', label: t.activities.sort.pace },
  { value: 'avgHr', label: t.activities.sort.avgHr },
]

interface WeekGroup {
  key: string
  label: string
  /** Always the "Jul 6 - 12" range, shown as a subtitle even under "This week". */
  range: string
  items: ActivitySummary[]
  totalKm: number
  easyPct: number | null
  hardPct: number | null
}

function WeekStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-sm font-bold tabular-nums text-foreground">{value}</div>
      <div className="text-micro uppercase tracking-wide text-subtle">{label}</div>
    </div>
  )
}

// Groups are built from an already date-sorted list, so same-week items are
// always contiguous - a single linear pass is enough (B3). Weeks are Monday-
// Sunday, matching the Plan page's week convention.
function groupByWeek(items: ActivitySummary[]): WeekGroup[] {
  const raw: { key: string; items: ActivitySummary[] }[] = []
  for (const a of items) {
    const key = isoDate(startOfWeek(new Date(a.date + 'T00:00:00')))
    const last = raw[raw.length - 1]
    if (last && last.key === key) {
      last.items.push(a)
    } else {
      raw.push({ key, items: [a] })
    }
  }

  const currentWeekStart = isoDate(startOfWeek(new Date()))

  return raw.map(({ key, items: weekItems }) => {
    const totalKm = weekItems.reduce((s, a) => s + a.distanceKm, 0)
    // Same source as Today and Plan (time in HR zones 1-2 vs 3+) so the E/H
    // ratio can't diverge between screens.
    const { hardPct } = easyHardShare(weekItems)
    // Derive easy from the rounded hard so the two always sum to 100 and match
    // Today's "N% hard".
    const hard = hardPct === null ? null : Math.round(hardPct)
    const range = weekRangeLabel(key, isoDate(addDays(new Date(key + 'T00:00:00'), 6)))
    const label = key === currentWeekStart ? t.activities.thisWeek : range
    return {
      key,
      label,
      range,
      items: weekItems,
      totalKm,
      easyPct: hard === null ? null : 100 - hard,
      hardPct: hard,
    }
  })
}

// PageTransition (src/components/layout/PageTransition.tsx) keys the route
// subtree by pathname, so this component fully unmounts when navigating to an
// activity's detail page and remounts fresh on the way back. sessionStorage
// (cleared per-tab, mirrors AppShell's scroll-position cache) survives that
// remount so filters/sort/expanded weeks aren't lost on back navigation.
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
      selectedType: ALL_TYPES.includes(parsed.selectedType as ActivityType) ? (parsed.selectedType as ActivityType) : null,
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
  if (params.search.trim()) qs.set('search', params.search.trim())

  const res = await fetch(`/api/activities?${qs}`)
  return res.json()
}

interface Props {
  initialItems: ActivitySummary[]
  initialNextOffset: number | null
  totalCount: number
  qualifiedEffortsByActivityId?: Record<string, QualifiedEffort[]>
}

export function ActivityListClient({
  initialItems,
  initialNextOffset,
  totalCount,
  qualifiedEffortsByActivityId = {},
}: Props) {
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null)
  const [sortBy, setSortBy] = useState<ActivitySortKey>('date')
  const [sortOrder, setSortOrder] = useState<ActivitySortOrder>('desc')

  const [items, setItems] = useState(initialItems)
  const [nextOffset, setNextOffset] = useState(initialNextOffset)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isPending, setIsPending] = useState(false)
  // Past weeks start collapsed - only the first (most recent) week group reads
  // as a training block by default; older weeks are a tap away.
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set())

  // Debounce the search box before it hits the query (server round-trip).
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [search])

  // Restore from storage rather than a state initializer, which would differ from
  // the server-rendered markup and trip hydration. It runs as a *layout* effect
  // (the pattern AppShell already uses for scroll restoration) so it lands in
  // the same commit as hydration: a passive effect can be deferred long enough
  // for a keystroke to slip in first, and restoring over it would silently
  // wipe what was typed.
  const hasRestored = useRef(false)
  useLayoutEffect(() => {
    if (hasRestored.current) return
    hasRestored.current = true
    const stored = readStoredFilters()
    if (!stored) return
    /* eslint-disable react-hooks/set-state-in-effect -- one-time restore from sessionStorage on hydration */
    // Each field only fills a slot the user has not already changed, so a late
    // restore can never fight an interaction that beat it.
    setSearch((cur) => (cur === '' ? stored.search : cur))
    setDebouncedSearch((cur) => (cur === '' ? stored.search : cur))
    setSelectedType((cur) => (cur === null ? stored.selectedType : cur))
    setSortBy((cur) => (cur === 'date' ? stored.sortBy : cur))
    setSortOrder((cur) => (cur === 'desc' ? stored.sortOrder : cur))
    setExpandedWeeks((cur) => (cur.size === 0 ? new Set(stored.expandedWeeks) : cur))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  // Persist the *settled* search, not every keystroke: one write per query
  // rather than one per character, and it keeps the stored value consistent
  // with what `debouncedSearch` is restored to on the way back.
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
      // Private mode or a full quota - the filters just won't survive the trip.
    }
  }, [debouncedSearch, selectedType, sortBy, sortOrder, expandedWeeks])

  // Re-query from offset 0 whenever a filter changes. Guards against a stale
  // response from a previous filter combo landing after a newer one.
  const requestSeq = useRef(0)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const seq = ++requestSeq.current
    setIsPending(true)
    fetchActivities({ type: selectedType, search: debouncedSearch, sortBy, sortOrder, offset: 0 })
      .then((result) => {
        if (seq !== requestSeq.current) return
        setIsPending(false)
        setItems(result.items)
        setNextOffset(result.nextOffset)
      })
      // Without this a failed request leaves the spinner up forever, hiding
      // both the list and the empty state.
      .catch(() => {
        if (seq !== requestSeq.current) return
        setIsPending(false)
      })
  }, [selectedType, debouncedSearch, sortBy, sortOrder])

  const hasMore = nextOffset !== null
  const hasActiveFilter = selectedType !== null || search.trim() !== ''
  // Week separators only make sense when browsing in chronological order.
  const groups = sortBy === 'date' ? groupByWeek(items) : null

  const loadMore = useCallback(() => {
    if (nextOffset === null || loadingMore) return
    setLoadingMore(true)
    const seq = requestSeq.current
    fetchActivities({ type: selectedType, search: debouncedSearch, sortBy, sortOrder, offset: nextOffset })
      .then((result) => {
        setLoadingMore(false)
        if (seq !== requestSeq.current) return
        setItems((prev) => [...prev, ...result.items])
        setNextOffset(result.nextOffset)
      })
      // A failed page must release the guard, or infinite scroll wedges.
      .catch(() => setLoadingMore(false))
  }, [nextOffset, loadingMore, selectedType, debouncedSearch, sortBy, sortOrder])

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
    setSearch('')
  }

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="font-display text-title1 font-bold leading-[1.1] tracking-tight text-foreground">
          {t.pages.activities.title}
        </h1>
        <p className="mt-0.5 text-footnote font-medium text-muted-foreground">
          {t.activities.count(totalCount)}
        </p>

        <div className="relative mt-3">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle-2" />
          <input
            type="text"
            placeholder={t.activities.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-[11px] bg-foreground/[0.05] pl-9 pr-3 text-sm text-foreground placeholder-subtle-2 focus:outline-none"
          />
        </div>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Pill
          as="button"
          variant={selectedType === null ? 'active' : 'neutral'}
          className={cn('text-footnote font-semibold', selectedType === null && ACTIVE_CHIP_SHADOW)}
          onClick={() => setSelectedType(null)}
        >
          {t.activities.all}
        </Pill>
        {ALL_TYPES.map((type) => {
          const active = selectedType === type
          return (
            <Pill
              key={type}
              as="button"
              variant={active ? 'active' : 'neutral'}
              dotColor={active ? undefined : ACTIVITY_TYPE_CONFIG[type].chartColor}
              className={cn('text-footnote font-semibold', active && ACTIVE_CHIP_SHADOW)}
              onClick={() => setSelectedType(active ? null : type)}
            >
              {t.activityTypes[type]}
            </Pill>
          )
        })}
      </div>

      {/* Secondary controls: heatmap link + sort - not in the visual spec, kept from the existing feature set */}
      <div className="flex items-center justify-end gap-2">
        <Link
          href="/map"
          className="rounded-control border border-foreground/[0.12] bg-foreground/[0.06] px-2.5 py-1 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/[0.10]"
        >
          {t.nav.items.heatmap}
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
        <div className="space-y-3">
          {groups.map((g, i) => {
            const isCurrent = i === 0
            const isExpanded = isCurrent || expandedWeeks.has(g.key)
            return (
              <div key={g.key}>
                {isCurrent ? (
                  <div
                    className="sticky top-[max(var(--safe-top),8px)] z-10 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5"
                    style={{
                      background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                      borderColor: 'color-mix(in srgb, var(--accent) 22%, transparent)',
                    }}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-foreground">{g.label}</div>
                      <div className="text-micro text-subtle">{g.range}</div>
                    </div>
                    <div className="flex shrink-0 items-end gap-4 text-right">
                      <WeekStat value={String(Math.round(g.totalKm))} label={t.activities.weekStat.km} />
                      <WeekStat value={String(g.items.length)} label={t.activities.weekStat.runs} />
                      <WeekStat value={g.easyPct !== null ? `${g.easyPct}/${g.hardPct}` : '–'} label={t.activities.weekStat.easyHard} />
                    </div>
                  </div>
                ) : (
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
                    className="glass-card flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">{g.label}</div>
                      <div className="mt-0.5 text-caption text-subtle">
                        {t.activities.weekGroupCompact(g.items.length, Math.round(g.totalKm))}
                      </div>
                    </div>
                    <ChevronDown size={16} className={cn('shrink-0 text-subtle transition-transform', isExpanded && 'rotate-180')} />
                  </button>
                )}
                {isExpanded && (
                  <div className="mt-2 space-y-2">
                    {g.items.map((a) => (
                      <ActivityListCard key={a.id} activity={a} qualifiedEfforts={qualifiedEffortsByActivityId[a.id]} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <ActivityListCard key={a.id} activity={a} qualifiedEfforts={qualifiedEffortsByActivityId[a.id]} />
          ))}
        </div>
      )}

      {/* B6 - infinite scroll sentinel / end of list */}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-1" />}
      {!hasMore && items.length > 0 && (
        <p className="py-2 text-center text-xs text-subtle">{t.activities.endOfList}</p>
      )}
    </div>
  )
}
