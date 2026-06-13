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

interface Props {
  samples: number[]
  durationSeconds?: number
  onHoverFraction?: (fraction: number | null) => void
}

function formatPaceSec(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function PaceChart({ samples, durationSeconds, onHoverFraction }: Props) {
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

  function formatX(val: number) {
    if (!durationSeconds) return String(val)
    const secs = Math.round(val)
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}m`
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pace</h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">min/km</span>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: -8 }}
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
            width={36}
            tickFormatter={formatPaceSec}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--tooltip-bg, #fff)',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v) => [`${formatPaceSec(Number(v))}/km`, 'Pace']}
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
    </div>
  )
}
