'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { DailyRunningDynamics } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { t } from '@/i18n'

type Metric = 'cadence' | 'groundContact' | 'verticalOscillation'

const METRICS: Metric[] = ['cadence', 'groundContact', 'verticalOscillation']

const KEY_7: Record<Metric, keyof DailyRunningDynamics> = {
  cadence: 'cadence7',
  groundContact: 'groundContact7',
  verticalOscillation: 'verticalOscillation7',
}

const KEY_30: Record<Metric, keyof DailyRunningDynamics> = {
  cadence: 'cadence30',
  groundContact: 'groundContact30',
  verticalOscillation: 'verticalOscillation30',
}

const COLOR: Record<Metric, string> = {
  cadence: CHART_COLORS.cadence,
  groundContact: CHART_COLORS.groundContact,
  verticalOscillation: CHART_COLORS.verticalOscillation,
}

const ACTIVE_PILL_CLASS: Record<Metric, string> = {
  cadence: 'bg-sky-500 text-white',
  groundContact: 'bg-amber-500 text-white',
  verticalOscillation: 'bg-rose-500 text-white',
}

const TICK_DECIMALS: Record<Metric, number> = {
  cadence: 0,
  groundContact: 0,
  verticalOscillation: 1,
}

interface Props {
  data: DailyRunningDynamics[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number }>
  label?: string
  metric: Metric
}

// Appends ~50% alpha to a 6-digit hex color, to match the faded 7-day line/legend.
function faded(hex: string): string {
  return `${hex}80`
}

function CustomTooltip({ active, payload, label, metric }: TooltipProps) {
  if (!active || !payload?.length) return null
  const s = t.analytics.charts.runningDynamicsRolling
  return (
    <TooltipCard label={label}>
      {payload.map((p) => {
        const is7Day = p.dataKey === KEY_7[metric]
        return (
          <TooltipRow
            key={p.dataKey}
            color={is7Day ? faded(COLOR[metric]) : COLOR[metric]}
            name={is7Day ? s.d7 : s.d30}
            value={`${p.value.toFixed(TICK_DECIMALS[metric])} ${s.unit[metric]}`}
          />
        )
      })}
    </TooltipCard>
  )
}

export function RunningDynamicsTrendChart({ data }: Props) {
  const available = METRICS.filter((m) => data.some((d) => d[KEY_30[m]] !== null))
  const [metric, setMetric] = useState<Metric | null>(available[0] ?? null)
  if (!metric) return null

  const s = t.analytics.charts.runningDynamicsRolling
  const key7 = KEY_7[metric]
  const key30 = KEY_30[metric]
  const color = COLOR[metric]
  const values = data.flatMap((d) => [d[key7], d[key30]]).filter((v): v is number => v !== null)
  const min = Math.min(...values) * 0.97
  const max = Math.max(...values) * 1.03

  // Show one label per ~2 weeks to avoid clutter (90 days = ~7 labels)
  const tickDates = new Set(
    data.filter((_, i) => i % 14 === 0).map((d) => d.date)
  )

  const decimals = TICK_DECIMALS[metric]
  const summary = `${s.title}: ${s.metrics[metric]} ${Math.min(...values).toFixed(decimals)}–${Math.max(...values).toFixed(decimals)} ${s.unit[metric]}`
  const values30 = data.map((d) => d[key30]).filter((v): v is number => v !== null)
  const reading = t.analytics.charts.runningDynamicsRolling.reading[metric]!(
    Math.min(...values30).toFixed(decimals),
    Math.max(...values30).toFixed(decimals),
  )

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground/80">{s.title}</h3>
        <div className="flex gap-1">
          {available.map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                m === metric ? ACTIVE_PILL_CLASS[m] : 'border border-border bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              {s.metrics[m]}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-2 flex gap-3">
        <span className="flex items-center gap-1 text-xs text-subtle">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, opacity: 0.5 }} />
          {s.d7}
        </span>
        <span className="flex items-center gap-1 text-xs text-subtle">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          {s.d30}
        </span>
      </div>
      <ChartFigure summary={summary}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(date: string) => {
                if (!tickDates.has(date)) return ''
                const d = new Date(date + 'T00:00:00')
                return d.toLocaleDateString(t.locale, { day: 'numeric', month: 'short' })
              }}
            />
            <YAxis
              domain={[min, max]}
              tickFormatter={(v: number) => v.toFixed(TICK_DECIMALS[metric])}
              tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              width={42}
            />
            <Tooltip content={<CustomTooltip metric={metric} />} />
            <Line
              type="monotone"
              dataKey={key7}
              stroke={color}
              strokeOpacity={0.5}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: color, fillOpacity: 0.5, stroke: color, strokeOpacity: 0.5 }}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey={key30}
              stroke={color}
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 4, fill: color, stroke: color }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartFigure>
      <ChartExplain text={reading} />
      <p className="mt-2 text-xs text-subtle">{s.footnote[metric]}</p>
    </GlassSurface>
  )
}
