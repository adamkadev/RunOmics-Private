'use client'

import { ComposedChart, Scatter, Line, ReferenceLine, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { RpeLoadPoint } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

const NEUTRAL_DOT = '#9ca3af' // gray-400, used when temperature is unknown

function linearRegression(pts: { x: number; y: number }[]): { slope: number; intercept: number } | null {
  const n = pts.length
  if (n < 5) return null
  const meanX = pts.reduce((s, p) => s + p.x, 0) / n
  const meanY = pts.reduce((s, p) => s + p.y, 0) / n
  const ssXX = pts.reduce((s, p) => s + (p.x - meanX) ** 2, 0)
  const ssXY = pts.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0)
  if (ssXX === 0) return null
  return { slope: ssXY / ssXX, intercept: meanY - (ssXY / ssXX) * meanX }
}

function tempColor(c: number): string {
  if (c < 10) return '#60a5fa' // blue-400
  if (c < 18) return '#34d399' // emerald-400
  if (c < 24) return '#fbbf24' // amber-400
  if (c < 30) return '#f97316' // orange-500
  return '#ef4444'             // red-500
}

function CustomDot(props: Record<string, unknown>) {
  const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: RpeLoadPoint }
  if (cx == null || cy == null || payload == null) return null
  const fill = payload.temp !== null ? tempColor(payload.temp) : NEUTRAL_DOT
  return <circle cx={cx} cy={cy} r={4} fill={fill} fillOpacity={0.65} stroke="none" />
}

function CustomTooltip({ active, payload }: {
  active?: boolean
  payload?: Array<{ payload: RpeLoadPoint }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const label = new Date(d.date + 'T12:00:00').toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
  const tc = t.analytics.charts.rpeLoadCorrelation.tooltip
  return (
    <TooltipCard label={`${t.activityTypes[d.type]} · ${label}`}>
      <TooltipRow name={tc.form} value={d.tsb} color={CHART_COLORS.tsb} />
      <TooltipRow name={tc.rpe} value={d.rpe} />
      <TooltipRow name={tc.delta} value={d.rpeDelta > 0 ? `+${d.rpeDelta}` : d.rpeDelta} />
      {d.temp !== null && <TooltipRow name={tc.temp} value={`${d.temp}°C`} color={tempColor(d.temp)} />}
    </TooltipCard>
  )
}

interface Props {
  data: RpeLoadPoint[]
}

export function RpeLoadCorrelationChart({ data }: Props) {
  const pts = data.map((d) => ({ x: d.tsb, y: d.rpeDelta }))
  const reg = linearRegression(pts)

  const tsbs = data.map((d) => d.tsb)
  const minTsb = Math.min(...tsbs)
  const maxTsb = Math.max(...tsbs)

  const trendLine = reg
    ? [
        { tsb: minTsb, rpeDelta: reg.slope * minTsb + reg.intercept },
        { tsb: maxTsb, rpeDelta: reg.slope * maxTsb + reg.intercept },
      ]
    : []

  const dropPer10 = reg ? Math.round(reg.slope * -10 * 10) / 10 : 0
  const ex = t.analytics.charts.rpeLoadCorrelation.explains

  return (
    <GlassSurface variant="card" className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        {t.analytics.charts.rpeLoadCorrelation.title}
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <XAxis
            type="number"
            dataKey="tsb"
            domain={['auto', 'auto']}
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="number"
            dataKey="rpeDelta"
            domain={['auto', 'auto']}
            tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => (v > 0 ? `+${v}` : `${v}`)}
            width={28}
          />
          <Tooltip content={<CustomTooltip />} cursor={false} />
          <ReferenceLine y={0} stroke={CHART_COLORS.referenceLine} />
          <Scatter
            data={data}
            shape={<CustomDot />}
            isAnimationActive={false}
          />
          {trendLine.length === 2 && (
            <Line
              data={trendLine}
              type="linear"
              dataKey="rpeDelta"
              stroke={CHART_COLORS.axisTick}
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      {reg && (
        <ChartExplain
          text={dropPer10 > 0.3 ? ex.harder(dropPer10) : ex.stable}
          tone={dropPer10 > 0.3 ? 'caution' : 'neutral'}
        />
      )}
      <p className="mt-1 text-xs text-subtle">
        {t.analytics.charts.rpeLoadCorrelation.footnote}
      </p>
    </GlassSurface>
  )
}
