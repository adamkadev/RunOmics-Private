'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import type { TypeDistribution } from '@/domain/activity/types'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { CHART_COLORS } from '@/lib/colors'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

const MIN_PERCENT = 3

interface DisplayEntry {
  label: string
  distanceKm: number
  percent: number
  color: string
}

function toDisplayEntries(data: TypeDistribution[]): DisplayEntry[] {
  const main: DisplayEntry[] = []
  let otherKm = 0
  let otherPercent = 0
  for (const entry of data) {
    if (entry.percent >= MIN_PERCENT) {
      main.push({
        label: t.activityTypes[entry.type],
        distanceKm: entry.distanceKm,
        percent: entry.percent,
        color: ACTIVITY_TYPE_CONFIG[entry.type].chartColor,
      })
    } else {
      otherKm += entry.distanceKm
      otherPercent += entry.percent
    }
  }
  if (otherPercent > 0) {
    main.push({
      label: t.dashboard.trainingMix.other,
      distanceKm: otherKm,
      percent: otherPercent,
      color: CHART_COLORS.axisTick,
    })
  }
  return main
}

interface Props {
  data: TypeDistribution[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: DisplayEntry }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <TooltipCard>
      <p className="text-xs font-medium text-foreground">{d.label}</p>
      <p className="text-xs text-muted-foreground">
        {d.distanceKm.toFixed(1)} km · {d.percent}%
      </p>
    </TooltipCard>
  )
}

export function IntensityChart({ data }: Props) {
  const entries = toDisplayEntries(data)

  return (
    <GlassSurface variant="card" className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        {t.dashboard.trainingMix.title}
      </h3>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie
              data={entries}
              dataKey="distanceKm"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={64}
              paddingAngle={2}
              isAnimationActive={false}
            >
              {entries.map((entry) => (
                <Cell key={entry.label} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <ul className="flex-1 space-y-2">
          {entries.map((entry) => (
            <li key={entry.label} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">{entry.label}</span>
              </div>
              <span className="font-medium text-foreground">
                {entry.percent}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </GlassSurface>
  )
}
