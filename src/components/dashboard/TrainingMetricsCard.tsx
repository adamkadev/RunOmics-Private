'use client'

import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { VO2maxTrend } from '@/application/usecases/GetVO2maxHistory'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { ATHLETE_BIRTHDATE, ATHLETE_SEX } from '@/domain/athlete/constants'
import { ageFromBirthdate, vo2maxBand, vo2maxProgressToSuperior, vo2maxTopPercent } from '@/domain/athlete/vo2maxNorms'
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
  band,
}: {
  label: string
  value: ReactNode
  valueClassName?: string
  trailing?: ReactNode
  band?: { label: string; progress: number; textClassName: string; dotClassName: string }
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-center justify-center gap-1">
        <span className={cn('text-lg font-semibold tabular-nums', valueClassName ?? 'text-foreground')}>{value}</span>
        {trailing}
      </div>
      {band && (
        <>
          <div className={cn('mt-1 text-[10px] font-medium', band.textClassName)}>{band.label}</div>
          <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-foreground/[0.08]">
            <div
              className={cn('h-full rounded-full', band.dotClassName)}
              style={{ width: `${Math.round(band.progress * 100)}%` }}
            />
          </div>
        </>
      )}
    </div>
  )
}

const VO2MAX_BAND_STYLE: Record<'building' | 'solid' | 'strong' | 'elite', { text: string; dot: string }> = {
  building: { text: STATUS.pending.text, dot: STATUS.pending.dot },
  solid: { text: STATUS.progress.text, dot: STATUS.progress.dot },
  strong: { text: STATUS.success.text, dot: STATUS.success.dot },
  elite: { text: STATUS.success.text, dot: STATUS.success.dot },
}

const FITNESS_BAND_STYLE: Record<'building' | 'nearPeak' | 'peak', { text: string; dot: string }> = {
  building: { text: STATUS.pending.text, dot: STATUS.pending.dot },
  nearPeak: { text: STATUS.progress.text, dot: STATUS.progress.dot },
  peak: { text: STATUS.success.text, dot: STATUS.success.dot },
}

function fitnessBand(ctl: number, ctlPeak: number): 'building' | 'nearPeak' | 'peak' {
  if (ctlPeak <= 0) return 'building'
  const pct = ctl / ctlPeak
  if (pct >= 0.97) return 'peak'
  if (pct >= 0.8) return 'nearPeak'
  return 'building'
}

function TrendIcon({
  direction,
  goodDirection = 'up',
}: {
  direction: 'up' | 'down' | 'stable' | null
  /** Which raw direction reads as "good" (green) rather than "caution" (amber) - down for fatigue, up for fitness/VO2max. */
  goodDirection?: 'up' | 'down'
}) {
  if (direction === 'stable') return <Minus size={13} className="text-muted-foreground" />
  if (direction === null) return null
  const isGood = direction === goodDirection
  const Icon = direction === 'up' ? TrendingUp : TrendingDown
  return <Icon size={13} className={isGood ? STATUS.success.text : STATUS.warning.text} />
}

function chargeStatus(acwr: number | null): { label: string; textClassName: string; dotClassName: string } | null {
  if (acwr === null) return null
  const s = t.dashboard.todayHero
  if (acwr > 1.3) return { label: s.chargeHigh, textClassName: STATUS.warning.text, dotClassName: STATUS.warning.dot }
  if (acwr < 0.8) return { label: s.chargeLow, textClassName: STATUS.warning.text, dotClassName: STATUS.warning.dot }
  return { label: s.chargeOptimal, textClassName: STATUS.success.text, dotClassName: STATUS.success.dot }
}

export function TrainingMetricsCard({ status, vo2max, vo2maxTrend }: Props) {
  if (!status) return null

  const charge = chargeStatus(status.acwr)
  const fitnessTrend = status.ctlDelta > 1 ? 'up' : status.ctlDelta < -1 ? 'down' : 'stable'
  const fatigueTrend = status.atlDelta > 1 ? 'up' : status.atlDelta < -1 ? 'down' : 'stable'
  const acwrProgress = status.acwr !== null ? Math.min(1, status.acwr / 1.5) : 0

  const age = ageFromBirthdate(ATHLETE_BIRTHDATE)
  const vo2Band = vo2max !== null ? vo2maxBand(vo2max, age, ATHLETE_SEX) : null
  const vo2BandStyle = vo2Band ? VO2MAX_BAND_STYLE[vo2Band] : null

  const fBand = fitnessBand(status.ctl, status.ctlPeak)
  const fBandStyle = FITNESS_BAND_STYLE[fBand]

  return (
    <div className="grid grid-cols-3 gap-3 text-center">
      <GlassSurface variant="card" className="p-4">
        <Metric
          label={t.dashboard.vo2maxChart.title}
          value={vo2max !== null ? <AnimatedValue value={vo2max} decimals={1} /> : '–'}
          trailing={<TrendIcon direction={vo2maxTrend} />}
          band={
            vo2max !== null && vo2Band && vo2BandStyle
              ? {
                  label: `${t.trainingStatus.metrics.vo2maxBand[vo2Band]} · ${t.trainingStatus.metrics.topPercent(vo2maxTopPercent(vo2max, age, ATHLETE_SEX))}`,
                  progress: vo2maxProgressToSuperior(vo2max, age, ATHLETE_SEX),
                  textClassName: vo2BandStyle.text,
                  dotClassName: vo2BandStyle.dot,
                }
              : undefined
          }
        />
      </GlassSurface>
      <GlassSurface variant="card" className="p-4">
        <Metric
          label={t.trainingStatus.metrics.fitness}
          value={<AnimatedValue value={Math.round(status.ctl)} />}
          trailing={<TrendIcon direction={fitnessTrend} />}
          band={{
            label: t.trainingStatus.metrics.fitnessBand[fBand],
            progress: status.ctlPeak > 0 ? status.ctl / status.ctlPeak : 0,
            textClassName: fBandStyle.text,
            dotClassName: fBandStyle.dot,
          }}
        />
      </GlassSurface>
      <GlassSurface variant="card" className="p-4">
        <Metric
          label={t.dashboard.trainingLoad.fatigue}
          value={<AnimatedValue value={Math.round(status.atl)} />}
          trailing={<TrendIcon direction={fatigueTrend} goodDirection="down" />}
          band={
            charge
              ? {
                  label: charge.label,
                  progress: acwrProgress,
                  textClassName: charge.textClassName,
                  dotClassName: charge.dotClassName,
                }
              : undefined
          }
        />
      </GlassSurface>
    </div>
  )
}
