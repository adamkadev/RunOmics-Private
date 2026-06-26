'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import type { Activity, ActivityType, PlannedWorkout } from '@/domain/activity/types'
import { round } from '@/lib/math'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

interface Props {
  year: number
  month: number
  byDate: Map<string, Activity[]>
  byDatePlanned: Map<string, PlannedWorkout>
  today: string
}

const WEEKDAYS = t.calendar.weekdays

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export function MonthView({ year, month, byDate, byDatePlanned, today }: Props) {
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

    return { cells, totalKm: round(totalKm), sessionCount }
  }, [year, month, byDate])

  return (
    <div className="space-y-3">
      <GlassSurface variant="card" className="overflow-hidden rounded-card-sm">
        <div className="grid grid-cols-7 border-b border-foreground/[0.08]">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-1 py-2 text-center font-mono text-micro font-semibold uppercase tracking-wide text-muted-foreground/60"
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
              className={`min-h-16 border-b border-r border-foreground/[0.06] p-1 sm:min-h-24 sm:p-1.5 [&:nth-child(7n)]:border-r-0 ${
                cell ? '' : 'bg-foreground/[0.02]'
              }`}
            >
              {cell && (
                <>
                  <p
                    className={`mb-1 text-xs ${
                      cell.date === today ? 'font-bold text-accent-text' : 'text-subtle'
                    }`}
                  >
                    {cell.day}
                  </p>
                  <div className="space-y-1">
                    {cell.acts.map((a) => (
                      <Link
                        key={a.id}
                        href={`/activities/${a.id}`}
                        className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-foreground/[0.08]"
                        title={`${a.description || a.type} · ${a.distanceKm} ${t.units.km}`}
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: ACTIVITY_TYPE_CONFIG[a.type].dotColor }}
                          aria-hidden="true"
                        />
                        <span className="tabular-nums">
                          {a.distanceKm.toFixed(1)}
                          <span className="ml-0.5 text-micro font-normal text-muted-foreground">
                            {t.units.km}
                          </span>
                        </span>
                      </Link>
                    ))}
                    {cell.acts.length === 0 && byDatePlanned.has(cell.date) && (
                      <p
                        className="truncate px-1 py-0.5 text-micro italic text-accent-text/60"
                        title={byDatePlanned.get(cell.date)?.name}
                      >
                        {byDatePlanned.get(cell.date)?.name}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </GlassSurface>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-subtle">
        <div className="flex flex-wrap items-center gap-3">
          {Object.entries(ACTIVITY_TYPE_CONFIG).map(([type, cfg]) => (
            <span key={type} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: cfg.dotColor }} />
              {t.activityTypes[type as ActivityType]}
            </span>
          ))}
        </div>
        <p className="font-mono">{t.calendar.summary(sessionCount, totalKm)}</p>
      </div>
    </div>
  )
}
