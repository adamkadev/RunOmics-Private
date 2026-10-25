'use client'

import { useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { lineInterpolation } from '@/domain/timeWindow'
import { paceAxis } from '@/lib/chartAxis'
import { CHART_COLORS } from '@/lib/colors'
import { formatClock, formatPace } from '@/lib/formatters'

/** The athlete's own runs, so the line is the accent; the record line stays neutral. */
const ROUTE_LINE = 'var(--accent)'

export interface SimilarRunPoint {
  id: string
  label: string
  pace: number
  isCurrent: boolean
}

const TOP = 8
const PLOT_H = 90
const AXIS_W = 42
const RIGHT = 8
const VIEW_W = 100
/** Five ticks at most, at a step a pace is read in. */
const PACE_STEPS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300, 600]
const MAX_INTERVALS = 4
/** About a fingertip, so a 9 px dot opens its run without a pixel-perfect tap. */
const HIT_RADIUS = 16

export function paceTicks(paces: number[]): number[] {
  const lo = Math.min(...paces) - 5
  const hi = Math.max(...paces) + 5
  const step = PACE_STEPS.find((s) => Math.ceil(hi / s) - Math.floor(lo / s) <= MAX_INTERVALS) ?? PACE_STEPS.at(-1)!
  const ticks: number[] = []
  for (let tick = Math.floor(lo / step) * step; tick <= Math.ceil(hi / step) * step; tick += step) ticks.push(tick)
  return ticks
}

/** d3's curveMonotoneX on evenly spaced points: smooth, and never overshooting a run's pace. */
function monotonePath(xs: number[], ys: number[]): string {
  const n = xs.length
  const h = xs[1]! - xs[0]!
  const slopes = ys.slice(1).map((y, i) => (y - ys[i]!) / h)
  const tangents = ys.map((_, i) => {
    if (i === 0 || i === n - 1) return 0
    const s0 = slopes[i - 1]!
    const s1 = slopes[i]!
    const sign = (v: number) => (v < 0 ? -1 : 1)
    return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.25 * Math.abs(s0 + s1)) || 0
  })
  tangents[0] = (3 * slopes[0]! - tangents[1]!) / 2
  tangents[n - 1] = (3 * slopes[n - 2]! - tangents[n - 2]!) / 2
  let d = `M${xs[0]!.toFixed(2)} ${ys[0]!.toFixed(2)}`
  for (let i = 0; i < n - 1; i++) {
    const dx = h / 3
    d += ` C${(xs[i]! + dx).toFixed(2)} ${(ys[i]! + dx * tangents[i]!).toFixed(2)} ${(xs[i + 1]! - dx).toFixed(2)} ${(ys[i + 1]! - dx * tangents[i + 1]!).toFixed(2)} ${xs[i + 1]!.toFixed(2)} ${ys[i + 1]!.toFixed(2)}`
  }
  return d
}

function linearPath(xs: number[], ys: number[]): string {
  return xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${ys[i]!.toFixed(2)}`).join(' ')
}

export function SimilarRunsChart({ data, bestPace, onSelect }: { data: SimilarRunPoint[]; bestPace: number; onSelect: (id: string) => void }) {
  const [active, setActive] = useState<number | null>(null)
  const dragging = useRef(false)
  if (data.length === 0) return null

  // Faster is up, as on the app's other pace charts.
  const reversed = paceAxis().reversed
  const ticks = paceTicks(data.map((p) => p.pace))
  const lo = ticks[0]!
  const hi = ticks.at(-1)!
  const y = (pace: number) => ((reversed ? pace - lo : hi - pace) / (hi - lo)) * PLOT_H
  const share = (i: number) => (data.length > 1 ? i / (data.length - 1) : 0.5)
  const xs = data.map((_, i) => share(i) * VIEW_W)
  const ys = data.map((p) => y(p.pace))
  const line = lineInterpolation(data.length) === 'monotone' && data.length > 2 ? monotonePath(xs, ys) : linearPath(xs, ys)
  const labelled = [...new Set([0, Math.round((data.length - 1) / 2), data.length - 1])]
  const pct = (i: number) => `${(share(i) * 100).toFixed(2)}%`

  function nearest(event: ReactMouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const fraction = rect.width > 0 ? Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) : 0
    const index = Math.round(fraction * (data.length - 1))
    return { index, dx: event.clientX - rect.left - share(index) * rect.width, dy: event.clientY - rect.top - ys[index]! }
  }

  // A mouse reads where it hovers and lets go when it leaves; a finger's reading stays after it lifts.
  function handleDown(event: ReactPointerEvent<HTMLDivElement>) {
    dragging.current = true
    setActive(nearest(event).index)
  }

  function handleMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragging.current || event.pointerType === 'mouse') setActive(nearest(event).index)
  }

  function handleClick(event: ReactMouseEvent<HTMLDivElement>) {
    const { index, dx, dy } = nearest(event)
    const run = data[index]!
    if (!run.isCurrent && Math.hypot(dx, dy) <= HIT_RADIUS) onSelect(run.id)
  }

  function handleLeave(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse') setActive(null)
  }

  const shown = active !== null ? data[active] : undefined

  return (
    <div className="relative h-[120px] select-none text-caption leading-none" data-testid="similar-runs-chart">
      <div className="absolute left-0" style={{ top: TOP, height: PLOT_H, width: AXIS_W - 8 }}>
        {ticks.map((tick) => (
          <span key={tick} className="absolute right-0 -translate-y-1/2 tabular-nums" style={{ top: y(tick), color: CHART_COLORS.axisTick }}>
            {formatClock(tick)}
          </span>
        ))}
      </div>

      <div
        className="absolute cursor-crosshair touch-pan-y"
        style={{ top: TOP, left: AXIS_W, right: RIGHT, height: PLOT_H }}
        data-testid="similar-runs-plot"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onPointerLeave={handleLeave}
        onClick={handleClick}
      >
        <svg viewBox={`0 0 ${VIEW_W} ${PLOT_H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <path
            d={`M0 ${y(bestPace).toFixed(2)} L${VIEW_W} ${y(bestPace).toFixed(2)}`}
            stroke={CHART_COLORS.referenceTarget}
            strokeWidth={1}
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />
          {shown && (
            <path
              d={`M${xs[active!]!.toFixed(2)} 0 L${xs[active!]!.toFixed(2)} ${PLOT_H}`}
              stroke={CHART_COLORS.tooltipCursor}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path d={line} fill="none" stroke={ROUTE_LINE} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {data.map((p, i) => (
          <span
            key={p.id}
            data-testid="similar-run-dot"
            data-current={p.isCurrent ? '' : undefined}
            className={p.isCurrent ? 'pointer-events-none absolute size-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full' : 'pointer-events-none absolute size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2'}
            style={{ left: pct(i), top: ys[i], background: p.isCurrent ? ROUTE_LINE : 'var(--card)', borderColor: ROUTE_LINE }}
          />
        ))}
        {shown && (
          <>
            <span
              className="pointer-events-none absolute size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background"
              style={{ left: pct(active!), top: ys[active!], background: ROUTE_LINE }}
            />
            <div
              className="pointer-events-none absolute top-0 z-20 whitespace-nowrap"
              data-testid="similar-runs-tooltip"
              style={share(active!) <= 0.5 ? { left: `calc(${pct(active!)} + 10px)` } : { right: `calc(100% - ${pct(active!)} + 10px)` }}
            >
              <TooltipCard label={shown.label}>
                <p className="text-sm text-accent-text">{formatPace(shown.pace)}</p>
              </TooltipCard>
            </div>
          </>
        )}
      </div>

      <div className="absolute bottom-0 h-3.5" style={{ left: AXIS_W, right: RIGHT, color: CHART_COLORS.axisTick }}>
        {labelled.map((i) => (
          <span
            key={i}
            className="absolute whitespace-nowrap"
            style={{ left: pct(i), transform: i === 0 && data.length > 1 ? undefined : i === data.length - 1 && data.length > 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}
          >
            {data[i]!.label}
          </span>
        ))}
      </div>
    </div>
  )
}
