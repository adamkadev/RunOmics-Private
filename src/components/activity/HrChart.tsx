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

interface Props {
  samples: number[]
  avgHr?: number | null
  maxHr?: number | null
  durationSeconds?: number
}

export function HrChart({ samples, avgHr, maxHr, durationSeconds }: Props) {
  const data = samples.map((bpm, i) => {
    const pct = durationSeconds ? (i / (samples.length - 1)) * durationSeconds : i
    return { t: pct, bpm }
  })

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
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickCount={tickCount}
            tickFormatter={formatX}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[minVal, maxVal]}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
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
              stroke="#ef4444"
              strokeDasharray="4 3"
              strokeOpacity={0.5}
              strokeWidth={1}
            />
          )}
          <Area
            type="monotone"
            dataKey="bpm"
            stroke="#ef4444"
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
