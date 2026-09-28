import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { TrainingStatusDayBar } from '@/application/usecases/GetTrainingStatusDaysBar'
import { STATUS_DELTA_DAYS } from '@/domain/training/status'
import { cardClass } from '@/components/ui/Card'
import { Stat, StatGrid, type StatTone } from '@/components/ui/Stat'
import { deltaTone, type DeltaMetric, type DeltaTone } from '@/lib/deltaTone'
import { formBand, type FormBand } from '@/domain/training/formBand'
import { formatDelta } from '@/lib/formatters'
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

/** Which way Form moved over its window, in a word: recovering, absorbing load, steady. */
export function formTrend(delta: number): string {
  const moved = Math.round(delta)
  const w = t.dashboard.bodyCard.formTrend
  return moved > 0 ? w.up : moved < 0 ? w.down : w.flat
}

/** The status the watch gave the latest rated day, for the hero's head. */
export function latestRatedStatus(days: TrainingStatusDayBar[]): Status | null {
  return [...days].reverse().find((d) => d.status)?.status ?? null
}

/**
 * Form / Fitness / Fatigue, and nothing else (H03, M7), as the one stat
 * pattern (v4.17): the label, the number, and a line saying what it means.
 * Fitness and Fatigue say how they moved over their window, in that move's
 * meaning; Form says its band in the band's, then how it moved, muted.
 */
export function BodyCard({ status }: { status: TrainingStatus | null; watchStatus?: Status | null }) {
  if (!status) return null
  const form = Math.round(status.tsbNow)
  const band = formBand(form)
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
            // Wraps, never cut (v4.17.2): the band, then " · " and which way
            // Form moved and by how much. The dot sits in a 12 px box pulled
            // out by the row's negative margin and clipped at the column's
            // edge, so when the move wraps onto its own line no line starts
            // or ends on a dot; the move's own words wrap in whole phrases.
            <span className="block overflow-hidden">
              <span className="-ml-3 flex flex-wrap">
                {/* Form's own band, as Analytics names it (v4.7). "Productive"
                    was Garmin's training status, not a Form band. */}
                <span data-testid="form-band">
                  <span aria-hidden="true" className="inline-block w-3" />
                  {t.formBand[band]}
                </span>
                {/* One meaning colour a stat (v4.17.1): the band carries it,
                    which way Form moved and by how much is a muted detail -
                    "Tired" in warn beside "+7" in pos read as two verdicts. */}
                <span className="flex min-w-0 text-muted-foreground" data-testid="metric-delta" data-tone="muted">
                  <span aria-hidden="true" className="w-3 shrink-0 text-center">·</span>
                  <span className="min-w-0">
                    <span className="inline-block">{t.dashboard.bodyCard.formMoveLead(formTrend(status.tsbDelta))}</span>{' '}
                    <span className="inline-block">{deltaLabel(status.tsbDelta, STATUS_DELTA_DAYS.form)}</span>
                  </span>
                </span>
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
