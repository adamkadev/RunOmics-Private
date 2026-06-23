'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, GitCompare, SearchX } from 'lucide-react'
import { ActivityRow } from './ActivityRow'
import { ActivityListCard } from './ActivityListCard'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import type { Activity, ActivityType } from '@/domain/activity/types'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Pill } from '@/components/ui/Pill'
import { SortDropdown, type SortOrder } from '@/components/ui/SortDropdown'
import { monthYearLabel } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const ALL_TYPES = Object.keys(ACTIVITY_TYPE_CONFIG) as ActivityType[]
const BATCH_SIZE = 20
const ACTIVE_CHIP_SHADOW = 'shadow-[0_4px_12px_-4px_rgba(14,159,110,0.5)]'

type SortKey = 'date' | 'distance' | 'duration' | 'pace' | 'avgHr'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'date', label: t.activities.sort.date },
  { value: 'distance', label: t.activities.sort.distance },
  { value: 'duration', label: t.activities.sort.duration },
  { value: 'pace', label: t.activities.sort.pace },
  { value: 'avgHr', label: t.activities.sort.avgHr },
]

function sortValue(activity: Activity, key: SortKey): number {
  switch (key) {
    case 'date':
      return new Date(activity.date).getTime()
    case 'distance':
      return activity.distanceKm
    case 'duration':
      return activity.durationSeconds
    case 'pace':
      return activity.paceSecPerKm ?? Infinity
    case 'avgHr':
      return activity.avgHeartRate ?? -Infinity
  }
}

interface MonthGroup {
  key: string
  label: string
  items: Activity[]
  totalKm: number
}

// Groups are built from an already date-sorted list, so same-month items are
// always contiguous - a single linear pass is enough (B3).
function groupByMonth(items: Activity[]): MonthGroup[] {
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

interface Props {
  activities: Activity[]
  prLabelsByActivityId?: Record<string, string[]>
}

export function ActivityListClient({ activities, prLabelsByActivityId = {} }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)
  const [compareMode, setCompareMode] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])

  // B3 separators stick right under the B1 header - measure it so the offset
  // tracks its real height (search row open/closed, responsive font sizes).
  const headerRef = useRef<HTMLElement>(null)
  const [headerHeight, setHeaderHeight] = useState(72)

  useEffect(() => {
    const node = headerRef.current
    if (!node) return
    const update = () => setHeaderHeight(node.getBoundingClientRect().height)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  function exitCompareMode() {
    setCompareMode(false)
    setCompareIds([])
  }

  function toggleCompareSelection(id: string) {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 2 ? [...prev, id] : prev
    )
  }

  // Reset the infinite-scroll window whenever the result set changes.
  function resetWindow() {
    setVisibleCount(BATCH_SIZE)
  }

  function resetFilters() {
    setSelectedType(null)
    setSearch('')
    resetWindow()
  }

  const filtered = useMemo(() => {
    return activities
      .filter((a) => !selectedType || a.type === selectedType)
      .filter((a) => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return (
          a.description.toLowerCase().includes(q) ||
          a.comment.toLowerCase().includes(q) ||
          a.dayOfWeek.toLowerCase().includes(q) ||
          a.date.includes(q)
        )
      })
  }, [activities, selectedType, search])

  const sorted = useMemo(() => {
    const direction = sortOrder === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => direction * (sortValue(a, sortBy) - sortValue(b, sortBy)))
  }, [filtered, sortBy, sortOrder])

  const visible = sorted.slice(0, visibleCount)
  const hasMore = visibleCount < sorted.length
  const hasActiveFilter = selectedType !== null || search.trim() !== ''
  // Month separators only make sense when browsing in chronological order.
  const groups = sortBy === 'date' ? groupByMonth(visible) : null

  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!hasMore) return
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(c + BATCH_SIZE, sorted.length))
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, sorted.length])

  return (
    <div className="space-y-4">
      {/* B1 - header glass sticky */}
      <GlassSurface as="header" variant="nav" ref={headerRef} className="sticky top-2 z-20 rounded-2xl px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[27px] font-extrabold leading-[1.1] tracking-tight text-foreground">
              {t.pages.activities.title}
            </h1>
            <p className="mt-0.5 text-[13px] font-medium text-muted-foreground">
              {t.activities.count(activities.length)}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setSearchOpen((open) => {
                if (open) {
                  setSearch('')
                  resetWindow()
                }
                return !open
              })
            }
            aria-label={t.activities.searchToggle}
            aria-expanded={searchOpen}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border transition-colors active:scale-95',
              searchOpen
                ? 'border-accent/40 bg-accent-subtle text-accent-text'
                : 'border-foreground/[0.12] bg-foreground/[0.08] text-foreground/65 hover:bg-foreground/[0.12]'
            )}
          >
            {searchOpen ? <X size={18} /> : <Search size={18} />}
          </button>
        </div>

        {searchOpen && (
          <input
            autoFocus
            type="text"
            placeholder={t.activities.searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              resetWindow()
            }}
            className="mt-3 h-9 w-full rounded-xl border border-border bg-card/60 px-3 text-sm text-foreground placeholder-subtle focus:border-accent focus:outline-none"
          />
        )}
      </GlassSurface>

      {/* B2 - filter chips, single scrollable row (never sticky, never wraps) */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Pill
          as="button"
          variant={selectedType === null ? 'active' : 'neutral'}
          className={cn('text-[13px] font-semibold', selectedType === null && ACTIVE_CHIP_SHADOW)}
          onClick={() => {
            setSelectedType(null)
            resetWindow()
          }}
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
              className={cn('text-[13px] font-semibold', active && ACTIVE_CHIP_SHADOW)}
              onClick={() => {
                setSelectedType(active ? null : type)
                resetWindow()
              }}
            >
              {t.activityTypes[type]}
            </Pill>
          )
        })}
      </div>

      {/* Secondary controls: result count, compare mode, sort - not in the visual spec, kept from the existing feature set */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-subtle">{t.activities.count(sorted.length)}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => (compareMode ? exitCompareMode() : setCompareMode(true))}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
              compareMode
                ? 'bg-accent-subtle text-accent-text'
                : 'border border-border bg-card/60 text-muted-foreground hover:bg-muted'
            )}
          >
            {compareMode ? <X size={13} /> : <GitCompare size={13} />}
            <span className="hidden sm:inline">
              {compareMode ? t.activities.compareCancel : t.activities.compareMode}
            </span>
          </button>
          <SortDropdown
            options={SORT_OPTIONS}
            sortBy={sortBy}
            order={sortOrder}
            onChange={(value, order) => {
              setSortBy(value)
              setSortOrder(order)
              resetWindow()
            }}
            label={t.activities.sort.label}
          />
        </div>
      </div>

      {/* B3 + B4 - sticky month separators + activity cards, or C1 empty state */}
      {sorted.length === 0 ? (
        <GlassSurface variant="card" className="rounded-2xl py-12 text-center">
          <SearchX size={28} className="mx-auto text-subtle" />
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
      ) : compareMode ? (
        <div className="space-y-2">
          {visible.map((a) => (
            <ActivityRow
              key={a.id}
              activity={a}
              prLabels={prLabelsByActivityId[a.id]}
              selectable
              selected={compareIds.includes(a.id)}
              selectionDisabled={compareIds.length >= 2 && !compareIds.includes(a.id)}
              onToggleSelect={() => toggleCompareSelection(a.id)}
            />
          ))}
        </div>
      ) : groups ? (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="sticky z-10 flex items-center justify-between px-1 py-2" style={{ top: headerHeight + 16 }}>
                <span className="font-mono text-[13px] font-bold tracking-wide text-muted-foreground/80">
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
          {visible.map((a) => (
            <ActivityListCard key={a.id} activity={a} prLabels={prLabelsByActivityId[a.id]} />
          ))}
        </div>
      )}

      {/* B6 - infinite scroll sentinel / end of list */}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-1" />}
      {!hasMore && sorted.length > 0 && !compareMode && (
        <p className="py-2 text-center text-xs text-subtle">{t.activities.endOfList}</p>
      )}

      {compareMode && (
        <div className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg lg:bottom-4">
          <span className="text-xs font-medium text-muted-foreground">
            {t.activities.compareCount(compareIds.length)}
          </span>
          <button
            disabled={compareIds.length !== 2}
            onClick={() => router.push(`/activities/compare?ids=${compareIds.join(',')}`)}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition-opacity disabled:opacity-40"
          >
            {t.activities.compareCta}
          </button>
        </div>
      )}
    </div>
  )
}
