'use client'

import type { ReactNode } from 'react'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { vo2maxBand, vo2maxProgressToSuperior, vo2maxTopPercent } from '@/domain/athlete/vo2maxNorms'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  status: TrainingStatus | null
  vo2max: number | null
  age?: number
  sex?: 'male' | 'female'
}

function Metric({
  label,
  value,
  valueClassName,
  band,
}: {
  label: string
  value: ReactNode
  valueClassName?: string
  band?: { label: string; progress: number; textClassName: string; dotClassName: string }
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-center justify-center gap-1">
        <span className={cn('text-lg font-semibold tabular-nums', valueClassName ?? 'text-foreground')}>{value}</span>
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

// Garmin's own LOW/OPTIMAL/HIGH verdict when the watch supplied one - it is
// calibrated on the athlete, where the 0.8/1.3 cutoffs below are generic.
function chargeStatus(
  acwr: number | null,
  acwrStatus: string | null,
): { label: string; textClassName: string; dotClassName: string } | null {
  if (acwr === null) return null
  const s = t.dashboard.todayHero
  const high = acwrStatus ? acwrStatus === 'HIGH' : acwr > 1.3
  const low = acwrStatus ? acwrStatus === 'LOW' : acwr < 0.8

  if (high) return { label: s.chargeHigh, textClassName: STATUS.warning.text, dotClassName: STATUS.warning.dot }
  if (low) return { label: s.chargeLow, textClassName: STATUS.warning.text, dotClassName: STATUS.warning.dot }
  return { label: s.chargeOptimal, textClassName: STATUS.success.text, dotClassName: STATUS.success.dot }
}

export function TrainingMetricsCard({ status, vo2max, age, sex }: Props) {
  if (!status) return null

  const charge = chargeStatus(status.acwr, status.acwrStatus)
  const acwrProgress = status.acwr !== null ? Math.min(1, status.acwr / 1.5) : 0

  const vo2Band = vo2max !== null && age !== undefined && sex ? vo2maxBand(vo2max, age, sex) : null
  const vo2BandStyle = vo2Band ? VO2MAX_BAND_STYLE[vo2Band] : null

  const fBand = fitnessBand(status.ctl, status.ctlPeak)
  const fBandStyle = FITNESS_BAND_STYLE[fBand]

  return (
    <div className="grid grid-cols-3 gap-3 text-center">
      <GlassSurface variant="card" className="p-4">
        <Metric
          label={t.dashboard.vo2maxChart.title}
          value={vo2max !== null ? <AnimatedValue value={vo2max} decimals={1} /> : '–'}
          band={
            vo2max !== null && age !== undefined && sex && vo2Band && vo2BandStyle
              ? {
                  label: `${t.trainingStatus.metrics.vo2maxBand[vo2Band]} · ${t.trainingStatus.metrics.topPercent(vo2maxTopPercent(vo2max, age, sex))}`,
                  progress: vo2maxProgressToSuperior(vo2max, age, sex),
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
