'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { TrainingLoadData, TrainingLoadPoint } from '@/application/usecases/GetTrainingLoad'
import { CHART_COLORS } from '@/lib/colors'
import { useHeadlineChartColor } from '@/lib/useAccent'
import { STATUS } from '@/lib/statusColors'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { ChartRangeChips, ChartWindowPager, trendDots, useChartWindow } from '@/components/ui/ChartWindowNav'
import { sampleForRange } from '@/domain/timeWindow'
import { t } from '@/i18n'

interface Props {
  data: TrainingLoadData
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: TrainingLoadPoint }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <TooltipCard label={p.label}>
      <p className="text-sm text-blue-500 dark:text-blue-400">{t.dashboard.trainingLoad.fitness} {Math.round(p.ctl)}</p>
      <p className="text-sm text-orange-500 dark:text-orange-400">{t.dashboard.trainingLoad.fatigue} {Math.round(p.atl)}</p>
      <p className="text-sm text-emerald-600 dark:text-emerald-400">{t.dashboard.trainingLoad.form} {Math.round(p.tsb)}</p>
    </TooltipCard>
  )
}

function LegendValue({ label, value, color, signed = false }: {
  label: string
  value: number
  color: string
  /** Form is a balance, so it reads as +20 / -20 rather than a bare 20. */
  signed?: boolean
}) {
  const rounded = Math.round(value)
  return (
    <span className="text-xs font-bold" style={{ color }}>
      {label} {signed && rounded > 0 ? '+' : ''}{rounded}
    </span>
  )
}

function formStatus(tsb: number): { label: string; className: string } {
  const s = t.dashboard.trainingLoad.status
  if (tsb > 5)   return { label: s.fresh,       className: STATUS.success.text }
  if (tsb >= -10) return { label: s.neutral,     className: 'text-muted-foreground' }
  if (tsb >= -30) return { label: s.building,    className: STATUS.warning.text }
  return           { label: s.overreaching,       className: STATUS.danger.text }
}

export function TrainingLoadChart({ data }: Props) {
  const status = formStatus(data.tsbNow)
  const formColor = useHeadlineChartColor()
  const { range, selectRange, bounds, visible, canGoBack, canGoForward, goBack, goForward } =
    useChartWindow(data.points)
  const plotted = sampleForRange(visible, range, 0)
  const summary = `${t.dashboard.trainingLoad.title}: ${t.dashboard.trainingLoad.fitness} ${Math.round(data.ctl)}, ${t.dashboard.trainingLoad.fatigue} ${Math.round(data.atl)}, ${t.dashboard.trainingLoad.form} ${Math.round(data.tsbNow)} (${status.label})`

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground/80">{t.dashboard.trainingLoad.title}</h3>
        <ChartRangeChips value={range} onChange={selectRange} />
      </div>

      <div className="mb-3 flex flex-wrap gap-x-3.5 gap-y-1">
        <LegendValue label={t.dashboard.trainingLoad.fitness} value={data.ctl} color={CHART_COLORS.ctl} />
        <LegendValue label={t.dashboard.trainingLoad.fatigue} value={data.atl} color={CHART_COLORS.atl} />
        <LegendValue label={t.dashboard.trainingLoad.form} value={data.tsbNow} color={formColor} signed />
      </div>

      <ChartWindowPager
        bounds={bounds}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onBack={goBack}
        onForward={goForward}
      />
      {visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-subtle">{t.chartWindow.empty}</p>
      ) : (
      <ChartFigure summary={summary}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={plotted} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke={CHART_COLORS.referenceLine} strokeWidth={1} />
            <Line type="monotone" dataKey="ctl" stroke={CHART_COLORS.ctl} strokeWidth={2.5} {...trendDots(CHART_COLORS.ctl)} isAnimationActive={false} />
            <Line type="monotone" dataKey="atl" stroke={CHART_COLORS.atl} strokeWidth={2.5} {...trendDots(CHART_COLORS.atl)} isAnimationActive={false} />
            <Line type="monotone" dataKey="tsb" stroke={formColor} strokeWidth={2.5} {...trendDots(formColor)} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFigure>
      )}
      <p className="mt-2 text-xs text-subtle">
        {t.dashboard.trainingLoad.footnote}
      </p>
    </GlassSurface>
  )
}
