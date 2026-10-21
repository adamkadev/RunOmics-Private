import Link from 'next/link'
import type { ReactNode } from 'react'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { verdictTone, type ReadinessTone } from '@/domain/training/readiness'
import { STATUS_DELTA_DAYS } from '@/domain/training/status'
import { deltaTone, DELTA_TONE_COLOR, type DeltaMetric } from '@/lib/deltaTone'
import { formatDelta } from '@/lib/formatters'
import { formBand } from '@/domain/training/formBand'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import type { TodayVerdict } from '@/application/usecases/GetTodayInsight'
import type { LoadReading } from '@/application/usecases/GetRecentLoad'
import { cardClass, insetTileClass, tileLabelClass } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
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

/** Words that name a form state, in either language. */
const FRESH_WORDS = /\b(fresh|rested|frais|fraîche|reposée?)\b/i
const TIRED_WORDS = /\b(tired|fatigued|fatiguée?)\b/i

/**
 * A number on its inner tile (App Fixes 1a): the label in caps, the value at
 * 24/29 bold (Liquid Glass v3), and a line under it - its band, or how it
 * moved this week.
 */
function Tile({ label, value, sub, testId }: { label: string; value: ReactNode; sub: ReactNode; testId: string }) {
  return (
    <div data-testid={testId} className={cn('flex min-w-0 flex-col gap-1', insetTileClass)}>
      <span className={tileLabelClass}>{label}</span>
      <span className="text-metric tabular-nums text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  )
}

/**
 * A week's move (rule 04): the arrow follows the number, the colour says
 * whether that is good - fatigue falling is mint, fitness falling amber.
 */
function Delta({ metric, delta, current, days }: { metric: DeltaMetric; delta: number; current: number; days: number }) {
  const tone = deltaTone(metric, delta, { value: current })
  const rounded = Math.round(delta)
  const Arrow = rounded > 0 ? ArrowUpRight : rounded < 0 ? ArrowDownRight : ArrowRight
  return (
    <span data-testid="readiness-delta" data-tone={tone} className="inline-flex items-center gap-0.5 whitespace-nowrap tabular-nums" style={{ color: DELTA_TONE_COLOR[tone] }}>
      <Arrow size={12} strokeWidth={1.8} aria-hidden className="shrink-0" />
      {t.dashboard.readiness.deltaWeek(Math.abs(rounded), days)}
    </span>
  )
}

/**
 * Today's status (App Fixes 1a): the line - in amber while the load is
 * outside its safe range, from the one reading Analytics prints - then the
 * coach's headline and body, then Form, Fitness and Fatigue on three tiles.
 * Without a written verdict the card says the same from the load itself, so
 * it is never just a line. The card opens Analytics › Load.
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
  const color = load && load.state !== 'in' ? 'var(--warn)' : STATUS_COLOR[tone]
  const band = formBand(status.tsbNow)
  const line = load ? s.loadState[load.state] : s.lineByTone[tone]
  const fresh = band === 'fresh' || band === 'veryFresh'
  const fallback = load ? s.fallback[load.state](load.acute, load.lo, load.hi, fresh) : null
  // A written headline that names a form state the status line doesn't
  // ("You're fresh" over NEUTRAL) gives way to the load's own (Wave 5 A0).
  const contradicts = verdict ? (!fresh && FRESH_WORDS.test(verdict.headline)) || (band !== 'tired' && TIRED_WORDS.test(verdict.headline)) : false
  const headline = (contradicts ? fallback?.headline : verdict?.headline) ?? fallback?.headline ?? verdict?.headline ?? null
  const body = verdict ? verdict.body : (fallback?.body ?? null)

  return (
    <Link href="/analytics" aria-label={s.open} className="block transition-transform duration-100 ease-out active:scale-[0.98]" data-testid="readiness-card-link">
      <section className={cardClass({ className: 'flex flex-col gap-2.5' })} data-testid="readiness-card">
        <p className="flex items-center gap-1.5 text-eyebrow uppercase" style={{ color }} data-testid="readiness-status" data-tone={tone}>
          <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
          <span>
            {t.formBand[band]} · {line}
          </span>
        </p>
        {headline && (
          <div className="flex flex-col gap-2.5" data-testid="readiness-verdict">
            {verdict?.yesterday && (
              <p className="-mb-1.5 text-eyebrow uppercase text-muted-foreground" data-testid="verdict-yesterday">
                {s.yesterday}
              </p>
            )}
            <p className="text-title-3 text-foreground [text-wrap:pretty]">{headline}</p>
            {body && <p className="text-[15px] leading-5 tracking-[-0.015rem] text-[var(--text-2)] [text-wrap:pretty]">{body}</p>}
          </div>
        )}

        <div className="-mx-1 -mb-1 grid grid-cols-3 gap-1.5">
          <Tile testId="tile-form" label={s.formLabel} value={formatDelta(form)} sub={t.formBand[band].toLocaleLowerCase(t.locale)} />
          <Tile
            testId="tile-fitness"
            label={s.ctl}
            value={Math.round(status.ctl)}
            sub={<Delta metric="fitness" delta={status.ctlDeltaShown} current={status.ctl} days={STATUS_DELTA_DAYS.fitness} />}
          />
          <Tile
            testId="tile-fatigue"
            label={s.atl}
            value={Math.round(status.atl)}
            sub={<Delta metric="fatigue" delta={status.atlDelta} current={status.atl} days={STATUS_DELTA_DAYS.fatigue} />}
          />
        </div>
      </section>
    </Link>
  )
}
