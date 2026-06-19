'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { ActivityRow } from './ActivityRow'
import { ActivityTypeTag } from './ActivityTypeTag'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import type { Activity, ActivityType } from '@/domain/activity/types'
import { Card } from '@/components/ui/Card'
import { t } from '@/i18n'

const ALL_TYPES = Object.keys(ACTIVITY_TYPE_CONFIG) as ActivityType[]
const PAGE_SIZE = 10

interface Props {
  activities: Activity[]
}

export function ActivityListClient({ activities }: Props) {
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [minKm, setMinKm] = useState('')
  const [maxKm, setMaxKm] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const min = parseFloat(minKm)
    const max = parseFloat(maxKm)
    return activities
      .filter((a) => !selectedType || a.type === selectedType)
      .filter((a) => !dateFrom || a.date >= dateFrom)
      .filter((a) => !dateTo || a.date <= dateTo)
      .filter((a) => Number.isNaN(min) || a.distanceKm >= min)
      .filter((a) => Number.isNaN(max) || a.distanceKm <= max)
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
  }, [activities, selectedType, search, dateFrom, dateTo, minKm, maxKm])

  const hasExtraFilters = dateFrom || dateTo || minKm || maxKm

  function clearFilters() {
    setDateFrom('')
    setDateTo('')
    setMinKm('')
    setMaxKm('')
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const clampedPage = Math.min(page, Math.max(1, totalPages))
  const paginated = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE)

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
            className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-3 text-sm text-foreground placeholder-subtle focus:border-emerald-500 focus:outline-none sm:w-auto"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedType(null)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              selectedType === null
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
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
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-8 w-28 rounded-md border border-border bg-card px-2 text-xs text-foreground focus:border-emerald-500 focus:outline-none dark:[color-scheme:dark]"
        />
        <span className="text-xs text-subtle">→</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-8 w-28 rounded-md border border-border bg-card px-2 text-xs text-foreground focus:border-emerald-500 focus:outline-none dark:[color-scheme:dark]"
        />
        <span className="flex items-center gap-2">
          <span className="text-xs text-subtle">{t.activities.distance}</span>
          <input
            type="number"
            min="0"
            step="1"
            placeholder={t.activities.min}
            value={minKm}
            onChange={(e) => setMinKm(e.target.value)}
            className="h-8 w-16 rounded-md border border-border bg-card px-2 text-xs text-foreground placeholder-subtle focus:border-emerald-500 focus:outline-none"
          />
          <span className="text-xs text-subtle">–</span>
          <input
            type="number"
            min="0"
            step="1"
            placeholder={t.activities.max}
            value={maxKm}
            onChange={(e) => setMaxKm(e.target.value)}
            className="h-8 w-16 rounded-md border border-border bg-card px-2 text-xs text-foreground placeholder-subtle focus:border-emerald-500 focus:outline-none"
          />
          <span className="text-xs text-subtle">{t.units.km}</span>
        </span>
        {hasExtraFilters && (
          <button
            onClick={clearFilters}
            className="ml-1 flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={12} />
            {t.activities.clear}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-subtle">
          {t.activities.count(filtered.length)}
          {totalPages > 1 && t.activities.page(clampedPage, totalPages)}
        </p>
      </div>

      <div className="space-y-2">
        {paginated.length === 0 ? (
          <Card dashed accent="emerald" padding="none" className="py-12 text-center">
            <p className="text-sm text-subtle">{t.activities.empty}</p>
          </Card>
        ) : (
          paginated.map((a) => <ActivityRow key={a.id} activity={a} />)
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={clampedPage === 1}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-all duration-150 hover:bg-muted active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={14} />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - clampedPage) <= 2)
            .reduce<(number | '…')[]>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…')
              acc.push(p)
              return acc
            }, [])
            .map((p, i) =>
              p === '…' ? (
                <span key={`ellipsis-${i}`} className="px-1 text-xs text-subtle">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={`h-8 min-w-[2rem] rounded-md px-2 text-sm font-medium transition-colors ${
                    clampedPage === p
                      ? 'bg-emerald-500 text-white'
                      : 'border border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {p}
                </button>
              )
            )}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={clampedPage === totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-all duration-150 hover:bg-muted active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
