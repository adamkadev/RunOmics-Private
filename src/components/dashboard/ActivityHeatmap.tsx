'use client'

import { useState, useRef, useEffect } from 'react'
import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'
import { tooltipSurfaceClass } from '@/components/ui/Card'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const MONTHS = t.dashboard.heatmap.months

// Cells stay square and fill the card width, so the gap has to grow with them -
// a fixed 1px between 20px cells reads as one solid block rather than a grid.
function gapFor(cellSize: number): number {
  return cellSize >= 16 ? 3 : cellSize >= 11 ? 2 : 1
}

// Intensity scale mixed from the active accent, so it follows the chosen palette.
// Mixing toward --card (rather than fixed light/dark stops) adapts to dark mode
// for free. Level 0 keeps a faint green tint (like the mockup's empty cells) and
// the ramp climbs steeply so busy weeks read as a vivid, saturated accent.
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
      // All 12 months fit on one line without scrolling. No upper cap on the
      // cell size: on desktop the cells grow so the grid spans the whole card
      // instead of stopping at ~640px and leaving dead space to the right.
      // Two passes, since the gap tier depends on the size it helps determine.
      const solve = (gap: number) => Math.floor((w - (weeks.length - 1) * gap) / weeks.length)
      setCellSize(Math.max(5, solve(gapFor(solve(1)))))
    }
    compute()
    const obs = new ResizeObserver(compute)
    obs.observe(el)
    return () => obs.disconnect()
  }, [weeks.length])

  // Month labels: show label at the first week where a new month starts, then
  // keep only every other one - twelve months of labels crowd the small cells,
  // and skipping alternates still reads fine since each spans ~4-5 weeks.
  const monthLabels: { label: string; col: number }[] = []
  let lastMonth = -1
  weeks.forEach((wk, col) => {
    const firstDate = wk.find(d => d.date)?.date
    if (!firstDate) return
    const month = new Date(firstDate + 'T12:00:00').getMonth()
    if (month !== lastMonth) {
      monthLabels.push({ label: MONTHS[month] ?? '', col })
      lastMonth = month
    }
  })

  // A 12-month window straddles 13 calendar months (it opens mid-month and
  // closes in that same month a year later), and alternating over 13 leaves 7
  // labels with the same month at both ends. Drop the leading sliver so the
  // scale is 12 whole months and alternating yields 6.
  const firstDay = days.find(d => d.date)?.date
  const opensMidMonth = firstDay ? new Date(firstDay + 'T12:00:00').getDate() !== 1 : false
  const wholeMonths = opensMidMonth ? monthLabels.slice(1) : monthLabels
  const shownMonthLabels = wholeMonths.filter((_, i) => i % 2 === 0)

  const activeDays = days.filter(d => d.distanceKm > 0).length

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">{t.dashboard.heatmap.title}</h3>
        <span className="text-sm font-semibold text-accent-text">
          {t.dashboard.heatmap.activeDays(activeDays)}
        </span>
      </div>

      <div ref={containerRef} className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div style={{ minWidth: 'max-content' }}>
          {/* Grid - no weekday-label gutter, so the full width goes to cells */}
          {/* keyed on themeVersion so the color-mix cells remount and re-resolve on a theme/accent switch */}
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

          {/* Month scale sits under the grid, like an x-axis */}
          {/* Spread rather than absolutely positioned per column: the labels
              mark evenly spaced months anyway, and justify-between pins the
              first flush left and the last flush right across the full grid. */}
          <div className="mt-2 flex justify-between leading-4 text-micro text-subtle">
            {shownMonthLabels.map(({ label, col }) => (
              <span key={`${label}-${col}`}>{label}</span>
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

      {/* Floating tooltip */}
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
