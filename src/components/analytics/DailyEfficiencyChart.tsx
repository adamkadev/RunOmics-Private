'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { DailyEfficiency } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { t } from '@/i18n'

const COLOR_7  = CHART_COLORS.efficiency        // violet-500
const COLOR_30 = CHART_COLORS.brand             // emerald-500

interface TooltipProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; stroke: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  const s = t.analytics.charts.efficiencyRolling
  return (
    <TooltipCard label={label}>
      {payload.map((p) => (
        <TooltipRow
          key={p.dataKey}
          color={p.stroke}
          name={p.dataKey === 'ef7' ? s.ef7 : s.ef30}
          value={`${p.value.toFixed(2)} ${s.unit}`}
        />
      ))}
    </TooltipCard>
  )
}

export function DailyEfficiencyChart({ data }: { data: DailyEfficiency[] }) {
  const allValues = data.flatMap((d) => [d.ef7, d.ef30]).filter((v): v is number => v !== null)
  if (!allValues.length) return null

  const s = t.analytics.charts.efficiencyRolling
  const min = Math.floor(Math.min(...allValues) * 10) / 10 - 0.05
  const max = Math.ceil(Math.max(...allValues) * 10) / 10 + 0.05

  // Show one label per ~2 weeks to avoid clutter (90 days = ~13 labels)
  const tickDates = new Set(
    data.filter((_, i) => i % 14 === 0).map((d) => d.date)
  )

  const summary = `${s.title}: ${min.toFixed(2)}–${max.toFixed(2)} ${s.unit}`

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">{s.title}</h3>
        <div className="flex gap-3">
          <span className="flex items-center gap-1 text-xs text-subtle">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_7 }} />
            {s.ef7}
          </span>
          <span className="flex items-center gap-1 text-xs text-subtle">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_30 }} />
            {s.ef30}
          </span>
        </div>
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
              tickFormatter={(v: number) => v.toFixed(1)}
              tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              width={42}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="ef7"
              stroke={COLOR_7}
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="ef30"
              stroke={COLOR_30}
              strokeWidth={2.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartFigure>
      <p className="mt-2 text-xs text-subtle">{s.footnote}</p>
    </GlassSurface>
  )
}
