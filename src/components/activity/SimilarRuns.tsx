'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SimilarRun, SimilarRunsData } from '@/application/usecases/GetSimilarRuns'
import { cardClass } from '@/components/ui/Card'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { lineInterpolation } from '@/domain/timeWindow'
import { CHART_COLORS } from '@/lib/colors'
import { Medal } from 'lucide-react'
import { paceAxis } from '@/lib/chartAxis'
import { formatClock, formatDate, formatDuration, formatPace } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const LIST_MAX_ROWS = 4

/** The athlete's own runs, so the line is the accent (v4.17); the record line stays neutral. */
const ROUTE_LINE = 'var(--accent)'

interface ChartPoint {
  id: string
  label: string
  pace: number
  isCurrent: boolean
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: ChartPoint }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <TooltipCard label={p.label}>
      <p className="text-sm text-accent-text">
        {formatPace(p.pace)}
      </p>
    </TooltipCard>
  )
}

interface DotProps {
  cx?: number
  cy?: number
  payload?: ChartPoint
  onSelect?: (id: string) => void
}

function RunDot({ cx, cy, payload, onSelect }: DotProps) {
  if (cx === undefined || cy === undefined || !payload) return null
  const { isCurrent, id } = payload
  return (
    <circle
      cx={cx}
      cy={cy}
      r={isCurrent ? 5.5 : 3.5}
      fill={isCurrent ? ROUTE_LINE : 'var(--card)'}
      stroke={ROUTE_LINE}
      strokeWidth={2}
      onClick={isCurrent ? undefined : () => onSelect?.(id)}
      style={isCurrent ? undefined : { cursor: 'pointer' }}
    />
  )
}

// Ranked by pace, so the bold number is the pace. A run's total time is
// secondary text: the column used to hold total times ("19:50") next to
// per-km deltas ("+57s/km") under a ranking the reader could not see.
function RunRow({ run, bestPace }: { run: SimilarRun; bestPace: number }) {
  const s = t.activity.similarRuns
  const deltaSec = Math.round(run.paceSecPerKm - bestPace)

  const content = (
    <>
      {/* The fastest of them takes a medal, drawn rather than typed (3.0
          override 3): the emoji was the one picture in a list of numbers. */}
      <span className="flex w-6 shrink-0 items-center justify-center text-xs font-bold tabular-nums text-muted-foreground">
        {run.rank === 1 ? <Medal size={14} strokeWidth={2.2} role="img" aria-label={s.fastest} /> : `#${run.rank}`}
      </span>
      <span className={cn('min-w-0 flex-1 truncate text-sm', run.isCurrent ? 'font-semibold text-foreground' : 'text-foreground/80')}>
        {run.isCurrent ? s.thisRun : formatDate(run.date, { year: 'always' })}
      </span>
      <span className="flex flex-col items-end leading-tight">
        <span className="text-sm font-semibold tabular-nums text-foreground">{formatPace(run.paceSecPerKm)}</span>
        <span className="text-caption tabular-nums text-subtle">{formatDuration(run.durationSeconds)}</span>
      </span>
      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-subtle">
        {deltaSec <= 0 ? s.record : s.paceDelta(deltaSec)}
      </span>
    </>
  )

  if (run.isCurrent) {
    return <li className="flex items-center gap-2.5 rounded-control bg-[var(--surface-2)] px-2 py-1.5">{content}</li>
  }

  return (
    <li>
      <Link
        href={`/activities/${run.id}`}
        className="flex min-h-11 items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors hover:bg-[var(--surface-2)]"
      >
        {content}
      </Link>
    </li>
  )
}

export function SimilarRuns({ data }: { data: SimilarRunsData }) {
  const s = t.activity.similarRuns
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // Faster is up here too: this chart used to put the slowest run at the top.
  const pace = paceAxis()
  const bestPaceLabel = formatPace(data.bestPaceSecPerKm)

  const chartData: ChartPoint[] = data.runs.map((run) => ({
    id: run.id,
    // An 11px axis tick has no room for a weekday.
    label: formatDate(run.date, { style: 'bare', year: 'always' }),
    pace: run.paceSecPerKm,
    isCurrent: run.isCurrent,
  }))

  const byRank = [...data.runs].sort((a, b) => a.rank - b.rank)
  const listed = byRank.slice(0, LIST_MAX_ROWS)
  if (!listed.some((run) => run.isCurrent)) {
    listed[listed.length - 1] = byRank.find((run) => run.isCurrent)!
  }

  const current = data.runs.find((run) => run.isCurrent)
  const deltaSec = current ? Math.round(current.paceSecPerKm - data.bestPaceSecPerKm) : 0

  // One row on Overview, opening to the chart and the ranking: the card used to
  // be the first thing after a run, which put other runs ahead of this one.
  return (
    <section className={cardClass({ padding: 'none' })}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold text-foreground">{s.rowTitle(data.currentRank, data.count)}</span>
          <span className="block text-xs text-muted-foreground">
            {deltaSec <= 0 ? s.rowBest : s.rowDelta(deltaSec)}
          </span>
        </span>
        <ChevronRight
          size={16}
          aria-hidden="true"
          className={cn('shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
        />
      </button>

      {open && (
        <div className="border-t border-border px-5 pb-[18px] pt-3">
          <p className="mb-3 text-sm text-muted-foreground">{s.summary(data.count, data.currentRank)}</p>

          <ChartFigure summary={s.chartSummary(data.count, bestPaceLabel)}>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                  axisLine={false}
                  tickLine={false}
                  domain={['dataMin - 5', 'dataMax + 5']}
                  reversed={pace.reversed}
                  tickFormatter={formatClock}
                  width={46}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: CHART_COLORS.tooltipCursor }} />
                <Line
                  type={lineInterpolation(chartData.length)}
                  dataKey="pace"
                  stroke={ROUTE_LINE}
                  strokeWidth={2}
                  dot={<RunDot onSelect={(id) => router.push(`/activities/${id}`)} />}
                  isAnimationActive={false}
                />
                <ReferenceLine y={data.bestPaceSecPerKm} stroke={CHART_COLORS.referenceTarget} strokeDasharray="3 4" />
              </LineChart>
            </ResponsiveContainer>
          </ChartFigure>

          <ul className="mt-3 space-y-0.5 border-t border-border pt-3">
            {listed.map((run) => (
              <RunRow key={run.id} run={run} bestPace={data.bestPaceSecPerKm} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
