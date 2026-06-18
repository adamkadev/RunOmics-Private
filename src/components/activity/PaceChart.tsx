'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS } from '@/lib/colors'
import { formatClock, formatElapsed } from '@/lib/formatters'
import { Card } from '@/components/ui/Card'
import { t } from '@/i18n'

interface Props {
  samples: number[]
  avgPaceSecPerKm?: number | null
  durationSeconds?: number
  onHoverFraction?: (fraction: number | null) => void
}

export function PaceChart({ samples, avgPaceSecPerKm, durationSeconds, onHoverFraction }: Props) {
  const data = samples.map((pace, i) => {
    const t = durationSeconds ? (i / (samples.length - 1)) * durationSeconds : i
    return { t, pace }
  })

  function handleMove(state: Record<string, unknown> | null) {
    const idx = state?.activeTooltipIndex
    if (typeof idx === 'number' && samples.length > 1) {
      onHoverFraction?.(idx / (samples.length - 1))
    }
  }

  const validSamples = samples.filter((v) => v > 0)
  const minVal = validSamples.length ? Math.max(60, Math.min(...validSamples) - 10) : 200
  const maxVal = validSamples.length ? Math.min(900, Math.max(...validSamples) + 20) : 600
  const avgPace = avgPaceSecPerKm ?? null

  function formatX(val: number) {
    if (!durationSeconds) return String(val)
    return formatElapsed(val)
  }

  return (
    <Card accent="amber" padding="lg">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">{t.activity.charts.pace}</h3>
        <span className="text-xs text-subtle">
          {avgPace && <span className="font-semibold text-foreground">{formatClock(avgPace)} </span>}
          {t.units.minPerKm}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          onMouseMove={handleMove}
          onMouseLeave={() => onHoverFraction?.(null)}
        >
          <defs>
            <linearGradient id="paceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.pace} stopOpacity={0.25} />
              <stop offset="95%" stopColor={CHART_COLORS.pace} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickCount={5}
            tickFormatter={formatX}
            tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[maxVal, minVal]}
            reversed
            tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={formatClock}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--tooltip-bg, #fff)',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v) => [`${formatClock(Number(v))}/${t.units.km}`, t.activity.charts.pace]}
            labelFormatter={(v) => formatX(Number(v))}
          />
          <Area
            type="monotone"
            dataKey="pace"
            stroke={CHART_COLORS.pace}
            strokeWidth={1.5}
            fill="url(#paceGradient)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  )
}
