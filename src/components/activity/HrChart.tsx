'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { CHART_COLORS } from '@/lib/colors'

interface Props {
  samples: number[]
  avgHr?: number | null
  maxHr?: number | null
  durationSeconds?: number
  onHoverFraction?: (fraction: number | null) => void
}

export function HrChart({ samples, avgHr, maxHr, durationSeconds, onHoverFraction }: Props) {
  const data = samples.map((bpm, i) => {
    const pct = durationSeconds ? (i / (samples.length - 1)) * durationSeconds : i
    return { t: pct, bpm }
  })

  function handleMove(state: Record<string, unknown> | null) {
    const idx = state?.activeTooltipIndex
    if (typeof idx === 'number' && samples.length > 1) {
      onHoverFraction?.(idx / (samples.length - 1))
    }
  }

  const minVal = Math.max(0, Math.min(...samples) - 10)
  const maxVal = Math.min(220, Math.max(...samples) + 10)

  function formatX(val: number) {
    if (!durationSeconds) return String(val)
    const secs = Math.round(val)
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}m`
  }

  const tickCount = 5

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Heart Rate</h3>
        {avgHr && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            avg <span className="font-semibold text-red-500">{avgHr}</span>
            {maxHr && (
              <> · max <span className="font-semibold text-red-600">{maxHr}</span></>
            )}
            {' '}bpm
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: -8 }}
          onMouseMove={handleMove}
          onMouseLeave={() => onHoverFraction?.(null)}
        >
          <defs>
            <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.hr} stopOpacity={0.25} />
              <stop offset="95%" stopColor={CHART_COLORS.hr} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickCount={tickCount}
            tickFormatter={formatX}
            tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[minVal, maxVal]}
            tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--tooltip-bg, #fff)',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v) => [`${v} bpm`, 'HR']}
            labelFormatter={(v) => formatX(Number(v))}
          />
          {avgHr && (
            <ReferenceLine
              y={avgHr}
              stroke={CHART_COLORS.hr}
              strokeDasharray="4 3"
              strokeOpacity={0.5}
              strokeWidth={1}
            />
          )}
          <Area
            type="monotone"
            dataKey="bpm"
            stroke={CHART_COLORS.hr}
            strokeWidth={1.5}
            fill="url(#hrGradient)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
