'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, GitCompare, X } from 'lucide-react'
import { ActivityRow } from './ActivityRow'
import { ActivityTypeTag } from './ActivityTypeTag'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import type { Activity, ActivityType } from '@/domain/activity/types'
import { Card } from '@/components/ui/Card'
import { Pagination } from '@/components/ui/Pagination'
import { SortDropdown, type SortOrder } from '@/components/ui/SortDropdown'
import { t } from '@/i18n'

const ALL_TYPES = Object.keys(ACTIVITY_TYPE_CONFIG) as ActivityType[]
const PAGE_SIZE = 10

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
  const [page, setPage] = useState(1)
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

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const clampedPage = Math.min(page, Math.max(1, totalPages))
  const paginated = sorted.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input
            type="text"
            placeholder={t.activities.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-3 text-sm text-foreground placeholder-subtle focus:border-accent focus:outline-none sm:w-auto"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedType(null)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              selectedType === null
                ? 'bg-accent-subtle text-accent-text'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {t.activities.all}
          </button>
          {ALL_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(selectedType === type ? null : type)}
              className="transition-opacity"
              style={{ opacity: selectedType && selectedType !== type ? 0.5 : 1 }}
            >
              <ActivityTypeTag type={type} />
            </button>
          ))}
        </div>
        <button
          onClick={() => (compareMode ? exitCompareMode() : setCompareMode(true))}
          className={`ml-auto inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            compareMode
              ? 'bg-accent-subtle text-accent-text'
              : 'bg-muted text-muted-foreground hover:bg-muted/70'
          }`}
        >
          {compareMode ? <X size={13} /> : <GitCompare size={13} />}
          {compareMode ? t.activities.compareCancel : t.activities.compareMode}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-subtle">
          {t.activities.count(sorted.length)}
          {totalPages > 1 && t.activities.page(clampedPage, totalPages)}
        </p>
        <SortDropdown
          options={SORT_OPTIONS}
          sortBy={sortBy}
          order={sortOrder}
          onChange={(value, order) => {
            setSortBy(value)
            setSortOrder(order)
            setPage(1)
          }}
          label={t.activities.sort.label}
        />
      </div>

      <div className="space-y-2">
        {paginated.length === 0 ? (
          <Card dashed padding="none" className="py-12 text-center">
            <p className="text-sm text-subtle">{t.activities.empty}</p>
          </Card>
        ) : (
          paginated.map((a) => (
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

      <Pagination page={clampedPage} totalPages={totalPages} onChange={setPage} />

      {compareMode && (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
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
