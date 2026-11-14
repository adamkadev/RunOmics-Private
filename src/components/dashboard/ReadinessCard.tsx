import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { readinessEyebrow, verdictTone, type ReadinessTone } from '@/domain/training/readiness'
import { STATUS_DELTA_DAYS } from '@/domain/training/status'
import { deltaTone, DELTA_TONE_COLOR, type DeltaMetric } from '@/lib/deltaTone'
import { formBand } from '@/domain/training/formBand'
import { ArrowDownRight, ArrowUpRight, ChevronRight } from 'lucide-react'
import type { TodayVerdict } from '@/application/usecases/GetTodayInsight'
import type { LoadReading } from '@/application/usecases/GetRecentLoad'
import type { ReadinessReason } from './readinessReason'
import type { VerdictTone as RunTone } from '@/domain/activity/runVerdict'
import { formatDelta, formatWeekdayLong } from '@/lib/formatters'
import { cardClass, tileLabelClass } from '@/components/ui/Card'
import { CheckInReadiness } from '@/components/wellness/CheckInReadiness'
import { appTodayIso } from '@/lib/calendarDate'
import { t } from '@/i18n'

// Status, never the accent: an accent eyebrow read as "good" whatever the tone.
const STATUS_COLOR: Record<ReadinessTone, string> = {
  go: 'var(--pos)',
  build: 'var(--muted-foreground)',
  caution: 'var(--warn)',
  hold: 'var(--warn)',
}

/** Words that name a form state, in English or French. */
const FRESH_WORDS = /\b(fresh|rested|frais|fraîche|reposée?)\b/i
const TIRED_WORDS = /\b(tired|fatigued|fatiguée?)\b/i

function reasonHeadline(reason: ReadinessReason): string {
  const s = t.dashboard.readiness
  const noun = s.sessionNoun[reason.session]
  if (reason.kind === 'rest') return s.reason.rest(noun, formatWeekdayLong(reason.date))
  return s.reason[reason.kind](noun)
}

function Tile({ label, value, sub, testId }: { label: string; value: ReactNode; sub?: ReactNode; testId: string }) {
  return (
    <div data-testid={testId} className="flex min-w-0 flex-col gap-1">
      <span className={tileLabelClass}>{label}</span>
      <span className="text-metric tabular-nums text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  )
}

/** The arrow follows the number; the colour says whether that is good: fatigue falling is mint, fitness falling amber. */
function Delta({ metric, delta, current, days }: { metric: DeltaMetric; delta: number; current: number; days: number }) {
  const tone = deltaTone(metric, delta, { value: current })
  const rounded = Math.round(delta)
  const Arrow = rounded > 0 ? ArrowUpRight : ArrowDownRight
  if (rounded === 0) {
    return <span data-testid="readiness-delta" data-tone="neutral" className="whitespace-nowrap text-muted-foreground">{t.dashboard.readiness.steady(days)}</span>
  }
  return (
    <span data-testid="readiness-delta" data-tone={tone} className="inline-flex items-center gap-0.5 whitespace-nowrap tabular-nums" style={{ color: DELTA_TONE_COLOR[tone] }}>
      <Arrow size={12} strokeWidth={1.8} aria-hidden className="shrink-0" />
      {t.dashboard.readiness.deltaWeek(Math.abs(rounded), days)}
    </span>
  )
}

/** The latest run as its own page names and judges it: today's once there is one, else yesterday's. */
export interface LatestRun {
  day: 'today' | 'yesterday'
  href: string
  title: string
  word: string
  tone: RunTone
}

const RUN_TONE_COLOR: Record<RunTone, string> = {
  positive: 'var(--pos)',
  neutral: 'var(--muted-foreground)',
  caution: 'var(--warn)',
}

function LatestRunRow({ run }: { run: LatestRun }) {
  return (
    <Link
      href={run.href}
      className="flex min-h-11 items-center gap-1.5 border-t border-border pt-2.5 text-subhead"
      data-testid="readiness-latest-run"
    >
      <span className="min-w-0 truncate text-muted-foreground">
        {t.dashboard.readiness.runDay[run.day]} · <span className="text-foreground">{run.title}</span> ·{' '}
        <span style={{ color: RUN_TONE_COLOR[run.tone] }}>{run.word}</span>
      </span>
      <ChevronRight size={16} aria-hidden className="ml-auto shrink-0 text-muted-foreground" />
    </Link>
  )
}

export function ReadinessCard({
  status,
  verdict = null,
  load = null,
  reason = null,
  latestRun = null,
  today = appTodayIso(),
}: {
  status: TrainingStatus | null
  verdict?: TodayVerdict | null
  /** The seven-day load reading Analytics prints, where the watch has one. */
  load?: LoadReading | null
  /** What the days around today say about the load, for a headline in range. */
  reason?: ReadinessReason | null
  latestRun?: LatestRun | null
  today?: string
}) {
  if (!status) return null

  const s = t.dashboard.readiness
  // Yesterday's text speaks of yesterday as today: the load's own words stand in until today's is written.
  const written = verdict?.yesterday ? null : verdict
  const form = Math.round(status.tsbNow)
  const tone = verdictTone(status)
  const color = load && load.state !== 'in' ? 'var(--warn)' : STATUS_COLOR[tone]
  const band = formBand(status.tsbNow)
  // After a long break form is the break itself, so it gets no number until there is a reading.
  const showForm = !status.buildingBack
  // One status: the Form number already says the band.
  const line = readinessEyebrow(status, load?.state ?? null)
  const fresh = band === 'fresh' || band === 'veryFresh'
  const loadWords = load ? s.fallback[load.state](load.acute, load.lo, load.hi, fresh) : null
  const fallback = loadWords && load?.state === 'in' && reason ? { ...loadWords, headline: reasonHeadline(reason) } : loadWords
  // A written headline that names a form state the status line doesn't ("You're fresh" over NEUTRAL) gives way to the load's own.
  const contradicts = written ? (!fresh && FRESH_WORDS.test(written.headline)) || (band !== 'tired' && TIRED_WORDS.test(written.headline)) : false
  const headline = (contradicts ? fallback?.headline : written?.headline) ?? fallback?.headline ?? written?.headline ?? null
  // Building back, the missing reading is said in a sentence rather than left as an empty Form tile.
  const body = written ? written.body : status.buildingBack ? s.formLater : (fallback?.body ?? null)

  return (
    <section className={cardClass()} data-testid="readiness-card">
      <div className="flex flex-col gap-2.5">
        <CheckInReadiness
          today={today}
          words={{ tone, color, line, headline, body }}
        />

        {/* The numbers alone open Load: a card-wide link took taps meant for the row under them. */}
        <Link
          href="/analytics"
          className={cn('grid gap-3 border-t border-border pt-3 transition-opacity active:opacity-70', showForm ? 'grid-cols-3' : 'grid-cols-2')}
          data-testid="readiness-card-link"
        >
          {showForm && <Tile testId="tile-form" label={s.formLabel} value={formatDelta(form)} />}
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
          {/* A name that holds the numbers on show: an aria-label alone would hide them from voice control (WCAG 2.5.3). */}
          <span className="sr-only">{s.open}</span>
        </Link>
        {latestRun && <LatestRunRow run={latestRun} />}
        {load?.estimated && (
          <p className="-mt-1 text-footnote text-muted-foreground" data-testid="readiness-estimated">
            {s.estimatedNote}
          </p>
        )}
      </div>
    </section>
  )
}
