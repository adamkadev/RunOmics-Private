'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { ThresholdHistoryData, ThresholdPoint } from '@/application/usecases/GetThresholdHistory'
import { CHART_COLORS } from '@/lib/colors'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { formatPace } from '@/lib/formatters'
import { t } from '@/i18n'

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: ThresholdPoint }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  const s = t.analytics.charts.threshold

  return (
    <TooltipCard label={point.label}>
      {point.thresholdPaceSecPerKm !== null && (
        <TooltipRow color={CHART_COLORS.pace} name={s.pace} value={formatPace(point.thresholdPaceSecPerKm)} />
      )}
      {point.lthrBpm !== null && (
        <TooltipRow color={CHART_COLORS.hr} name={s.lthr} value={`${point.lthrBpm} ${t.units.bpm}`} />
      )}
    </TooltipCard>
  )
}

export function ThresholdChart({ data }: { data: ThresholdHistoryData }) {
  const s = t.analytics.charts.threshold

  const paces = data.points.map((p) => p.thresholdPaceSecPerKm).filter((v): v is number => v !== null)
  if (paces.length < 2) return null

  const min = Math.floor(Math.min(...paces)) - 4
  const max = Math.ceil(Math.max(...paces)) + 4

  const reading =
    data.paceGainSec === null || data.paceGainSec === 0
      ? s.reading.flat
      : data.paceGainSec > 0
        ? s.reading.faster(Math.round(data.paceGainSec))
        : s.reading.slower(Math.abs(Math.round(data.paceGainSec)))

  const summary = `${s.title}: ${data.latestPace !== null ? formatPace(data.latestPace) : '–'}${
    data.latestLthr !== null ? `, ${data.latestLthr} ${t.units.bpm}` : ''
  }`

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground/80">{s.title}</h3>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-subtle">
          {data.latestPace !== null && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.pace }} />
              {s.pace}
              <span className="font-semibold text-foreground/80">{formatPace(data.latestPace)}</span>
            </span>
          )}
          {data.latestLthr !== null && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.hr }} />
              {s.lthr}
              <span className="font-semibold text-foreground/80">
                {data.latestLthr} {t.units.bpm}
              </span>
            </span>
          )}
        </div>
      </div>

      <ChartFigure summary={summary}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data.points} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              domain={[min, max]}
              reversed
              tickFormatter={(v: number) => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}`}
              tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              width={46}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="thresholdPaceSecPerKm"
              stroke={CHART_COLORS.pace}
              strokeWidth={3}
              dot={{ r: 3, fill: CHART_COLORS.pace, strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartFigure>

      <ChartExplain text={reading} />
      <p className="mt-2 text-xs text-subtle">{s.footnote}</p>
    </GlassSurface>
  )
}
