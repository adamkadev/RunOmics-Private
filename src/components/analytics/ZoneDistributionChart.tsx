'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatDuration } from '@/lib/formatters'
import type { WeeklyTrendPoint, ZoneShare } from '@/application/usecases/GetAnalyticsData'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { CHART_COLORS, ZONE_COLORS, ZONE_COLORS_DARK } from '@/lib/colors'
import { useTheme } from 'next-themes'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { WindowedChartCard } from '@/components/ui/ChartWindowNav'
import { round } from '@/lib/math'
import { easyShareOfZones } from '@/domain/activity/easyShare'
import { t } from '@/i18n'

const ZONE_LABELS = t.analytics.charts.zones.labels

function weekZoneSeconds(weeks: WeeklyTrendPoint[]): Record<number, number> {
  const seconds: Record<number, number> = {}
  for (const week of weeks) {
    for (const [zone, secs] of Object.entries(week.zoneSeconds)) seconds[Number(zone)] = (seconds[Number(zone)] ?? 0) + secs
  }
  return seconds
}

function zoneShares(weeks: WeeklyTrendPoint[]): ZoneShare[] {
  const seconds = new Map(Object.entries(weekZoneSeconds(weeks)).map(([z, s]) => [Number(z), s] as const))

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

// Derived from the window on screen, and rendered above the chart rather than
// under it - see ChartReading.
function zoneReading(visible: WeeklyTrendPoint[]): string | null {
  const data = zoneShares(visible)
  if (!data.length) return null
  const top = data.reduce((a, b) => (b.percent > a.percent ? b : a))
  return t.analytics.charts.zones.reading(top.percent, `Z${top.zone} · ${ZONE_LABELS[top.zone]}`)
}

export function ZoneDistributionChart({ points }: { points: WeeklyTrendPoint[] }) {
  const { resolvedTheme } = useTheme()
  const zoneColors = resolvedTheme === 'light' ? ZONE_COLORS : ZONE_COLORS_DARK

  if (!points.some((p) => Object.keys(p.zoneSeconds).length > 0)) return null

  return (
    <WindowedChartCard
      title={t.analytics.charts.zones.title}
      points={points}
      sample={false}
      reading={zoneReading}
      value={(visible) => {
        const share = easyShareOfZones(weekZoneSeconds(visible))
        return share ? t.analytics.charts.zones.easyTime(share.easy) : null
      }}
    >
      {(visible) => {
        const data = zoneShares(visible)
        if (!data.length) return <p className="py-12 text-center text-sm text-subtle">{t.chartWindow.empty}</p>

        const summary = `${t.analytics.charts.zones.title}: ${data.map((z) => `Z${z.zone} ${z.percent}%`).join(', ')}`

        return (
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
        )
      }}
    </WindowedChartCard>
  )
}
