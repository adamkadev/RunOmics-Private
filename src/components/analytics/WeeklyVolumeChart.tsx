'use client'

import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { useAccentUiColor } from '@/lib/useAccent'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { WindowedChartCard, windowDateAxis, windowTickDate, windowTickMonth, windowTicks } from '@/components/ui/ChartWindowNav'
import { fillWeeklyGaps, monthStartTicks } from '@/domain/timeWindow'
import { isoDate, startOfWeek } from '@/lib/calendarDate'
import { t } from '@/i18n'

const MAX_DOTTED_POINTS = 14

const MAX_DATE_LABELLED_POINTS = 10

const BLANK_WEEK: Omit<WeeklyTrendPoint, 'date' | 'label'> = {
  distanceKm: 0,
  sessionCount: 0,
  easyPace: null,
  hardPace: null,
  ef: null,
  efAdjusted: null,
  apparentTempC: null,
  easyAvgHr: null,
  hardAvgHr: null,
  cadenceSpm: null,
  groundContactMs: null,
  verticalOscillationMm: null,
  verticalRatioPct: null,
  strideLengthM: null,
  avgRpe: null,
  aer: null,
  ana: null,
  zoneSeconds: {},
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: WeeklyTrendPoint }>
}

function CustomTooltip({ active, payload, currentWeekDate }: TooltipProps & { currentWeekDate: string }) {
  const first = payload?.[0]
  if (!active || !first) return null

  const week = first.payload
  const c = t.analytics.charts.weeklyVolume
  return (
    <TooltipCard label={week.date === currentWeekDate ? c.weekOfInProgress(week.label) : c.weekOf(week.label)}>
      <p className="text-sm font-semibold text-foreground">
        {week.distanceKm} {t.units.km}
      </p>
      <TooltipRow name={c.sessions} value={week.sessionCount} />
    </TooltipCard>
  )
}

export function WeeklyVolumeChart({ points }: { points: WeeklyTrendPoint[] }) {
  const accentColor = useAccentUiColor()

  if (!points.some((p) => p.distanceKm > 0)) return null

  const weeks = fillWeeklyGaps(points, (monday) => ({
    ...BLANK_WEEK,
    date: monday,
    label: new Date(monday + 'T00:00:00').toLocaleDateString(t.locale, { day: 'numeric', month: 'short' }),
  }))

  const currentWeekDate = isoDate(startOfWeek(new Date()))

  return (
    <WindowedChartCard
      title={t.analytics.charts.weeklyVolume.title}
      points={weeks}
      sample={false}
      footnote={t.analytics.charts.weeklyVolume.footnote}
    >
      {(visible) => {
        const complete = visible.filter((w) => w.date !== currentWeekDate)
        const c = t.analytics.charts.weeklyVolume

        const byMonth = visible.length > MAX_DATE_LABELLED_POINTS
        const ticks = byMonth ? monthStartTicks(visible) : windowTicks(visible)
        const tickLabel = byMonth ? windowTickMonth : windowTickDate

        const average = complete.length
          ? Math.round(complete.reduce((sum, w) => sum + w.distanceKm, 0) / complete.length)
          : 0

        const last = complete[complete.length - 1]
        const delta = last && complete.length > 1 ? last.distanceKm - average : null
        const explain =
          delta === null
            ? null
            : Math.abs(delta) < 3
              ? c.explains.steady(average)
              : delta > 0
                ? c.explains.up(delta, average)
                : c.explains.down(Math.abs(delta), average)

        const totals = visible.map((w) => w.distanceKm)
        const summary = `${c.title}: ${Math.min(...totals)}-${Math.max(...totals)} ${t.units.km}${explain ? `. ${explain}` : ''}`
        const dotted = visible.length <= MAX_DOTTED_POINTS

        return (
          <>
            <ChartFigure summary={summary}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={visible} margin={{ top: 4, right: 18, bottom: 0, left: -8 }}>
                  <defs>
                    <linearGradient id="weeklyVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={accentColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={accentColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis {...windowDateAxis(ticks, tickLabel)} interval={0} />
                  <YAxis
                    tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                    axisLine={false}
                    tickLine={false}
                    unit={` ${t.units.km}`}
                  />
                  <Tooltip
                    content={<CustomTooltip currentWeekDate={currentWeekDate} />}
                    cursor={{ stroke: accentColor, strokeWidth: 1, strokeDasharray: '4 3' }}
                  />
                  {average > 0 && (
                    <ReferenceLine
                      y={average}
                      stroke={CHART_COLORS.referenceTarget}
                      strokeDasharray="4 3"
                      strokeWidth={1}
                    />
                  )}
                  {visible.some((w) => w.date === currentWeekDate) && (
                    <ReferenceLine
                      x={currentWeekDate}
                      stroke={accentColor}
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="distanceKm"
                    stroke={accentColor}
                    strokeWidth={3}
                    fill="url(#weeklyVolumeGradient)"
                    dot={dotted ? { r: 3, fill: accentColor, strokeWidth: 0 } : false}
                    activeDot={{ r: 4, fill: accentColor, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartFigure>
            {explain && <ChartExplain text={explain} />}
          </>
        )
      }}
    </WindowedChartCard>
  )
}
