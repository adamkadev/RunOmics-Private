'use client'

import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { WeeklyVolumePoint } from '@/application/usecases/GetWeeklyVolume'
import { CHART_COLORS } from '@/lib/colors'
import { useAccentUiColor } from '@/lib/useAccent'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { WindowedChartCard, windowTickDate, windowTicks } from '@/components/ui/ChartWindowNav'
import { withAlpha } from '@/lib/palette'
import { isoDate, startOfWeek } from '@/lib/calendarDate'
import { t } from '@/i18n'

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: WeeklyVolumePoint }>
}

function CustomTooltip({ active, payload, currentWeekDate }: TooltipProps & { currentWeekDate: string }) {
  const first = payload?.[0]
  if (!active || !first) return null

  const week = first.payload
  const c = t.dashboard.weeklyVolume
  return (
    <TooltipCard label={week.date === currentWeekDate ? c.weekOfInProgress(week.label) : c.weekOf(week.label)}>
      <p className="text-sm font-semibold text-foreground">
        {week.distanceKm} {t.units.km}
      </p>
      <TooltipRow name={c.sessions} value={week.sessionCount} />
    </TooltipCard>
  )
}

export function WeeklyVolumeChart({ points }: { points: WeeklyVolumePoint[] }) {
  const accentColor = useAccentUiColor()

  if (!points.some((p) => p.distanceKm > 0)) return null

  // The week in progress is a partial total, so it is drawn hollow and left out
  // of the average: counting a Tuesday against seven full weeks would drag the
  // reference line down every Monday and read as a drop that has not happened.
  const currentWeekDate = isoDate(startOfWeek(new Date()))

  return (
    <WindowedChartCard
      title={t.dashboard.weeklyVolume.title}
      points={points}
      // Every bar is one week, and the point of this chart is the week-to-week
      // shape: bucketing a six-month window into six averaged bars would erase
      // exactly the down weeks and spikes it exists to show.
      sample={false}
      footnote={t.dashboard.weeklyVolume.footnote}
    >
      {(visible) => {
        const complete = visible.filter((w) => w.date !== currentWeekDate)
        const ticks = windowTicks(visible)
        const c = t.dashboard.weeklyVolume

        // One average for the whole card - the dashed line and the reading below
        // it are the same number. Computing the reading against "every week
        // except the last" instead put two different averages on one chart.
        const average = complete.length
          ? Math.round(complete.reduce((sum, w) => sum + w.distanceKm, 0) / complete.length)
          : 0

        // Read the last finished week against that line - "how does my week
        // compare" is the question this chart is opened with.
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

        return (
          <>
            <ChartFigure summary={summary}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={visible} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                    axisLine={false}
                    tickLine={false}
                    // Every category reaches the formatter, which blanks all but
                    // the spaced-out dates. Left to its own interval Recharts
                    // picks a subset of the 52 weekly bars first, and a year
                    // window can land on nothing but blanked ones - no labels.
                    interval={0}
                    tickFormatter={(date: string) => (ticks.has(date) ? windowTickDate(date) : '')}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                    axisLine={false}
                    tickLine={false}
                    unit={` ${t.units.km}`}
                  />
                  <Tooltip
                    content={<CustomTooltip currentWeekDate={currentWeekDate} />}
                    cursor={{ fill: CHART_COLORS.tooltipCursor }}
                  />
                  {/* Deliberately unlabelled: an inline "avg 41 km" sits exactly
                      where the most recent bars are and collides with them on a
                      phone. The footnote names the line, the reading gives the
                      number. */}
                  {average > 0 && (
                    <ReferenceLine
                      y={average}
                      stroke={CHART_COLORS.referenceTarget}
                      strokeDasharray="4 3"
                      strokeWidth={1}
                    />
                  )}
                  <Bar dataKey="distanceKm" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                    {visible.map((week) => (
                      <Cell
                        key={week.date}
                        fill={week.date === currentWeekDate ? withAlpha(accentColor, 0.35) : accentColor}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartFigure>
            {explain && <ChartExplain text={explain} />}
          </>
        )
      }}
    </WindowedChartCard>
  )
}
