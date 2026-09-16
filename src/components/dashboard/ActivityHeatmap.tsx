'use client'

import { useState, useRef, useEffect } from 'react'
import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'
import { tooltipSurfaceClass } from '@/components/ui/Card'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDate, formatDateRange } from '@/lib/formatters'
import { positionMonthLabels, type MonthStart } from '@/lib/heatmapMonths'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const MONTHS = t.dashboard.heatmap.months

function gapFor(cellSize: number): number {
  return cellSize >= 16 ? 3 : cellSize >= 11 ? 2 : 1
}

const LEVEL_MIX_PCT = [10, 45, 72, 100] as const

function levelStyle(level: number) {
  return { backgroundColor: `color-mix(in oklab, var(--accent) ${LEVEL_MIX_PCT[level]}%, var(--card))` }
}

function getLevel(km: number): number {
  if (km === 0) return 0
  if (km < 8)  return 1
  if (km < 16) return 2
  return 3
}

function useThemeVersion(): number {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const obs = new MutationObserver(() => setVersion(v => v + 1))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-accent'] })
    return () => obs.disconnect()
  }, [])
  return version
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
  const [cellSize, setCellSize] = useState(11)
  const gap = gapFor(cellSize)
  const themeVersion = useThemeVersion()

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
      const solve = (gap: number) => Math.floor((w - (weeks.length - 1) * gap) / weeks.length)
      setCellSize(Math.max(5, solve(gapFor(solve(1)))))
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

  const shownMonthLabels = positionMonthLabels(monthStarts, weeks.length, cellSize, gap)
  const gridWidth = Math.max(0, weeks.length * (cellSize + gap) - gap)

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
          {windowRange && (
            <p className="mt-0.5 text-micro text-subtle">{windowRange}</p>
          )}
        </div>
        <span className="shrink-0 text-sm font-semibold text-accent-text">
          {t.dashboard.heatmap.activeDays(activeDays)}
        </span>
      </div>

      <div ref={containerRef} className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div style={{ minWidth: 'max-content' }}>
          <div key={themeVersion} className="flex" style={{ gap: gap }}>
            {weeks.map((wk, col) => (
              <div key={col} className="flex flex-col" style={{ gap: gap }}>
                {wk.map((day, row) =>
                  !day.date ? (
                    <div key={row} style={{ width: cellSize, height: cellSize }} />
                  ) : (
                    <div
                      key={row}
                      className="transition-opacity hover:opacity-70"
                      style={{
                        width: cellSize,
                        height: cellSize,
                        borderRadius: Math.max(1.5, cellSize * 0.18),
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
            className="relative mt-2 h-4 leading-4 text-micro text-subtle"
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

      <div key={themeVersion} className="mt-1 flex items-center justify-end gap-1.5">
        <span className="text-micro text-subtle">{t.dashboard.heatmap.less}</span>
        {LEVEL_MIX_PCT.map((_, i) => (
          <div key={i} className="rounded-[2px]" style={{ width: 10, height: 10, ...levelStyle(i) }} />
        ))}
        <span className="text-micro text-subtle">{t.dashboard.heatmap.more}</span>
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
