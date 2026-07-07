'use client'

import { useState, useRef, useEffect } from 'react'
import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'
import { tooltipSurfaceClass } from '@/components/ui/Card'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const MONTHS = t.dashboard.heatmap.months
const GAP = 3
const LABEL_W = 26 // matches paddingLeft of month labels row

// Intensity scale mixed from the active accent, so it follows the chosen palette.
// Mixing toward --card (rather than fixed light/dark stops) adapts to dark mode for free.
const LEVEL_MIX_PCT = [0, 20, 40, 60, 80, 100] as const

function levelStyle(level: number) {
  if (level === 0) return { backgroundColor: 'var(--muted)' }
  return { backgroundColor: `color-mix(in oklab, var(--accent) ${LEVEL_MIX_PCT[level]}%, var(--card))` }
}

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
    const raf = requestAnimationFrame(() => { el.scrollLeft = el.scrollWidth })
    return () => cancelAnimationFrame(raf)
  }, [])

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
      monthLabels.push({ label: MONTHS[month] ?? '', col })
      lastMonth = month
    }
  })

  const totalKm = days.reduce((s, d) => s + d.distanceKm, 0)
  const activeDays = days.filter(d => d.distanceKm > 0).length

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">
          {t.dashboard.heatmap.title} <span className="font-normal text-subtle">{t.dashboard.heatmap.window}</span>
        </h3>
        <span className="text-xs text-subtle">
          <span className="font-semibold text-foreground">{activeDays}</span> {t.dashboard.heatmap.days} ·{' '}
          <span className="font-semibold text-foreground">{Math.round(totalKm)}</span> {t.units.km}
        </span>
      </div>

      <div ref={containerRef} className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div style={{ minWidth: 'max-content' }}>
          <div className="relative mb-1 h-3" style={{ paddingLeft: LABEL_W }}>
            {monthLabels.map(({ label, col }) => (
              <span
                key={`${label}-${col}`}
                className="absolute text-micro text-subtle"
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
                  className="text-right text-micro leading-none text-subtle"
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
                      className="rounded-[2px] transition-opacity hover:opacity-70"
                      style={{ width: cellSize, height: cellSize, cursor: 'default', ...levelStyle(getLevel(day.distanceKm)) }}
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

      <div className="mt-3 flex items-center justify-end gap-1.5">
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
