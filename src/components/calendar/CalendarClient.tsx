'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import type { Activity } from '@/domain/activity/types'

interface Props {
  activities: Activity[]
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export function CalendarClient({ activities }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const byDate = useMemo(() => {
    const map = new Map<string, Activity[]>()
    for (const a of activities) {
      const list = map.get(a.date) ?? []
      list.push(a)
      map.set(a.date, list)
    }
    return map
  }, [activities])

  const { cells, totalKm, sessionCount } = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const startOffset = (firstDay.getDay() || 7) - 1
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const prefix = monthKey(year, month)

    const cells: Array<{ day: number; date: string; acts: Activity[] } | null> = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    let totalKm = 0
    let sessionCount = 0
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${prefix}-${String(day).padStart(2, '0')}`
      const acts = byDate.get(date) ?? []
      totalKm += acts.reduce((s, a) => s + a.distanceKm, 0)
      sessionCount += acts.length
      cells.push({ day, date, acts })
    }
    while (cells.length % 7 !== 0) cells.push(null)

    return { cells, totalKm: Math.round(totalKm * 10) / 10, sessionCount }
  }, [year, month, byDate])

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
  const todayIso = `${monthKey(now.getFullYear(), now.getMonth())}-${String(now.getDate()).padStart(2, '0')}`
  const monthLabel = new Date(year, month, 1).toLocaleString('en', {
    month: 'long',
    year: 'numeric',
  })

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shift(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-40 text-center text-sm font-semibold text-foreground">
            {monthLabel}
          </span>
          <button
            onClick={() => shift(1)}
            disabled={isCurrentMonth}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
          {!isCurrentMonth && (
            <button
              onClick={() => {
                setYear(now.getFullYear())
                setMonth(now.getMonth())
              }}
              className="rounded-md px-2 py-1 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
            >
              Today
            </button>
          )}
        </div>
        <p className="text-xs text-subtle">
          {sessionCount} session{sessionCount !== 1 ? 's' : ''} · {totalKm} km
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-1 py-2 text-center text-xs font-medium uppercase tracking-wide text-subtle"
            >
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d[0]}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => (
            <div
              key={i}
              className={`min-h-16 border-b border-r border-border/30 p-1 sm:min-h-24 sm:p-1.5 [&:nth-child(7n)]:border-r-0/60 ${
                cell ? '' : 'bg-muted/30'
              }`}
            >
              {cell && (
                <>
                  <p
                    className={`mb-1 text-right text-xs ${
                      cell.date === todayIso
                        ? 'font-bold text-emerald-600 dark:text-emerald-400'
                        : 'text-subtle'
                    }`}
                  >
                    {cell.day}
                  </p>
                  <div className="space-y-1">
                    {cell.acts.map((a) => (
                      <Link
                        key={a.id}
                        href={`/activities/${a.id}`}
                        className="block truncate rounded px-1.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-75"
                        style={{
                          backgroundColor: `${ACTIVITY_TYPE_CONFIG[a.type].chartColor}22`,
                          color: ACTIVITY_TYPE_CONFIG[a.type].chartColor,
                        }}
                        title={`${a.description || a.type} · ${a.distanceKm} km`}
                      >
                        {a.distanceKm.toFixed(1)} km
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-subtle">
        {Object.entries(ACTIVITY_TYPE_CONFIG).map(([type, cfg]) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: cfg.chartColor }} />
            {cfg.label}
          </span>
        ))}
      </div>
    </div>
  )
}
