'use client'

import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: SimilarRunPoint }>
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
  payload?: SimilarRunPoint
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

export function SimilarRunsChart({ data, bestPace, onSelect }: { data: SimilarRunPoint[]; bestPace: number; onSelect: (id: string) => void }) {
  // Faster is up, as on the app's other pace charts.
  const pace = paceAxis()
  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
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
          type={lineInterpolation(data.length)}
          dataKey="pace"
          stroke={ROUTE_LINE}
          strokeWidth={2}
          dot={<RunDot onSelect={onSelect} />}
          isAnimationActive={false}
        />
        <ReferenceLine y={bestPace} stroke={CHART_COLORS.referenceTarget} strokeDasharray="3 4" />
      </LineChart>
    </ResponsiveContainer>
  )
}
