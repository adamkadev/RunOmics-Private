'use client'

import { useState } from 'react'
import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Must be statically present for Tailwind to include these classes
const LEVEL_CLASSES = [
  'bg-muted',
  'bg-emerald-100 dark:bg-emerald-950',
  'bg-emerald-200 dark:bg-emerald-800',
  'bg-emerald-300 dark:bg-emerald-600',
  'bg-emerald-400 dark:bg-emerald-500',
  'bg-emerald-500 dark:bg-emerald-400',
] as const

function getLevel(km: number): number {
  if (km === 0) return 0
  if (km < 5)  return 1
  if (km < 10) return 2
  if (km < 15) return 3
  if (km < 20) return 4
  return 5
}

function formatTooltipDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

interface Props {
  days: HeatmapDay[]
}

export function ActivityHeatmap({ days }: Props) {
  const [tooltip, setTooltip] = useState<{ day: HeatmapDay; x: number; y: number } | null>(null)

  // Group into weeks (Mon–Sun columns)
  const weeks: HeatmapDay[][] = []
  for (let i = 0; i < days.length; i += 7) {
    const week = days.slice(i, i + 7)
    // Pad last week to 7 days
    while (week.length < 7) week.push({ date: '', distanceKm: 0, sessionCount: 0 })
    weeks.push(week)
  }

  // Month labels: show label at the first week where a new month starts
  const monthLabels: { label: string; col: number }[] = []
  let lastMonth = -1
  weeks.forEach((wk, col) => {
    const firstDate = wk.find(d => d.date)?.date
    if (!firstDate) return
    const month = new Date(firstDate + 'T12:00:00').getMonth()
    if (month !== lastMonth) {
      monthLabels.push({ label: MONTHS[month], col })
      lastMonth = month
    }
  })

  const totalKm = days.reduce((s, d) => s + d.distanceKm, 0)
  const activeDays = days.filter(d => d.distanceKm > 0).length

  const CELL = 11  // px per cell
  const GAP  = 3   // px gap

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">
          Activity <span className="font-normal text-subtle">· 12 months</span>
        </h3>
        <span className="text-xs text-subtle">
          <span className="font-semibold text-foreground">{activeDays}</span> days ·{' '}
          <span className="font-semibold text-foreground">{Math.round(totalKm)}</span> km
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="relative inline-block min-w-full">
          {/* Month labels */}
          <div className="relative mb-1 h-3" style={{ paddingLeft: 26 }}>
            {monthLabels.map(({ label, col }) => (
              <span
                key={`${label}-${col}`}
                className="absolute text-[10px] text-subtle"
                style={{ left: 26 + col * (CELL + GAP) }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Day labels + grid */}
          <div className="flex" style={{ gap: GAP }}>
            {/* Mon / Wed / Fri labels */}
            <div className="flex flex-col" style={{ gap: GAP, marginRight: 2 }}>
              {['Mon', '', 'Wed', '', 'Fri', '', ''].map((label, i) => (
                <div
                  key={i}
                  className="text-right text-[9px] leading-none text-subtle"
                  style={{ height: CELL, lineHeight: `${CELL}px`, width: 20 }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Week columns */}
            {weeks.map((wk, col) => (
              <div key={col} className="flex flex-col" style={{ gap: GAP }}>
                {wk.map((day, row) =>
                  !day.date ? (
                    <div key={row} style={{ width: CELL, height: CELL }} />
                  ) : (
                    <div
                      key={row}
                      className={`rounded-[2px] transition-opacity hover:opacity-70 ${LEVEL_CLASSES[getLevel(day.distanceKm)]}`}
                      style={{ width: CELL, height: CELL, cursor: 'default' }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setTooltip({ day, x: rect.left + rect.width / 2, y: rect.top })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-end gap-1.5">
        <span className="text-[10px] text-subtle">Less</span>
        {LEVEL_CLASSES.map((cls, i) => (
          <div key={i} className={`rounded-[2px] ${cls}`} style={{ width: 10, height: 10 }} />
        ))}
        <span className="text-[10px] text-subtle">More</span>
      </div>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-md"
          style={{ left: tooltip.x, top: tooltip.y - 6 }}
        >
          <p className="text-xs font-medium text-foreground">{formatTooltipDate(tooltip.day.date)}</p>
          <p className="text-[11px] text-subtle">
            {tooltip.day.distanceKm > 0
              ? `${tooltip.day.distanceKm} km · ${tooltip.day.sessionCount} run${tooltip.day.sessionCount > 1 ? 's' : ''}`
              : 'Rest day'}
          </p>
        </div>
      )}
    </div>
  )
}
