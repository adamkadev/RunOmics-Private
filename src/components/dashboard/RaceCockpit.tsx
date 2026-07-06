'use client'

import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { FormProjection, ProjectionVerdict } from '@/application/usecases/GetFormProjection'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { CHART_COLORS } from '@/lib/colors'
import { t } from '@/i18n'

const VERDICT_TONE: Record<ProjectionVerdict, StatusTone> = {
  'on-track': 'blue',
  'ease-off': 'amber',
  'peak-ready': 'green',
  'build-more': 'amber',
}

interface ChartPoint {
  date: string
  label: string
  histTsb?: number
  projTsb?: number
  band?: [number, number]
}

function formatLabel(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString(t.locale, { day: 'numeric', month: 'short' })
}

function buildChartData(data: FormProjection): ChartPoint[] {
  const historyCount = data.points.filter((p) => !p.isProjected).length
  return data.points.map((p, i) => ({
    date: p.date,
    label: formatLabel(p.date),
    histTsb: !p.isProjected ? p.tsb : undefined,
    projTsb: p.isProjected || i === historyCount - 1 ? p.tsb : undefined,
    band: p.isProjected && p.tsbLow !== undefined && p.tsbHigh !== undefined ? [p.tsbLow, p.tsbHigh] : undefined,
  }))
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: ChartPoint }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  const value = p.histTsb ?? p.projTsb
  if (value === undefined) return null
  return (
    <TooltipCard label={p.label}>
      <p className="text-sm" style={{ color: CHART_COLORS.tsb }}>
        {t.dashboard.trainingLoad.form} {value}
        {p.projTsb !== undefined && p.histTsb === undefined ? ` (${t.dashboard.raceCockpit.projected})` : ''}
      </p>
    </TooltipCard>
  )
}

export function RaceCockpit({ data }: { data: FormProjection }) {
  const s = t.dashboard.raceCockpit
  const chartData = buildChartData(data)
  const title = data.isRaceTarget && data.raceName ? s.titleWithRace(data.raceName) : s.title
  const summary = `${title}: ${s.projectedForm} ${data.projectedTsb} (${data.projectedTsbLow} to ${data.projectedTsbHigh}), ${s.verdict[data.verdict]}`

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground/80">{title}</h3>
        <span className="rounded-full bg-blue-500/[0.14] px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
          {s.daysToTarget(data.horizonDays)}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <span className="text-title2 font-extrabold tabular-nums text-foreground">
          {data.projectedTsb >= 0 ? '+' : ''}
          {data.projectedTsb}
        </span>
        <span className="text-xs text-subtle">
          ({data.projectedTsbLow >= 0 ? '+' : ''}
          {data.projectedTsbLow} – {data.projectedTsbHigh >= 0 ? '+' : ''}
          {data.projectedTsbHigh})
        </span>
        <StatusPill tone={VERDICT_TONE[data.verdict]}>{s.verdict[data.verdict]}</StatusPill>
      </div>

      <ChartFigure summary={summary}>
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              minTickGap={30}
            />
            <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke={CHART_COLORS.referenceLine} strokeWidth={1} />
            <Area
              dataKey="band"
              stroke="none"
              fill={CHART_COLORS.tsb}
              fillOpacity={0.12}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="histTsb"
              stroke={CHART_COLORS.tsb}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="projTsb"
              stroke={CHART_COLORS.tsb}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFigure>
      <p className="mt-2 text-xs text-subtle">{s.footnote}</p>
    </GlassSurface>
  )
}
