'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, GitCompare, X } from 'lucide-react'
import { ActivityRow } from './ActivityRow'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import type { Activity, ActivityType } from '@/domain/activity/types'
import { Card } from '@/components/ui/Card'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Pill } from '@/components/ui/Pill'
import { SortDropdown, type SortOrder } from '@/components/ui/SortDropdown'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const ALL_TYPES = Object.keys(ACTIVITY_TYPE_CONFIG) as ActivityType[]
const PAGE_SIZE = 12

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

interface Props {
  activities: Activity[]
  prLabelsByActivityId?: Record<string, string[]>
}

export function ActivityListClient({ activities, prLabelsByActivityId = {} }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [compareMode, setCompareMode] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])

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
    setVisibleCount(PAGE_SIZE)
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

  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!hasMore) return
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, sorted.length))
        }
      },
      { rootMargin: '400px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, sorted.length])

  return (
    <div className="space-y-4">
      <GlassSurface
        variant="card"
        className="sticky top-2 z-20 space-y-3 rounded-2xl p-3 lg:top-3"
      >
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
            <input
              type="text"
              placeholder={t.activities.searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                resetWindow()
              }}
              className="h-9 w-full rounded-xl border border-border bg-card/60 pl-9 pr-3 text-sm text-foreground placeholder-subtle focus:border-accent focus:outline-none"
            />
          </div>
          <button
            onClick={() => (compareMode ? exitCompareMode() : setCompareMode(true))}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors',
              compareMode
                ? 'bg-accent-subtle text-accent-text'
                : 'border border-border bg-card/60 text-muted-foreground hover:bg-muted'
            )}
          >
            {compareMode ? <X size={13} /> : <GitCompare size={13} />}
            <span className="hidden sm:inline">{compareMode ? t.activities.compareCancel : t.activities.compareMode}</span>
          </button>
        </div>

        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Pill
            as="button"
            variant={selectedType === null ? 'active' : 'neutral'}
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
                variant="neutral"
                dotColor={ACTIVITY_TYPE_CONFIG[type].dotColor}
                onClick={() => {
                  setSelectedType(active ? null : type)
                  resetWindow()
                }}
                className={active ? 'border-accent/40 bg-accent-subtle text-accent-text' : undefined}
              >
                {t.activityTypes[type]}
              </Pill>
            )
          })}
        </div>
      </GlassSurface>

      <div className="flex items-center justify-between">
        <p className="text-xs text-subtle">{t.activities.count(sorted.length)}</p>
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

      <div className="space-y-2">
        {visible.length === 0 ? (
          <Card dashed padding="none" className="py-12 text-center">
            <p className="text-sm text-subtle">{t.activities.empty}</p>
          </Card>
        ) : (
          visible.map((a) => (
            <ActivityRow
              key={a.id}
              activity={a}
              prLabels={prLabelsByActivityId[a.id]}
              selectable={compareMode}
              selected={compareIds.includes(a.id)}
              selectionDisabled={compareMode && compareIds.length >= 2 && !compareIds.includes(a.id)}
              onToggleSelect={() => toggleCompareSelection(a.id)}
            />
          ))
        )}
      </div>

      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-1" />}

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
