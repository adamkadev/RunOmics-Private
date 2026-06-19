'use client'

import { useState, useRef, useEffect } from 'react'
import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'
import { Card } from '@/components/ui/Card'
import { t } from '@/i18n'

const MONTHS = t.dashboard.heatmap.months
const GAP = 3
const LABEL_W = 26 // matches paddingLeft of month labels row

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
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(t.locale, {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

interface Props {
  days: HeatmapDay[]
}

export function ActivityHeatmap({ days }: Props) {
  const [tooltip, setTooltip] = useState<{ day: HeatmapDay; x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [cellSize, setCellSize] = useState(11)

  // Group into weeks (Mon-Sun columns)
  const weeks: HeatmapDay[][] = []
  for (let i = 0; i < days.length; i += 7) {
    const week = days.slice(i, i + 7)
    while (week.length < 7) week.push({ date: '', distanceKm: 0, sessionCount: 0 })
    weeks.push(week)
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const compute = () => {
      const w = el.clientWidth
      const size = Math.floor((w - LABEL_W - (weeks.length - 1) * GAP) / weeks.length)
      setCellSize(Math.max(11, Math.min(16, size)))
    }
    compute()
    const obs = new ResizeObserver(compute)
    obs.observe(el)
    return () => obs.disconnect()
  }, [weeks.length])

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

  return (
    <Card accent="emerald" padding="lg">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">
          {t.dashboard.heatmap.title} <span className="font-normal text-subtle">{t.dashboard.heatmap.window}</span>
        </h3>
        <span className="text-xs text-subtle">
          <span className="font-semibold text-foreground">{activeDays}</span> {t.dashboard.heatmap.days} ·{' '}
          <span className="font-semibold text-foreground">{Math.round(totalKm)}</span> {t.units.km}
        </span>
      </div>

      <div ref={containerRef} className="w-full overflow-x-auto">
        <div style={{ minWidth: 'max-content' }}>
          {/* Month labels */}
          <div className="relative mb-1 h-3" style={{ paddingLeft: LABEL_W }}>
            {monthLabels.map(({ label, col }) => (
              <span
                key={`${label}-${col}`}
                className="absolute text-[10px] text-subtle"
                style={{ left: LABEL_W + col * (cellSize + GAP) }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Day labels + grid */}
          <div className="flex" style={{ gap: GAP }}>
            {/* Mon / Wed / Fri labels */}
            <div className="flex flex-col" style={{ gap: GAP, marginRight: 2 }}>
              {t.dashboard.heatmap.weekdays.map((label, i) => (
                <div
                  key={i}
                  className="text-right text-[9px] leading-none text-subtle"
                  style={{ height: cellSize, lineHeight: `${cellSize}px`, width: 20 }}
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
                    <div key={row} style={{ width: cellSize, height: cellSize }} />
                  ) : (
                    <div
                      key={row}
                      className={`rounded-[2px] transition-opacity hover:opacity-70 ${LEVEL_CLASSES[getLevel(day.distanceKm)]}`}
                      style={{ width: cellSize, height: cellSize, cursor: 'default' }}
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
        <span className="text-[10px] text-subtle">{t.dashboard.heatmap.less}</span>
        {LEVEL_CLASSES.map((cls, i) => (
          <div key={i} className={`rounded-[2px] ${cls}`} style={{ width: 10, height: 10 }} />
        ))}
        <span className="text-[10px] text-subtle">{t.dashboard.heatmap.more}</span>
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
              ? t.dashboard.heatmap.day(tooltip.day.distanceKm, tooltip.day.sessionCount)
              : t.dashboard.heatmap.restDay}
          </p>
        </div>
      )}
    </Card>
  )
}
