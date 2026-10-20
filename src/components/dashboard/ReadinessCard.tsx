import Link from 'next/link'
import type { ReactNode } from 'react'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { verdictTone, type ReadinessTone } from '@/domain/training/readiness'
import { STATUS_DELTA_DAYS } from '@/domain/training/status'
import { deltaTone, DELTA_TONE_COLOR, type DeltaMetric } from '@/lib/deltaTone'
import { formatDelta } from '@/lib/formatters'
import type { TodayVerdict } from '@/application/usecases/GetTodayInsight'
import type { LoadReading } from '@/application/usecases/GetRecentLoad'
import { FormDial } from './FormDial'
import { t } from '@/i18n'

/**
 * The status line's colour (design review 3.0): the accent while the block
 * goes as planned, the warn colour once it asks for care - Caution and Hold
 * back - on the dot and the words both, which also say it. A load outside
 * its safe range is the same kind of news, so it takes the warn colour too
 * (App Fixes 1a).
 */
const STATUS_COLOR: Record<ReadinessTone, string> = {
  go: 'var(--accent-text)',
  build: 'var(--accent-text)',
  caution: 'var(--warn)',
  hold: 'var(--warn)',
}

/**
 * A supporting number on its inner tile, set into the card in the page's own
 * ground: the label, the value, and how it moved.
 */
function Tile({ label, value, delta, testId }: { label: string; value: ReactNode; delta?: ReactNode; testId: string }) {
  return (
    <div data-testid={testId} className="flex min-w-0 flex-col gap-0.5 rounded-[14px] bg-background px-3 py-2.5">
      <span className="text-caption font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
        <span className="text-[22px] font-semibold leading-tight tracking-[-0.01em] tabular-nums text-foreground">{value}</span>
        {delta}
      </span>
    </div>
  )
}

/** A week's move in the colour of what it means: fatigue falling is good news. */
function Delta({ metric, delta, current, days }: { metric: DeltaMetric; delta: number; current: number; days: number }) {
  const tone = deltaTone(metric, delta, { value: current })
  return (
    <span data-testid="readiness-delta" data-tone={tone} className="text-xs font-semibold tabular-nums" style={{ color: DELTA_TONE_COLOR[tone] }}>
      {formatDelta(Math.round(delta))}
      {/* Read out only: on screen the tile says it. */}
      <span className="sr-only"> {t.dashboard.readiness.deltaIn(days)}</span>
    </span>
  )
}

/**
 * Today's one score and one sentence (design review 3.0, mock 1b): Form on
 * a dial, the state it reads as, then the coach's headline and body - the
 * written verdict, regenerated daily or after a sync, with no label saying
 * so - but for "Yesterday" over yesterday's, shown between midnight and the
 * night's sync (3.1.0). Fitness, Fatigue and Load support it on three tiles; Garmin's own
 * status, a second verdict beside this one, is gone. The card opens
 * Analytics › Load, where the three live in full.
 */
export function ReadinessCard({
  status,
  verdict = null,
  load = null,
}: {
  status: TrainingStatus | null
  verdict?: TodayVerdict | null
  /** The seven-day load reading Analytics prints, where the watch has one. */
  load?: LoadReading | null
}) {
  if (!status) return null

  const s = t.dashboard.readiness
  const form = Math.round(status.tsbNow)
  const tone = verdictTone(status)
  // The second half of the line is the load against its safe range, from the
  // one reading Analytics uses (App Fixes 1a): it used to be a word chosen
  // off Form alone, so Today could read "Load in range" over an Analytics
  // card saying the opposite.
  const color = load && load.state !== 'in' ? 'var(--warn)' : STATUS_COLOR[tone]
  const line = load ? s.loadState[load.state] : s.lineByTone[tone]

  return (
    <Link href="/analytics" aria-label={s.open} className="block active:scale-[0.99]" data-testid="readiness-card-link">
      <section className="flex flex-col gap-4 rounded-[24px] border border-border bg-card p-[18px] shadow-card" data-testid="readiness-card">
        <div className="flex items-center gap-4">
          <FormDial form={form} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <p className="flex items-start gap-2 text-caption font-semibold uppercase leading-snug tracking-[0.1em]" style={{ color }} data-testid="readiness-status" data-tone={tone}>
              <span aria-hidden className="mt-[0.3em] size-[7px] shrink-0 rounded-full" style={{ background: color }} />
              <span>
                {s.eyebrowByTone[tone]} · {line}
              </span>
            </p>
            {verdict && (
              <div className="flex flex-col gap-1.5" data-testid="readiness-verdict">
                {verdict.yesterday && (
                  <p className="text-caption font-semibold uppercase tracking-[0.1em] text-muted-foreground" data-testid="verdict-yesterday">
                    {s.yesterday}
                  </p>
                )}
                <p className="text-[19px] font-semibold leading-[1.22] text-foreground [text-wrap:pretty]">{verdict.headline}</p>
                {verdict.body && <p className="text-[13px] leading-snug text-[var(--text-2)] [text-wrap:pretty]">{verdict.body}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Fitness and Fatigue support the dial; the load ratio moved to
            Analytics' load story, where the band it belongs to is (2a). */}
        <div className="grid grid-cols-2 gap-2">
          <Tile
            testId="tile-fitness"
            label={s.ctl}
            value={Math.round(status.ctl)}
            delta={<Delta metric="fitness" delta={status.ctlDeltaShown} current={status.ctl} days={STATUS_DELTA_DAYS.fitness} />}
          />
          <Tile
            testId="tile-fatigue"
            label={s.atl}
            value={Math.round(status.atl)}
            delta={<Delta metric="fatigue" delta={status.atlDelta} current={status.atl} days={STATUS_DELTA_DAYS.fatigue} />}
          />
        </div>
      </section>
    </Link>
  )
}
