'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  CHART_RANGES,
  hasEarlierPoints,
  pointsInWindow,
  sampleForRange,
  windowBounds,
  type ChartRange,
  type WindowBounds,
} from '@/domain/timeWindow'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { CardTitle } from '@/components/ui/SectionLabel'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { CHART_COLORS } from '@/lib/colors'

export interface ChartWindow<T extends { date: string }> {
  range: ChartRange
  selectRange: (range: ChartRange) => void
  bounds: WindowBounds
  visible: T[]
  canGoBack: boolean
  canGoForward: boolean
  goBack: () => void
  goForward: () => void
}

function startOfTodayMs(): number {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function useChartWindow<T extends { date: string }>(
  points: T[],
  initialRange: ChartRange = '4w',
  anchor?: Date,
): ChartWindow<T> {
  const [range, setRange] = useState<ChartRange>(initialRange)
  const [offset, setOffset] = useState(0)

  const anchorMs = anchor ? anchor.getTime() : startOfTodayMs()
  const anchorDate = useMemo(() => new Date(anchorMs), [anchorMs])

  const bounds = useMemo(() => windowBounds(range, offset, anchorDate), [range, offset, anchorDate])
  const visible = useMemo(() => pointsInWindow(points, bounds), [points, bounds])

  return {
    range,
    selectRange: (next) => {
      setRange(next)
      setOffset(0)
    },
    bounds,
    visible,
    canGoBack: hasEarlierPoints(points, bounds),
    canGoForward: offset > 0,
    goBack: () => setOffset((o) => o + 1),
    goForward: () => setOffset((o) => o - 1),
  }
}

export function ChartRangeChips({
  value,
  onChange,
}: {
  value: ChartRange
  onChange: (range: ChartRange) => void
}) {
  return (
    <div className="flex gap-0.5 rounded-full bg-foreground/[0.06] p-0.5">
      {CHART_RANGES.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-semibold transition-all active:scale-95',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            r === value
              ? 'bg-accent text-accent-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t.chartWindow.ranges[r]}
        </button>
      ))}
    </div>
  )
}

function shortDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString(t.locale, { day: 'numeric', month: 'short' })
}

export function ChartWindowPager({
  bounds,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: {
  bounds: WindowBounds
  canGoBack: boolean
  canGoForward: boolean
  onBack: () => void
  onForward: () => void
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <button
        onClick={onBack}
        disabled={!canGoBack}
        aria-label={t.chartWindow.previous}
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-xs font-medium text-muted-foreground">
        {shortDate(bounds.from)} – {shortDate(bounds.to)}
      </span>
      <button
        onClick={onForward}
        disabled={!canGoForward}
        aria-label={t.chartWindow.next}
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

// trendFromSeries refuses to call anything a trend below this many points; a
// chart drawn from fewer should not imply one either.
export const SPARSE_POINTS = 4

export function WindowedChartCard<T extends { date: string }>({
  title,
  unit,
  controls,
  legend,
  points,
  initialRange = '4w',
  sample = true,
  footnote,
  sparse,
  children,
}: {
  title: ReactNode
  /** What the plotted values are counted in, shown beside the title so the
   *  axis numbers are not the only place the reader can look for it. */
  unit?: string
  controls?: ReactNode
  legend?: ReactNode
  points: T[]
  initialRange?: ChartRange
  sample?: boolean
  footnote?: ReactNode
  sparse?: (visible: T[]) => ReactNode
  children: (visible: T[]) => ReactNode
}) {
  const w = useChartWindow(points, initialRange)
  const plotted = sample ? sampleForRange(w.visible, w.range) : w.visible

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <CardTitle>
          {title}
          {unit && <span className="ml-1.5 text-caption font-medium text-subtle">· {unit}</span>}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {controls}
          <ChartRangeChips value={w.range} onChange={w.selectRange} />
        </div>
      </div>

      {legend && <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1">{legend}</div>}

      <ChartWindowPager
        bounds={w.bounds}
        canGoBack={w.canGoBack}
        canGoForward={w.canGoForward}
        onBack={w.goBack}
        onForward={w.goForward}
      />

      {plotted.length === 0 ? (
        <p className="py-12 text-center text-sm text-subtle">{t.chartWindow.empty}</p>
      ) : sparse && plotted.length < SPARSE_POINTS ? (
        sparse(plotted)
      ) : (
        children(plotted)
      )}

      {footnote && <p className="mt-2 text-xs text-subtle">{footnote}</p>}
    </GlassSurface>
  )
}

export function trendDots(color: string) {
  return {
    dot: { r: 3, fill: color, stroke: 'none' },
    activeDot: { r: 5, fill: color, stroke: 'none' },
  }
}

export function windowTickDate(date: string): string {
  return shortDate(date)
}

export function windowDateAxis(ticks: Set<string>, label: (date: string) => string = windowTickDate) {
  return {
    dataKey: 'date',
    tick: { fontSize: 11, fill: CHART_COLORS.axisTick },
    axisLine: false,
    tickLine: false,
    tickFormatter: (date: string) => (ticks.has(date) ? label(date) : ''),
  }
}

export function windowTickMonth(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString(t.locale, { month: 'short' })
}

export function windowTicks<T extends { date: string }>(points: T[], count = 6): Set<string> {
  const step = Math.max(1, Math.floor(points.length / count))
  return new Set(points.filter((_, i) => i % step === 0).map((p) => p.date))
}
