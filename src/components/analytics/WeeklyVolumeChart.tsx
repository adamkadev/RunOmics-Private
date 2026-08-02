'use client'

import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import { CHART_COLORS } from '@/lib/colors'
import { useAccentUiColor } from '@/lib/useAccent'
import { TooltipCard, TooltipRow } from '@/components/ui/ChartTooltip'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { WindowedChartCard, windowTickDate, windowTickMonth, windowTicks } from '@/components/ui/ChartWindowNav'
import { fillWeeklyGaps, monthStartTicks } from '@/domain/timeWindow'
import { isoDate, startOfWeek } from '@/lib/calendarDate'
import { t } from '@/i18n'

// Past this many points the per-week dots stop marking readings and start
// reading as a dotted band: a year is 52 of them on a phone-width card.
const MAX_DOTTED_POINTS = 14

// Past roughly two months of weeks, "6 juil." stops being a useful landmark and
// the axis wants months instead. 4w (4 points) keeps dates - there the day is
// the whole point; 6m and 1y switch over.
const MAX_DATE_LABELLED_POINTS = 10

// A week nothing was run. Only the volume fields carry a real zero: there is no
// pace or heart rate to average over no runs, so the rest stay null exactly as
// they would on a week the athlete did not record them.
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

  // A week off never reaches the series, so without this a layoff is drawn as
  // one step between the weeks either side of it and the average is taken over
  // the weeks that happened rather than the weeks that passed.
  const weeks = fillWeeklyGaps(points, (monday) => ({
    ...BLANK_WEEK,
    date: monday,
    label: new Date(monday + 'T00:00:00').toLocaleDateString(t.locale, { day: 'numeric', month: 'short' }),
  }))

  // A partial week is a partial total, so it is marked and left out of the
  // average: counting a Tuesday against seven full weeks would drag the
  // reference line down every Monday and read as a drop that has not happened.
  const currentWeekDate = isoDate(startOfWeek(new Date()))

  return (
    <WindowedChartCard
      title={t.analytics.charts.weeklyVolume.title}
      points={weeks}
      // Every point is one week, and the point of this chart is the week-to-week
      // shape: bucketing a six-month window into six averaged points would erase
      // exactly the down weeks and spikes it exists to show.
      sample={false}
      footnote={t.analytics.charts.weeklyVolume.footnote}
    >
      {(visible) => {
        const complete = visible.filter((w) => w.date !== currentWeekDate)
        const c = t.analytics.charts.weeklyVolume

        // Wide windows are labelled by month, which is what makes a year of
        // weeks scannable: month starts are landmarks, evenly-spaced week dates
        // ("4 Aug · 29 Sep · 24 Nov") mark nothing.
        const byMonth = visible.length > MAX_DATE_LABELLED_POINTS
        const ticks = byMonth ? monthStartTicks(visible) : windowTicks(visible)
        const tickLabel = byMonth ? windowTickMonth : windowTickDate

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
        const dotted = visible.length <= MAX_DOTTED_POINTS

        return (
          <>
            <ChartFigure summary={summary}>
              <ResponsiveContainer width="100%" height={200}>
                {/* Wider right margin than the sibling charts: their ticks are
                    three-letter months, these are "27 juil." on the window's
                    last point, and half of it hangs off the card at 4w. */}
                <AreaChart data={visible} margin={{ top: 4, right: 18, bottom: 0, left: -8 }}>
                  <defs>
                    <linearGradient id="weeklyVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={accentColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={accentColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: CHART_COLORS.axisTick }}
                    axisLine={false}
                    tickLine={false}
                    // Every category reaches the formatter, which blanks all but
                    // the spaced-out dates. Left to its own interval Recharts
                    // picks a subset of the 52 weekly points first, and a year
                    // window can land on nothing but blanked ones - no labels.
                    interval={0}
                    tickFormatter={(date: string) => (ticks.has(date) ? tickLabel(date) : '')}
                  />
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
                  {/* Deliberately unlabelled: an inline "avg 41 km" sits exactly
                      where the most recent weeks are and collides with the curve
                      on a phone. The footnote names the line, the reading gives
                      the number. */}
                  {average > 0 && (
                    <ReferenceLine
                      y={average}
                      stroke={CHART_COLORS.referenceTarget}
                      strokeDasharray="4 3"
                      strokeWidth={1}
                    />
                  )}
                  {/* The curve's last point is a week still being run, so the
                      dip into it is not a real drop. Mark where "so far" starts
                      rather than letting the line imply a finished week. */}
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
