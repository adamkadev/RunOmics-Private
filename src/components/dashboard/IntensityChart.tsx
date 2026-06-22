'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import type { TypeDistribution } from '@/domain/activity/types'
import { TooltipCard } from '@/components/ui/ChartTooltip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

interface Props {
  data: TypeDistribution[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: TypeDistribution }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <TooltipCard>
      <p className="text-xs font-medium text-foreground">{t.activityTypes[d.type]}</p>
      <p className="text-xs text-muted-foreground">
        {d.distanceKm.toFixed(1)} km · {d.percent}%
      </p>
    </TooltipCard>
  )
}

export function IntensityChart({ data }: Props) {
  return (
    <GlassSurface variant="card" className="rounded-[22px] p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        {t.dashboard.trainingMix.title}
      </h3>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie
              data={data}
              dataKey="distanceKm"
              nameKey="type"
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={64}
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.type}
                  fill={ACTIVITY_TYPE_CONFIG[entry.type].chartColor}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <ul className="flex-1 space-y-2">
          {data.map((entry) => {
            const config = ACTIVITY_TYPE_CONFIG[entry.type]
            return (
              <li key={entry.type} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: config.chartColor }}
                  />
                  <span className="text-muted-foreground">{t.activityTypes[entry.type]}</span>
                </div>
                <span className="font-medium text-foreground">
                  {entry.percent}%
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </GlassSurface>
  )
}
