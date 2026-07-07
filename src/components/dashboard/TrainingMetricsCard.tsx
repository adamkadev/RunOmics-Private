'use client'

import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { VO2maxTrend } from '@/application/usecases/GetVO2maxHistory'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  status: TrainingStatus | null
  vo2max: number | null
  vo2maxTrend: VO2maxTrend | null
}

function Metric({
  label,
  value,
  valueClassName,
  trailing,
}: {
  label: string
  value: string
  valueClassName?: string
  trailing?: ReactNode
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-center gap-1">
        <span className={cn('text-lg font-semibold tabular-nums', valueClassName ?? 'text-foreground')}>{value}</span>
        {trailing}
      </div>
    </div>
  )
}

function TrendIcon({ direction }: { direction: 'up' | 'down' | 'stable' | null }) {
  if (direction === 'up') return <TrendingUp size={13} className={STATUS.success.text} />
  if (direction === 'down') return <TrendingDown size={13} className={STATUS.warning.text} />
  if (direction === 'stable') return <Minus size={13} className="text-muted-foreground" />
  return null
}

function chargeStatus(acwr: number | null): { label: string; className: string } | null {
  if (acwr === null) return null
  const s = t.dashboard.todayHero
  if (acwr > 1.3) return { label: s.chargeHigh, className: STATUS.warning.text }
  if (acwr < 0.8) return { label: s.chargeLow, className: STATUS.warning.text }
  return { label: s.chargeOptimal, className: STATUS.success.text }
}

export function TrainingMetricsCard({ status, vo2max, vo2maxTrend }: Props) {
  if (!status) return null

  const s = t.dashboard.todayHero
  const charge = chargeStatus(status.acwr)
  const fitnessTrend = status.ctlDelta > 1 ? 'up' : status.ctlDelta < -1 ? 'down' : 'stable'

  return (
    <div className="grid grid-cols-3 gap-3">
      <GlassSurface variant="card" className="p-4">
        <Metric
          label={t.dashboard.vo2maxChart.title}
          value={vo2max !== null ? vo2max.toFixed(1) : '–'}
          trailing={<TrendIcon direction={vo2maxTrend} />}
        />
      </GlassSurface>
      <GlassSurface variant="card" className="p-4">
        <Metric label={s.load} value={charge ? charge.label : '–'} valueClassName={charge?.className} />
      </GlassSurface>
      <GlassSurface variant="card" className="p-4">
        <Metric
          label={t.trainingStatus.metrics.fitness}
          value={String(Math.round(status.ctl))}
          trailing={<TrendIcon direction={fitnessTrend} />}
        />
      </GlassSurface>
    </div>
  )
}
