'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatDuration } from '@/lib/formatters'
import type { ZoneShare } from '@/application/usecases/GetAnalyticsData'

const ZONE_COLORS: Record<number, string> = {
  1: '#9ca3af',
  2: '#60a5fa',
  3: '#34d399',
  4: '#f97316',
  5: '#ef4444',
}

const ZONE_LABELS: Record<number, string> = {
  1: 'Warm Up',
  2: 'Easy',
  3: 'Aerobic',
  4: 'Threshold',
  5: 'Maximum',
}

interface Props {
  data: ZoneShare[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: ZoneShare }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const z = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm dark:bg-muted">
      <p className="text-xs font-medium text-foreground">
        Z{z.zone} · {ZONE_LABELS[z.zone]}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatDuration(z.seconds)} · {z.percent}%
      </p>
    </div>
  )
}

export function ZoneDistributionChart({ data }: Props) {
  if (!data.length) return null

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        Time in Zones
      </h3>
      <div className="flex items-center gap-4">
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
            >
              {data.map((z) => (
                <Cell key={z.zone} fill={ZONE_COLORS[z.zone] ?? '#9ca3af'} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <ul className="flex-1 space-y-2">
          {data.map((z) => (
            <li key={z.zone} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: ZONE_COLORS[z.zone] }}
                />
                <span className="text-muted-foreground">
                  Z{z.zone} {ZONE_LABELS[z.zone]}
                </span>
              </div>
              <span className="font-medium text-foreground">{z.percent}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
