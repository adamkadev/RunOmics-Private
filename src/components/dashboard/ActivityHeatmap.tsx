'use client'

import { useState, useRef, useEffect } from 'react'
import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'
import { tooltipSurfaceClass } from '@/components/ui/Card'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDate, formatDateRange, monthName } from '@/lib/formatters'
import { positionMonthLabels, type MonthStart } from '@/lib/heatmapMonths'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const MONTHS = Array.from({ length: 12 }, (_, month) => monthName(month + 1))

const GRID_GAP = 2
const MIN_CELL_PX = 3

const EMPTY_CELL_COLOR = 'rgba(148,178,220,.09)'
const LEVEL_COLORS = ['rgba(90,151,245,.35)', 'rgba(90,151,245,.62)', '#5a97f5']

function levelStyle(level: number) {
  return { backgroundColor: level === 0 ? EMPTY_CELL_COLOR : LEVEL_COLORS[level - 1] }
}

function getLevel(km: number): number {
  if (km === 0) return 0
  if (km < 8)  return 1
  if (km < 16) return 2
  return 3
}

// The window is a rolling 364 days, so a tooltip on the far end of the strip
// falls in last year - hence the date, not a bare `Sep 13`.
function formatTooltipDate(dateStr: string) {
  return formatDate(dateStr)
}

interface Props {
  days: HeatmapDay[]
}

export function ActivityHeatmap({ days }: Props) {
  const [tooltip, setTooltip] = useState<{ day: HeatmapDay; x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Purely for the month-label overlay's pixel math - the grid itself is laid
  // out in CSS (flex + aspect-ratio) and never waits on this measurement, so a
  // stale or zero reading can only misplace a label, never break the grid.
  const [measuredCellSize, setMeasuredCellSize] = useState(11)

  const weeks: HeatmapDay[][] = []
  for (let i = 0; i < days.length; i += 7) {
    const week = days.slice(i, i + 7)
    while (week.length < 7) week.push({ date: '', distanceKm: 0, sessionCount: 0 })
    weeks.push(week)
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const raf = requestAnimationFrame(() => { el.scrollLeft = el.scrollWidth })
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const compute = () => {
      const w = el.clientWidth
      setMeasuredCellSize(Math.max(MIN_CELL_PX, Math.floor((w - (weeks.length - 1) * GRID_GAP) / weeks.length)))
    }
    compute()
    const obs = new ResizeObserver(compute)
    obs.observe(el)
    return () => obs.disconnect()
  }, [weeks.length])

  const monthStarts: MonthStart[] = []
  let lastMonth = -1
  weeks.forEach((wk, col) => {
    const firstDate = wk.find(d => d.date)?.date
    if (!firstDate) return
    const month = new Date(firstDate + 'T12:00:00').getMonth()
    if (month !== lastMonth) {
      monthStarts.push({ label: MONTHS[month] ?? '', col })
      lastMonth = month
    }
  })

  const shownMonthLabels = positionMonthLabels(monthStarts, weeks.length, measuredCellSize, GRID_GAP)
  const gridWidth = Math.max(0, weeks.length * (measuredCellSize + GRID_GAP) - GRID_GAP)
  const minGridWidth = weeks.length * MIN_CELL_PX + (weeks.length - 1) * GRID_GAP

  const dated = days.filter(d => d.date)
  const opensOn = dated[0]?.date
  const closesOn = dated[dated.length - 1]?.date
  const windowRange = opensOn && closesOn ? formatDateRange(opensOn, closesOn, { precision: 'month' }) : null

  const activeDays = days.filter(d => d.distanceKm > 0).length

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground">{t.dashboard.heatmap.title}</h3>
          <p className="mt-0.5 text-caption text-subtle">
            {windowRange ? `${windowRange} · ` : ''}
            {t.dashboard.heatmap.rollingWindow}
          </p>
        </div>
        <span className="shrink-0 text-sm">
          <span className="font-semibold text-foreground">{activeDays}</span>{' '}
          <span className="font-medium text-muted-foreground">{t.dashboard.heatmap.activeDaysUnit}</span>
        </span>
      </div>

      <div ref={containerRef} className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div style={{ minWidth: minGridWidth }}>
          <div className="flex" style={{ gap: GRID_GAP }}>
            {weeks.map((wk, col) => (
              <div key={col} className="flex min-w-0 flex-1 flex-col" style={{ gap: GRID_GAP }}>
                {wk.map((day, row) =>
                  !day.date ? (
                    <div key={row} style={{ aspectRatio: '1' }} />
                  ) : (
                    <div
                      key={row}
                      className="transition-opacity hover:opacity-70"
                      style={{
                        aspectRatio: '1',
                        borderRadius: 1.5,
                        cursor: 'default',
                        ...levelStyle(getLevel(day.distanceKm)),
                      }}
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

          <div
            className="relative mt-2 h-4 leading-4 text-caption text-subtle"
            style={{ width: gridWidth }}
          >
            {shownMonthLabels.map(({ label, col, left }) => (
              <span key={col} className="absolute top-0 whitespace-nowrap" style={{ left }}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-end gap-1.5">
        <span className="text-caption text-subtle">{t.dashboard.heatmap.less}</span>
        {[0, 1, 2, 3].map((level) => (
          <div key={level} className="rounded-[2px]" style={{ width: 10, height: 10, ...levelStyle(level) }} />
        ))}
        <span className="text-caption text-subtle">{t.dashboard.heatmap.more}</span>
      </div>

      {tooltip && (
        <div
          className={cn(tooltipSurfaceClass, 'pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full')}
          style={{ left: tooltip.x, top: tooltip.y - 6 }}
        >
          <p className="text-xs font-medium text-foreground">{formatTooltipDate(tooltip.day.date)}</p>
          <p className="text-caption text-subtle">
            {tooltip.day.distanceKm > 0
              ? t.dashboard.heatmap.day(tooltip.day.distanceKm, tooltip.day.sessionCount)
              : t.dashboard.heatmap.restDay}
          </p>
        </div>
      )}
    </GlassSurface>
  )
}
