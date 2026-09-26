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
import { CHART_COLORS, TRAINING_METRIC_COLORS } from '@/lib/colors'
import { STATUS } from '@/lib/statusColors'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartCardHead, LegendValue } from '@/components/ui/ChartCard'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { ChartRangeChips, ChartWindowPager, trendDots, useChartWindow } from '@/components/ui/ChartWindowNav'
import { lineInterpolation, sampleForRange } from '@/domain/timeWindow'
import { t } from '@/i18n'
import { formBand, type FormBand } from '@/domain/training/formBand'

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
      <p className="text-sm text-[var(--metric-form)]">{t.dashboard.trainingLoad.form} {Math.round(p.tsb)}</p>
    </TooltipCard>
  )
}

// The same named bands as Today's Body card (domain/training/formBand), so a
// Form of -12 is "tired" on both screens.
const FORM_BAND_CLASS: Record<FormBand, string> = {
  tired: STATUS.warning.text,
  neutral: 'text-muted-foreground',
  fresh: STATUS.success.text,
  veryFresh: STATUS.warning.text,
}

function formStatus(tsb: number): { label: string; className: string } {
  const band = formBand(tsb)
  return { label: t.formBand[band], className: FORM_BAND_CLASS[band] }
}

export function TrainingLoadChart({ data }: Props) {
  const status = formStatus(data.tsbNow)
  // Form is a metric, not a highlight: it takes its own token, the way Fitness
  // and Fatigue beside it do. Drawn in the accent it moved whenever the user
  // changed theme, and on a blue accent it was Fitness twice.
  const formColor = TRAINING_METRIC_COLORS.form
  const { range, selectRange, bounds, visible, canGoBack, canGoForward, goBack, goForward } =
    useChartWindow(data.points)
  const plotted = sampleForRange(visible, range, 0)
  const summary = `${t.dashboard.trainingLoad.title}: ${t.dashboard.trainingLoad.fitness} ${Math.round(data.ctl)}, ${t.dashboard.trainingLoad.fatigue} ${Math.round(data.atl)}, ${t.dashboard.trainingLoad.form} ${Math.round(data.tsbNow)} (${status.label})`

  return (
    <GlassSurface variant="card" className="p-5">
      <ChartCardHead
        title={t.dashboard.trainingLoad.title}
        unit={t.analytics.model.runomics}
        footnote={t.dashboard.trainingLoad.footnote}
        controls={<ChartRangeChips value={range} onChange={selectRange} />}
      />

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
            <Line type={lineInterpolation(plotted.length)} dataKey="ctl" stroke={CHART_COLORS.ctl} strokeWidth={2.5} {...trendDots(CHART_COLORS.ctl)} isAnimationActive={false} />
            <Line type={lineInterpolation(plotted.length)} dataKey="atl" stroke={CHART_COLORS.atl} strokeWidth={2.5} {...trendDots(CHART_COLORS.atl)} isAnimationActive={false} />
            <Line type={lineInterpolation(plotted.length)} dataKey="tsb" stroke={formColor} strokeWidth={2.5} {...trendDots(formColor)} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFigure>
      )}
    </GlassSurface>
  )
}
