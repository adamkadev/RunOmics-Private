import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { TrainingStatusDayBar } from '@/application/usecases/GetTrainingStatusDaysBar'
import { STATUS_DELTA_DAYS } from '@/domain/training/status'
import { cardClass } from '@/components/ui/Card'
import { Stat, StatGrid, type StatTone } from '@/components/ui/Stat'
import { deltaTone, type DeltaMetric, type DeltaTone } from '@/lib/deltaTone'
import { FORM_BAND_THRESHOLDS, formBand, type FormBand } from '@/domain/training/formBand'
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

/** The Form scale's ends: deep in the training zone to well rested. Past them the marker rests on the edge. */
export const FORM_SCALE = { min: -40, max: 25 } as const

const at = (value: number) => ((Math.min(FORM_SCALE.max, Math.max(FORM_SCALE.min, value)) - FORM_SCALE.min) / (FORM_SCALE.max - FORM_SCALE.min)) * 100

/**
 * Where today's Form sits (design review, Oct 2026): "−18" on its own did not
 * say whether that was deep or normal. Tired below −10 in the caution
 * colour, fresh above +5 in the good one, the training range between, the
 * same bands the number's own word names - and the band in words beside it,
 * never the colour alone.
 */
export function FormScale({ form }: { form: number }) {
  const { tiredBelow, freshAbove } = FORM_BAND_THRESHOLDS
  const band = formBand(form)
  return (
    <div className="mt-3.5 flex flex-col gap-1.5" data-testid="form-scale" role="img" aria-label={t.dashboard.bodyCard.formOnScale(formatDelta(form), t.formBand[band])}>
      <div className="relative h-2 rounded-full bg-[var(--surface-2)]">
        <span aria-hidden className="absolute inset-y-0 left-0 rounded-l-full opacity-45" style={{ width: `${at(tiredBelow)}%`, background: 'var(--form-band-fill-tired)' }} />
        <span aria-hidden className="absolute inset-y-0 right-0 rounded-r-full opacity-45" style={{ left: `${at(freshAbove)}%`, background: 'var(--form-band-fill-fresh)' }} />
        <span aria-hidden data-testid="form-marker" className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded-[2px] bg-foreground" style={{ left: `${at(form)}%` }} />
      </div>
      <div aria-hidden className="flex justify-between text-[11.5px] text-muted-foreground">
        <span>{t.formBand.tired}</span>
        <span>{t.formBand.neutral}</span>
        <span>{t.formBand.fresh}</span>
      </div>
    </div>
  )
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
      <FormScale form={form} />
    </section>
  )
}
