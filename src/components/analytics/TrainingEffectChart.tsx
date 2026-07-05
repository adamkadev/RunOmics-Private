'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { MonthlyTrainingEffect } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { t } from '@/i18n'

interface Props {
  data: MonthlyTrainingEffect[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <TooltipCard label={label}>
      {payload.map((p) => (
        <p key={p.name} className="text-xs font-semibold" style={{ color: p.color }}>
          {p.name} {p.value.toFixed(1)}
        </p>
      ))}
    </TooltipCard>
  )
}

export function TrainingEffectChart({ data }: Props) {
  const hasAer = data.some((d) => d.aer !== null)
  const hasAna = data.some((d) => d.ana !== null)
  if (!hasAer && !hasAna) return null

  const aerVals = data.map((d) => d.aer).filter((v): v is number => v !== null)
  const anaVals = data.map((d) => d.ana).filter((v): v is number => v !== null)
  const summaryParts = []
  if (aerVals.length) summaryParts.push(`${t.analytics.charts.trainingEffect.aerobic} ${Math.min(...aerVals).toFixed(1)}–${Math.max(...aerVals).toFixed(1)}`)
  if (anaVals.length) summaryParts.push(`${t.analytics.charts.trainingEffect.anaerobic} ${Math.min(...anaVals).toFixed(1)}–${Math.max(...anaVals).toFixed(1)}`)
  const summary = `${t.analytics.charts.trainingEffect.title}: ${summaryParts.join(', ')}`

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">{t.analytics.charts.trainingEffect.title}</h3>
        <div className="flex gap-3">
          {hasAer && (
            <span className="flex items-center gap-1 text-xs text-subtle">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.easy }} />
              {t.analytics.charts.trainingEffect.aerobic}
            </span>
          )}
          {hasAna && (
            <span className="flex items-center gap-1 text-xs text-subtle">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.hard }} />
              {t.analytics.charts.trainingEffect.anaerobic}
            </span>
          )}
        </div>
      </div>
      <ChartFigure summary={summary}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 5]}
              ticks={[1, 2, 3, 4, 5]}
              tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip content={<CustomTooltip />} />
            {hasAer && (
              <Line
                type="monotone"
                dataKey="aer"
                name={t.analytics.charts.trainingEffect.aerobic}
                stroke={CHART_COLORS.easy}
                strokeWidth={2}
                dot={{ r: 3, fill: CHART_COLORS.easy, strokeWidth: 0 }}
                connectNulls
                isAnimationActive={false}
              />
            )}
            {hasAna && (
              <Line
                type="monotone"
                dataKey="ana"
                name={t.analytics.charts.trainingEffect.anaerobic}
                stroke={CHART_COLORS.hard}
                strokeWidth={2}
                dot={{ r: 3, fill: CHART_COLORS.hard, strokeWidth: 0 }}
                connectNulls
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </ChartFigure>
      <p className="mt-2 text-xs text-subtle">{t.analytics.charts.trainingEffect.footnote}</p>
    </GlassSurface>
  )
}
