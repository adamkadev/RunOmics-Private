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
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

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

// Local midnight today, as a primitive so it stays referentially stable across
// same-day re-renders (a fresh Date object would re-run every dependent memo).
function startOfTodayMs(): number {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

// 4w is the default everywhere: the range lives in component state only, so
// leaving the page and coming back always lands back on the recent window
// rather than whatever was last inspected.
export function useChartWindow<T extends { date: string }>(
  points: T[],
  initialRange: ChartRange = '4w',
  anchor?: Date,
): ChartWindow<T> {
  const [range, setRange] = useState<ChartRange>(initialRange)
  // 0 is the window ending on the anchor; each step back is one window earlier.
  const [offset, setOffset] = useState(0)

  // Anchor every chart on *today*, not on its own last data point, so all cards
  // show the same calendar window (the real last 4 weeks / 6 months / year up to
  // today) - the way the watch reports its ranges. Anchoring on each series' last
  // reading made windows end on different days (a metric last recorded on the
  // 14th ended two weeks before one recorded on the 29th) and drift out of sync.
  // A metric with no recent value now simply shows a shorter curve inside the
  // shared window instead of shifting the whole window backwards.
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

// One segmented pill (shared background, no per-button borders) rather than
// three separately-boxed buttons - matches the mockup's 6w/6m/1y control.
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

/**
 * Card frame for a self-windowing trend chart: title, optional extra header
 * controls and legend, the range chips, the pager, an empty state, and the
 * footnote. The chart body is a render-prop given the visible slice, so every
 * windowed chart shares one layout and only supplies its own plot.
 *
 * The slice handed to `children` is downsampled to the window's point budget
 * (4w -> 4, 6m -> 6, 1y -> 12) so every trend chart in the app reads at the
 * same density as the Fitness group's load chart. Charts that aggregate the
 * whole window instead of plotting it (the zone donut) opt out with
 * `sample={false}`.
 */
export function WindowedChartCard<T extends { date: string }>({
  title,
  controls,
  legend,
  points,
  initialRange = '4w',
  sample = true,
  footnote,
  children,
}: {
  title: ReactNode
  controls?: ReactNode
  legend?: ReactNode
  points: T[]
  initialRange?: ChartRange
  sample?: boolean
  footnote?: ReactNode
  children: (visible: T[]) => ReactNode
}) {
  const w = useChartWindow(points, initialRange)
  const plotted = sample ? sampleForRange(w.visible, w.range) : w.visible

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground/80">{title}</h3>
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
      ) : (
        children(plotted)
      )}

      {footnote && <p className="mt-2 text-xs text-subtle">{footnote}</p>}
    </GlassSurface>
  )
}

/**
 * Dot props for a windowed trend line. The point budget leaves 4-12 values per
 * window, so each reading is worth marking - at that density a bare line hides
 * where the actual measurements are.
 */
export function trendDots(color: string) {
  return {
    dot: { r: 3, fill: color, stroke: 'none' },
    activeDot: { r: 5, fill: color, stroke: 'none' },
  }
}

/** Short "24 Jun" label for a chart's date-keyed X axis. */
export function windowTickDate(date: string): string {
  return shortDate(date)
}

/**
 * Short "Jun" label, for a window wide enough that the day is noise - pair with
 * monthStartTicks, which picks the dates these land on.
 */
export function windowTickMonth(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString(t.locale, { month: 'short' })
}

/** Dates to keep as X-axis ticks so a dense window shows ~`count` labels. */
export function windowTicks<T extends { date: string }>(points: T[], count = 6): Set<string> {
  const step = Math.max(1, Math.floor(points.length / count))
  return new Set(points.filter((_, i) => i % step === 0).map((p) => p.date))
}
