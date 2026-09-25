'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  CHART_RANGES,
  hasEarlierPoints,
  pointsInWindow,
  sampleForRange,
  seriesCadence,
  seriesShape,
  windowBounds,
  type ChartRange,
  type SeriesShape,
  type WindowBounds,
} from '@/domain/timeWindow'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartCardHead, ChartReading } from '@/components/ui/ChartCard'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { CHART_COLORS } from '@/lib/colors'
import { AXIS_TICK_DATE, formatDate } from '@/lib/formatters'
import { appTodayIso } from '@/lib/calendarDate'

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

/**
 * The date every chart window ends on. A page's client root fills it with what
 * useToday returned, so the windows agree with the server's HTML on hydration
 * and move at midnight; eleven charts deep, a prop through each would not be
 * simpler. Outside a provider it falls back to reading the clock.
 */
export const ChartTodayContext = createContext<string | null>(null)

export function useChartToday(): string {
  return useContext(ChartTodayContext) ?? appTodayIso()
}

export function useChartWindow<T extends { date: string }>(
  points: T[],
  initialRange: ChartRange = '4w',
  anchor?: Date,
): ChartWindow<T> {
  const [range, setRange] = useState<ChartRange>(initialRange)
  const [offset, setOffset] = useState(0)

  const today = useChartToday()
  const anchorMs = anchor ? anchor.getTime() : new Date(`${today}T00:00:00`).getTime()
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
            'hit-44 rounded-full px-2.5 py-1 text-xs font-semibold transition-all active:scale-95',
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
  return formatDate(date, AXIS_TICK_DATE)
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
        className="hit-44 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
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
        className="hit-44 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

function CadenceNote({ plotted }: { plotted: { date: string }[] }) {
  const note =
    seriesCadence(plotted) === 'weekly'
      ? t.chartWindow.weeklyMeans(plotted.length)
      : t.chartWindow.pointsInWindow(plotted.length)

  return <p className="mt-2 text-caption text-subtle">{note}</p>
}

export function WindowedChartCard<T extends { date: string }>({
  title,
  unit,
  controls,
  legend,
  points,
  initialRange = '4w',
  sample = true,
  footnote,
  reading,
  value,
  children,
}: {
  title: ReactNode
  /** What the plotted values are counted in, shown beside the title so the
   *  axis numbers are not the only place the reader can look for it. */
  unit?: string
  controls?: ReactNode
  legend?: ReactNode | ((visible: T[]) => ReactNode)
  points: T[]
  initialRange?: ChartRange
  sample?: boolean
  footnote?: ReactNode
  /** The card's takeaway, rendered above the chart. It takes the window that is
   *  actually on screen - not the whole series - so a card can never lead with
   *  a number the reader cannot find in the picture below it. */
  reading?: (visible: T[]) => ReactNode
  value?: (visible: T[]) => ReactNode
  children: (visible: T[], shape: SeriesShape) => ReactNode
}) {
  const w = useChartWindow(points, initialRange)
  const plotted = sample ? sampleForRange(w.visible, w.range) : w.visible
  const shape = seriesShape(plotted.length)
  const takeaway = shape !== 'tooFew' && reading ? reading(plotted) : null

  return (
    <GlassSurface variant="card" className="p-5">
      <ChartCardHead
        title={title}
        unit={unit}
        footnote={footnote}
        controls={
          <>
            {controls}
            <ChartRangeChips value={w.range} onChange={w.selectRange} />
          </>
        }
      />

      {takeaway && <ChartReading>{takeaway}</ChartReading>}

      {legend && (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {typeof legend === 'function' ? legend(plotted) : legend}
        </div>
      )}

      <ChartWindowPager
        bounds={w.bounds}
        canGoBack={w.canGoBack}
        canGoForward={w.canGoForward}
        onBack={w.goBack}
        onForward={w.goForward}
      />

      {plotted.length === 0 ? (
        <p className="py-12 text-center text-sm text-subtle">{t.chartWindow.empty}</p>
      ) : shape === 'tooFew' ? (
        <div className="py-6 text-center">
          {value && <div className="font-display text-title2 font-bold tabular-nums">{value(plotted)}</div>}
          <p className="mt-1 text-sm text-subtle">{t.chartWindow.tooFewToPlot}</p>
        </div>
      ) : (
        children(plotted, shape)
      )}

      {shape !== 'curve' && plotted.length > 0 && <CadenceNote plotted={plotted} />}
    </GlassSurface>
  )
}

export function latestOf<T>(points: T[], pick: (p: T) => number | null | undefined): number | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const v = pick(points[i]!)
    if (typeof v === 'number') return v
  }
  return null
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
  return formatDate(date, { precision: 'month', year: 'never' })
}

export function windowTicks<T extends { date: string }>(points: T[], count = 6): Set<string> {
  const step = Math.max(1, Math.floor(points.length / count))
  return new Set(points.filter((_, i) => i % step === 0).map((p) => p.date))
}
