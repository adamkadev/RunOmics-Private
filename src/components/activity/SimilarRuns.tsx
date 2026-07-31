'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SimilarRun, SimilarRunsData } from '@/application/usecases/GetSimilarRuns'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { CHART_COLORS } from '@/lib/colors'
import { formatClock, formatDateWithYear, formatDurationShort, formatPace } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const LIST_MAX_ROWS = 4

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
      <p className="text-sm" style={{ color: CHART_COLORS.pace }}>
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

// The run being viewed gets a filled, larger dot so it's findable in the trend.
// Every other dot is a shortcut to that run's own activity page.
function RunDot({ cx, cy, payload, onSelect }: DotProps) {
  if (cx === undefined || cy === undefined || !payload) return null
  const { isCurrent, id } = payload
  return (
    <circle
      cx={cx}
      cy={cy}
      r={isCurrent ? 5.5 : 3.5}
      fill={isCurrent ? CHART_COLORS.pace : 'var(--card)'}
      stroke={CHART_COLORS.pace}
      strokeWidth={2}
      onClick={isCurrent ? undefined : () => onSelect?.(id)}
      style={isCurrent ? undefined : { cursor: 'pointer' }}
    />
  )
}

function RunRow({ run, bestPace }: { run: SimilarRun; bestPace: number }) {
  const s = t.activity.similarRuns
  const deltaSec = Math.round(run.paceSecPerKm - bestPace)

  const content = (
    <>
      <span className="w-6 shrink-0 text-center text-xs font-bold tabular-nums text-muted-foreground">
        {run.rank === 1 ? '🥇' : `#${run.rank}`}
      </span>
      <span className={cn('min-w-0 flex-1 truncate text-sm', run.isCurrent ? 'font-semibold text-foreground' : 'text-foreground/80')}>
        {run.isCurrent ? s.thisRun : formatDateWithYear(run.date)}
      </span>
      <span className="text-sm font-semibold tabular-nums text-foreground">
        {formatDurationShort(run.durationSeconds)}
      </span>
      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-subtle">
        {deltaSec <= 0 ? s.record : s.paceDelta(deltaSec)}
      </span>
    </>
  )

  if (run.isCurrent) {
    return <li className="flex items-center gap-2.5 rounded-control bg-accent-subtle px-2 py-1.5">{content}</li>
  }

  return (
    <li>
      <Link
        href={`/activities/${run.id}`}
        className="flex items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors hover:bg-foreground/[0.04]"
      >
        {content}
      </Link>
    </li>
  )
}

export function SimilarRuns({ data }: { data: SimilarRunsData }) {
  const s = t.activity.similarRuns
  const router = useRouter()
  const bestPaceLabel = formatPace(data.bestPaceSecPerKm)

  const chartData: ChartPoint[] = data.runs.map((run) => ({
    id: run.id,
    label: formatDateWithYear(run.date),
    pace: run.paceSecPerKm,
    isCurrent: run.isCurrent,
  }))

  const byRank = [...data.runs].sort((a, b) => a.rank - b.rank)
  const listed = byRank.slice(0, LIST_MAX_ROWS)
  if (!listed.some((run) => run.isCurrent)) {
    listed[listed.length - 1] = byRank.find((run) => run.isCurrent)!
  }

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground/80">
          {s.title}
        </h3>
        <span className="rounded-full bg-accent-subtle px-2.5 py-0.5 text-xs font-semibold text-accent-text">
          {s.timesBadge(data.count)}
        </span>
      </div>

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
              tickFormatter={formatClock}
              width={46}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: CHART_COLORS.tooltipCursor }} />
            <Line
              type="monotone"
              dataKey="pace"
              stroke={CHART_COLORS.pace}
              strokeWidth={2.5}
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
    </GlassSurface>
  )
}
