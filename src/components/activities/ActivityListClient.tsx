'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Search, X, SearchX, Map } from 'lucide-react'
import { ActivityListCard } from './ActivityListCard'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import type { ActivitySummary, ActivityType } from '@/domain/activity/types'
import type { ActivityQueryResult, ActivitySortKey, ActivitySortOrder } from '@/application/usecases/QueryActivities'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Pill } from '@/components/ui/Pill'
import { SortDropdown } from '@/components/ui/SortDropdown'
import { monthYearLabel } from '@/lib/formatters'
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

interface MonthGroup {
  key: string
  label: string
  items: ActivitySummary[]
  totalKm: number
}

// Groups are built from an already date-sorted list, so same-month items are
// always contiguous - a single linear pass is enough (B3).
function groupByMonth(items: ActivitySummary[]): MonthGroup[] {
  const groups: MonthGroup[] = []
  for (const a of items) {
    const key = a.date.slice(0, 7)
    const last = groups[groups.length - 1]
    if (last && last.key === key) {
      last.items.push(a)
      last.totalKm += a.distanceKm
    } else {
      groups.push({ key, label: monthYearLabel(a.date), items: [a], totalKm: a.distanceKm })
    }
  }
  return groups
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
  prLabelsByActivityId?: Record<string, string[]>
}

export function ActivityListClient({
  initialItems,
  initialNextOffset,
  totalCount,
  prLabelsByActivityId = {},
}: Props) {
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null)
  const [sortBy, setSortBy] = useState<ActivitySortKey>('date')
  const [sortOrder, setSortOrder] = useState<ActivitySortOrder>('desc')

  const [items, setItems] = useState(initialItems)
  const [nextOffset, setNextOffset] = useState(initialNextOffset)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isPending, setIsPending] = useState(false)

  // Debounce the search box before it hits the query (server round-trip).
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [search])

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
    fetchActivities({ type: selectedType, search: debouncedSearch, sortBy, sortOrder, offset: 0 }).then((result) => {
      if (seq !== requestSeq.current) return
      setIsPending(false)
      setItems(result.items)
      setNextOffset(result.nextOffset)
    })
  }, [selectedType, debouncedSearch, sortBy, sortOrder])

  const hasMore = nextOffset !== null
  const hasActiveFilter = selectedType !== null || search.trim() !== ''
  // Month separators only make sense when browsing in chronological order.
  const groups = sortBy === 'date' ? groupByMonth(items) : null

  const loadMore = useCallback(() => {
    if (nextOffset === null || loadingMore) return
    setLoadingMore(true)
    const seq = requestSeq.current
    fetchActivities({ type: selectedType, search: debouncedSearch, sortBy, sortOrder, offset: nextOffset }).then(
      (result) => {
        setLoadingMore(false)
        if (seq !== requestSeq.current) return
        setItems((prev) => [...prev, ...result.items])
        setNextOffset(result.nextOffset)
      }
    )
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
      <GlassSurface as="div" variant="card" className="rounded-2xl px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-title1 font-extrabold leading-[1.1] tracking-tight text-foreground">
              {t.pages.activities.title}
            </h1>
            <p className="mt-0.5 text-footnote font-medium text-muted-foreground">
              {t.activities.count(totalCount)}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setSearchOpen((open) => {
                if (open) setSearch('')
                return !open
              })
            }
            aria-label={t.activities.searchToggle}
            aria-expanded={searchOpen}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-control border transition-colors active:scale-95',
              searchOpen
                ? 'border-foreground/[0.20] bg-foreground/[0.14] text-foreground'
                : 'border-foreground/[0.12] bg-foreground/[0.06] text-foreground/60 hover:bg-foreground/[0.10]'
            )}
          >
            {searchOpen ? <X size={16} /> : <Search size={16} />}
          </button>
        </div>

        {searchOpen && (
          <input
            autoFocus
            type="text"
            placeholder={t.activities.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-3 h-9 w-full rounded-xl border border-border bg-card/60 px-3 text-sm text-foreground placeholder-subtle focus:border-accent focus:outline-none"
          />
        )}
      </GlassSurface>

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
              dotColor={active ? undefined : ACTIVITY_TYPE_CONFIG[type].dotColor}
              className={cn('text-footnote font-semibold', active && ACTIVE_CHIP_SHADOW)}
              onClick={() => setSelectedType(active ? null : type)}
            >
              {t.activityTypes[type]}
            </Pill>
          )
        })}
      </div>

      {/* Secondary controls: sort - not in the visual spec, kept from the existing feature set */}
      <div className="flex items-center justify-end gap-2">
        <Link
          href="/map"
          className="flex items-center gap-1 rounded-control border border-foreground/[0.12] bg-foreground/[0.06] px-2.5 py-1 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/[0.10]"
        >
          <Map size={12} />
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
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="flex items-center justify-between px-1 py-2">
                <span className="font-mono text-footnote font-bold tracking-wide text-muted-foreground/80">
                  {g.label}
                </span>
                <span className="font-mono text-xs font-medium text-subtle">
                  {t.activities.monthGroup(g.items.length, Math.round(g.totalKm))}
                </span>
              </div>
              <div className="space-y-2">
                {g.items.map((a) => (
                  <ActivityListCard key={a.id} activity={a} prLabels={prLabelsByActivityId[a.id]} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <ActivityListCard key={a.id} activity={a} prLabels={prLabelsByActivityId[a.id]} />
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
