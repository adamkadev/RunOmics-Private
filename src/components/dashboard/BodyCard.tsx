import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { TrainingStatusDayBar } from '@/application/usecases/GetTrainingStatusDaysBar'
import { STATUS_DELTA_DAYS } from '@/domain/training/status'
import { cardClass } from '@/components/ui/Card'
import { Stat, StatGrid, STAT_TONE_CLASS, type StatTone } from '@/components/ui/Stat'
import { deltaTone, type DeltaMetric, type DeltaTone } from '@/lib/deltaTone'
import { formBand, type FormBand } from '@/domain/training/formBand'
import { formatDelta } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

type Status = NonNullable<TrainingStatusDayBar['status']>

/** "+4 in 7 days": the sign says which way, the window says over how long. */
export function deltaLabel(delta: number, days: number): string {
  return t.dashboard.bodyCard.deltaIn(formatDelta(Math.round(delta)), days)
}

// A delta's colour is what it means (v4.17): getting better is pos, getting
// worse is warn - fatigue rising, fitness falling - and noise stays muted.
const DELTA_STAT_TONE: Record<DeltaTone, StatTone> = { good: 'pos', worse: 'warn', flat: 'muted' }

// Form's band is a state, coloured by what it means for today: tired is
// caution, fresh is good, the ordinary training range says nothing.
const BAND_TONE: Record<FormBand, StatTone> = { tired: 'warn', neutral: 'muted', fresh: 'pos', veryFresh: 'pos' }

function deltaStatTone(metric: DeltaMetric, delta: number, current: number): StatTone {
  return DELTA_STAT_TONE[deltaTone(metric, delta, { value: current })]
}

/** The status the watch gave the latest rated day, for the hero's head. */
export function latestRatedStatus(days: TrainingStatusDayBar[]): Status | null {
  return [...days].reverse().find((d) => d.status)?.status ?? null
}

/**
 * Form / Fitness / Fatigue, and nothing else (H03, M7), as the one stat
 * pattern (v4.17): the label, the number, and a line saying what it means.
 * Fitness and Fatigue say how they moved over their window; Form says its
 * band first, then how it moved, each in its own meaning's colour.
 */
export function BodyCard({ status }: { status: TrainingStatus | null; watchStatus?: Status | null }) {
  if (!status) return null
  const form = Math.round(status.tsbNow)
  const band = formBand(form)
  const formDeltaTone = deltaStatTone('form', status.tsbDelta, form)
  const fitnessTone = deltaStatTone('fitness', status.ctlDeltaShown, status.ctl)
  const fatigueTone = deltaStatTone('fatigue', status.atlDelta, status.atl)

  return (
    <section className={cardClass()} data-testid="body-card">
      <StatGrid columns={3}>
        <Stat
          size="lg"
          label={t.dashboard.trainingLoad.form}
          value={formatDelta(form)}
          tone={BAND_TONE[band]}
          meaning={
            // Each part carries its " · " in front, pulled out by the row's
            // negative margin: on a phone the delta wraps onto its own line,
            // its dot is clipped at the edge, and no line ends on a dot.
            <span className="-ml-3 flex flex-wrap">
              {/* Form's own band, as Analytics names it (v4.7). "Productive"
                  was Garmin's training status, not a Form band. */}
              <span className="whitespace-nowrap" data-testid="form-band">
                <span aria-hidden="true" className="inline-block w-3" />
                {t.formBand[band]}
              </span>
              <span className={cn('whitespace-nowrap', STAT_TONE_CLASS[formDeltaTone])} data-testid="metric-delta" data-tone={formDeltaTone}>
                <span aria-hidden="true" className="inline-block w-3 text-center text-muted-foreground">·</span>
                {deltaLabel(status.tsbDelta, STATUS_DELTA_DAYS.form)}
              </span>
            </span>
          }
        />
        <Stat
          size="lg"
          label={t.trainingStatus.metrics.fitness}
          value={String(Math.round(status.ctl))}
          tone={fitnessTone}
          meaning={
            <span data-testid="metric-delta" data-tone={fitnessTone}>
              {deltaLabel(status.ctlDeltaShown, STATUS_DELTA_DAYS.fitness)}
            </span>
          }
        />
        <Stat
          size="lg"
          label={t.dashboard.trainingLoad.fatigue}
          value={String(Math.round(status.atl))}
          tone={fatigueTone}
          meaning={
            <span data-testid="metric-delta" data-tone={fatigueTone}>
              {deltaLabel(status.atlDelta, STATUS_DELTA_DAYS.fatigue)}
            </span>
          }
        />
      </StatGrid>
    </section>
  )
}
