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
  avgA?: number | null
  avgB?: number | null
}

function kmTicks(distanceKm: number): number[] {
  const step = distanceKm <= 3 ? 1 : distanceKm <= 20 ? 2 : distanceKm <= 50 ? 5 : 10
  return Array.from({ length: Math.floor(distanceKm / step) + 1 }, (_, i) => i * step)
}

const CADENCE_CAP = 100
const CADENCE_TICKS = [CADENCE_CAP, 120, 140, 160, 180]
const CADENCE_DOMAIN: [number, number] = [90, 200]

function formatCadenceTick(v: number): string {
  return v === CADENCE_CAP ? '<100' : String(v)
}

function clampCadence(v: number | null): number | undefined {
  return v != null ? Math.max(v, CADENCE_CAP) : undefined
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number }>
  label?: number
  colorA?: string
  colorB?: string
}

function CustomTooltip({ active, payload, label, colorA, colorB }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <TooltipCard label={label != null ? `${label.toFixed(1)} km` : undefined}>
      {payload.map((p) => (
        <TooltipRow
          key={p.dataKey}
          color={p.dataKey === 'a' ? colorA : colorB}
          name={p.dataKey === 'a' ? 'A' : 'B'}
          value={p.value <= CADENCE_CAP ? `<100 ${t.units.spm}` : `${Math.round(p.value)} ${t.units.spm}`}
        />
      ))}
    </TooltipCard>
  )
}

export function CadenceCompareChart({ samplesA, samplesB, distanceA, distanceB, avgA, avgB }: Props) {
  const minDistance = Math.min(distanceA, distanceB)
  const data = buildCompareSeries(samplesA, distanceA, samplesB, distanceB).map((p) => ({
    d: p.d,
    a: clampCadence(p.a),
    b: clampCadence(p.b),
  }))

  return (
    <Card padding="lg">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">{t.activity.charts.cadence}</h3>
        <span className="flex items-center gap-2 text-xs text-subtle">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.cadence }} />
            {avgA != null ? Math.round(avgA) : '-'}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.cadenceLight }} />
            {avgB != null ? Math.round(avgB) : '-'}
          </span>
          {' '}{t.units.spm}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={140} className="select-none touch-pan-y">
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
            domain={CADENCE_DOMAIN}
            ticks={CADENCE_TICKS}
            interval={0}
            tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={formatCadenceTick}
          />
          <Tooltip content={<CustomTooltip colorA={CHART_COLORS.cadence} colorB={CHART_COLORS.cadenceLight} />} />
          <Line
            type="monotone"
            dataKey="a"
            stroke={CHART_COLORS.cadence}
            strokeWidth={1.5}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="b"
            stroke={CHART_COLORS.cadenceLight}
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
