'use client'

import { BarChart, Bar, Cell, LabelList, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { HeatBand, HeatImpactData } from '@/application/usecases/GetHeatImpact'
import { CHART_COLORS, tempBandColor } from '@/lib/colors'
import { formatPace } from '@/lib/formatters'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { t } from '@/i18n'

// Below this the gap is inside the noise of week-to-week easy-pace variation.
const MEANINGFUL_COST_SEC = 3

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: HeatBand }>
  refHeartRate: number
}

function CustomTooltip({ active, payload, refHeartRate }: TooltipProps) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  const c = t.analytics.charts.heatImpact
  return (
    <TooltipCard label={d.label}>
      <TooltipRow color={tempBandColor(d.avgApparentTempC)} name={c.paceAtRefHr(refHeartRate)} value={formatPace(d.paceAtRefHr)} />
      <TooltipRow name={c.cost} value={d.costSecPerKm > 0 ? `+${d.costSecPerKm} ${c.unit}` : c.reference} />
      <p className="text-xs text-subtle">{t.common.runs(d.runCount)}</p>
    </TooltipCard>
  )
}

export function HeatImpactChart({ data }: { data: HeatImpactData }) {
  const c = t.analytics.charts.heatImpact
  const { bands, refHeartRate } = data

  const warmest = bands[bands.length - 1]!
  const reading =
    warmest.costSecPerKm >= MEANINGFUL_COST_SEC ? c.reading(warmest.label, warmest.costSecPerKm) : c.readingFlat

  const summary = `${c.title}: ${bands.map((b) => `${b.label} ${formatPace(b.paceAtRefHr)}`).join(', ')}`

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground/80">{c.title}</h3>
        <span className="shrink-0 text-xs text-subtle">{c.paceAtRefHr(refHeartRate)}</span>
      </div>
      <ChartFigure summary={summary}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={bands} layout="vertical" margin={{ top: 4, right: 56, bottom: 0, left: 4 }}>
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `+${v}`}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={58}
              tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip refHeartRate={refHeartRate} />} cursor={{ fill: 'transparent' }} />
            <Bar dataKey="costSecPerKm" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {bands.map((b) => (
                <Cell key={b.id} fill={tempBandColor(b.avgApparentTempC)} />
              ))}
              <LabelList
                dataKey="paceAtRefHr"
                position="right"
                formatter={(v) => (typeof v === 'number' ? formatPace(v) : '')}
                style={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFigure>
      <ChartExplain text={reading} />
      <p className="mt-2 text-xs text-subtle">{c.footnote(refHeartRate)}</p>
    </GlassSurface>
  )
}
