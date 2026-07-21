'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  CHART_RANGES,
  hasEarlierPoints,
  pointsInWindow,
  windowBounds,
  type ChartRange,
  type WindowBounds,
} from '@/domain/timeWindow'
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

export function useChartWindow<T extends { date: string }>(
  points: T[],
  initialRange: ChartRange = '6m',
): ChartWindow<T> {
  const [range, setRange] = useState<ChartRange>(initialRange)
  // 0 is the window ending on the anchor; each step back is one window earlier.
  const [offset, setOffset] = useState(0)

  const anchor = useMemo(() => {
    const last = points[points.length - 1]?.date
    return last ? new Date(last + 'T00:00:00') : new Date()
  }, [points])

  const bounds = useMemo(() => windowBounds(range, offset, anchor), [range, offset, anchor])
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
    <div className="flex gap-1">
      {CHART_RANGES.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={cn(
            'rounded-md px-2 py-1 text-xs font-medium transition-colors',
            r === value
              ? 'bg-accent text-white'
              : 'border border-border bg-card text-muted-foreground hover:bg-muted',
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
