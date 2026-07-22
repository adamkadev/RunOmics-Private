'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatDuration } from '@/lib/formatters'
import type { WeeklyTrendPoint, ZoneShare } from '@/application/usecases/GetAnalyticsData'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { CHART_COLORS, ZONE_COLORS, ZONE_COLORS_DARK } from '@/lib/colors'
import { useTheme } from 'next-themes'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { ChartExplain } from '@/components/ui/ChartExplain'
import { WindowedChartCard } from '@/components/ui/ChartWindowNav'
import { round } from '@/lib/math'
import { t } from '@/i18n'

const ZONE_LABELS = t.analytics.charts.zones.labels

/** Sum each week's zone seconds across the window, then turn them into shares. */
function zoneShares(weeks: WeeklyTrendPoint[]): ZoneShare[] {
  const seconds = new Map<number, number>()
  for (const week of weeks) {
    for (const [zone, secs] of Object.entries(week.zoneSeconds)) {
      seconds.set(Number(zone), (seconds.get(Number(zone)) ?? 0) + secs)
    }
  }

  const total = Array.from(seconds.values()).reduce((s, v) => s + v, 0)
  if (total === 0) return []

  return Array.from(seconds.entries())
    .sort(([a], [b]) => a - b)
    .map(([zone, secs]) => ({ zone, seconds: secs, percent: round((secs / total) * 100, 1) }))
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: ZoneShare }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  const z = payload?.[0]?.payload
  if (!active || !z) return null
  return (
    <TooltipCard>
      <p className="text-xs font-medium text-foreground">
        Z{z.zone} · {ZONE_LABELS[z.zone]}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatDuration(z.seconds)} · {z.percent}%
      </p>
    </TooltipCard>
  )
}

export function ZoneDistributionChart({ points }: { points: WeeklyTrendPoint[] }) {
  // Read before the empty-data bail so the hook order never changes. Undefined
  // on the first client render (next-themes resolves `system` late), and the
  // dark ramp is the safer stand-in - it also reads on the light canvas.
  const { resolvedTheme } = useTheme()
  const zoneColors = resolvedTheme === 'light' ? ZONE_COLORS : ZONE_COLORS_DARK

  if (!points.some((p) => Object.keys(p.zoneSeconds).length > 0)) return null

  // The donut sums the whole window rather than plotting it, so it needs every
  // week's zone seconds - not the trend charts' 4/6/12-point sample.
  return (
    <WindowedChartCard title={t.analytics.charts.zones.title} points={points} sample={false}>
      {(visible) => {
        const data = zoneShares(visible)
        if (!data.length) return <p className="py-12 text-center text-sm text-subtle">{t.chartWindow.empty}</p>

        const summary = `${t.analytics.charts.zones.title}: ${data.map((z) => `Z${z.zone} ${z.percent}%`).join(', ')}`
        const top = data.reduce((a, b) => (b.percent > a.percent ? b : a))
        const reading = t.analytics.charts.zones.reading(top.percent, `Z${top.zone} · ${ZONE_LABELS[top.zone]}`)

        return (
          <>
            <div className="flex items-center gap-4">
              <ChartFigure summary={summary}>
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie
                      data={data}
                      dataKey="seconds"
                      nameKey="zone"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={64}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {data.map((z) => (
                        <Cell key={z.zone} fill={zoneColors[z.zone] ?? CHART_COLORS.axisTick} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartFigure>
              <ul className="flex-1 space-y-2">
                {data.map((z) => (
                  <li key={z.zone} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: zoneColors[z.zone] }} />
                      <span className="text-muted-foreground">
                        Z{z.zone} {ZONE_LABELS[z.zone]}
                      </span>
                    </div>
                    <span className="font-medium text-foreground">{z.percent}%</span>
                  </li>
                ))}
              </ul>
            </div>
            <ChartExplain text={reading} />
          </>
        )
      }}
    </WindowedChartCard>
  )
}
