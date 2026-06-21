'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS } from '@/lib/colors'
import { buildCompareSeries } from '@/lib/compareChart'
import { Card } from '@/components/ui/Card'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { t } from '@/i18n'

interface Props {
  samplesA: number[]
  samplesB: number[]
  distanceA: number
  distanceB: number
}

function kmTicks(distanceKm: number): number[] {
  const step = distanceKm <= 3 ? 1 : distanceKm <= 20 ? 2 : distanceKm <= 50 ? 5 : 10
  return Array.from({ length: Math.floor(distanceKm / step) + 1 }, (_, i) => i * step)
}

const ELEV_STEPS = [5, 10, 15, 20, 25, 50, 100]

function elevationTicks(values: number[]): { ticks: number[]; domain: [number, number] } {
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const range = rawMax - rawMin
  const step = ELEV_STEPS.find((s) => range / s <= 8) ?? 100
  const firstTick = Math.floor(rawMin / 5) * 5
  const lastTick = Math.ceil(rawMax / step) * step
  const ticks: number[] = []
  for (let v = firstTick; v <= lastTick; v += step) ticks.push(v)
  return { ticks, domain: [firstTick - step * 0.5, lastTick + step * 0.5] }
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number }>
  label?: number
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <TooltipCard label={label != null ? `${label.toFixed(1)} km` : undefined}>
      {payload.map((p) => (
        <TooltipRow
          key={p.dataKey}
          color={p.dataKey === 'a' ? CHART_COLORS.elevation : CHART_COLORS.elevationLight}
          name={p.dataKey === 'a' ? 'A' : 'B'}
          value={`${Math.round(p.value)} ${t.units.m}`}
        />
      ))}
    </TooltipCard>
  )
}

export function ElevationCompareChart({ samplesA, samplesB, distanceA, distanceB }: Props) {
  const minDistance = Math.min(distanceA, distanceB)
  const series = buildCompareSeries(samplesA, distanceA, samplesB, distanceB)
  const data = series.map((p) => ({
    d: p.d,
    a: p.a != null ? Math.round(p.a) : undefined,
    b: p.b != null ? Math.round(p.b) : undefined,
  }))

  const allValues = series.flatMap((p) => [p.a, p.b]).filter((v): v is number => v != null)
  const { ticks: elevTicks, domain: elevDomain } = elevationTicks(allValues)

  return (
    <Card padding="lg">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">{t.activity.charts.elevation}</h3>
        <span className="flex items-center gap-2 text-xs text-subtle">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.elevation }} />
            A
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.elevationLight }} />
            B
          </span>
        </span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="d"
            type="number"
            domain={[0, minDistance]}
            ticks={kmTicks(minDistance)}
            tickFormatter={(v) => (v === 0 ? '' : `${v} km`)}
            tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={elevDomain}
            ticks={elevTicks}
            interval={0}
            tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
            width={46}
            tickFormatter={(v: number) => `${v}m`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="a"
            stroke={CHART_COLORS.elevation}
            strokeWidth={1.5}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="b"
            stroke={CHART_COLORS.elevationLight}
            strokeWidth={1.5}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}
