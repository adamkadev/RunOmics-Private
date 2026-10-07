import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { Vo2GradeView } from '@/application/usecases/GetVo2Grade'
import { cardClass } from '@/components/ui/Card'
import { GlossaryTerm } from '@/components/ui/GlossaryTerm'
import { Unit } from '@/components/ui/Stat'
import { deltaColor } from '@/lib/deltaTone'
import { MINUS, PLUS_MINUS, formatKm } from '@/lib/formatters'
import { t } from '@/i18n'

export const VO2_GRADE_HREF = '/athlete/vo2max'
/** The grade card's own neutral band for the 30-day change (v5.3). */
export const GRADE_DELTA_FLAT = 0.3

const one = (n: number) => formatKm(n, 1)

/** "+0.8", "−0.4", or "±0.2" when the change is inside the neutral band (v4.17: signed, as every delta). */
export function gradeDelta(delta: number): string {
  if (Math.abs(delta) < GRADE_DELTA_FLAT) return `${PLUS_MINUS}${one(Math.abs(delta))}`
  return `${delta > 0 ? '+' : MINUS}${one(Math.abs(delta))}`
}

/** "Men 20–29" with the (i) that says where the bands come from. */
export function GradeBandLabel({ band }: { band: { sex: 'male' | 'female'; bracket: string } }) {
  return (
    <span className="text-xs text-muted-foreground" data-testid="grade-band">
      <GlossaryTerm term="vo2Grade">{t.vo2Grade.band(band.sex, band.bracket)}</GlossaryTerm>
    </span>
  )
}

/** The grade on its tile (v4.17): the accent on its soft tint, the athlete's own mark. */
function GradeTile({ children, testId }: { children: string; testId?: string }) {
  return (
    <span
      className="flex size-16 shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent-soft)] text-[34px] font-bold leading-none text-accent-text"
      data-testid={testId}
      aria-hidden={testId ? undefined : true}
    >
      {children}
    </span>
  )
}

const TITLE = 'text-[15px] font-semibold text-foreground'

/**
 * The grade hero on Athlete & zones (v5.3 G1, states in G4; v4.17): the
 * letter on an accent-soft tile, the value with its unit, the percentile in
 * text-2 and the 30-day change coloured by what it means; the bar to the
 * next grade in the accent, with the gap between its two ends. A level-up
 * says so in pos for three days; a drop is muted, with its reason where one
 * is known, never amber. The footer opens the ladder.
 */
export function Vo2GradeCard({ view }: { view: Vo2GradeView }) {
  const g = t.vo2Grade

  if (view.status === 'calibrating') {
    return (
      <section className={cardClass({ className: 'flex flex-col gap-3.5' })} data-testid="vo2-grade-card">
        <h2 className={TITLE}>{g.title}</h2>
        <div className="flex items-center gap-[18px]">
          <GradeTile>—</GradeTile>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {view.runsNeeded > 0 ? g.gradeIn(view.runsNeeded) : g.gradeAfter}
            </p>
            <div className="mt-2 flex flex-wrap gap-1" aria-label={g.calibrating} data-testid="grade-calibration">
              {Array.from({ length: view.runsTarget }, (_, i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: i < view.runs ? 'var(--accent)' : 'var(--line-2)' }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    )
  }

  const { grade, value, topPercent, band, delta30, next, floor, etaWeeks, change } = view
  const progress = next && floor !== null ? Math.min(1, Math.max(0, (value - floor) / (next.min - floor))) : null

  return (
    <section className={cardClass({ padding: 'none', overflow: true })} data-testid="vo2-grade-card">
      <div className="flex flex-col gap-3.5 px-5 pb-4 pt-[18px]">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={TITLE}>{g.title}</h2>
          <GradeBandLabel band={band} />
        </div>

        <div className="flex items-center gap-[18px]">
          <GradeTile testId="grade-letter">{grade}</GradeTile>
          <div className="flex min-w-0 flex-col gap-[3px]">
            {change?.kind === 'up' ? (
              <>
                <p className="text-sm font-semibold text-foreground">
                  {change.regained ? g.regainedGrade : g.newGrade} · <span className="text-[var(--pos)]" data-testid="grade-up">{g.upFrom(change.from)}</span>
                </p>
                <p className="text-[13px] text-[var(--text-2)]">
                  {one(value)} {g.unit} · {g.topForAgeInline(topPercent)}
                </p>
              </>
            ) : change?.kind === 'down' ? (
              <>
                <p className="text-sm font-semibold text-muted-foreground" data-testid="grade-down">{g.downFrom(change.from, change.daysOff)}</p>
                <p className="text-[13px] text-[var(--text-2)]">{g.dropNote}</p>
              </>
            ) : (
              <>
                <p className="text-[22px] font-semibold leading-tight text-foreground">
                  {one(value)}
                  <Unit>{g.unit}</Unit>
                </p>
                <p className="text-[13px] text-[var(--text-2)]">{g.topForAge(topPercent)}</p>
                {delta30 !== null && (
                  <p className="text-xs" data-testid="grade-delta" style={{ color: deltaColor('vo2max', delta30, { flatBelow: GRADE_DELTA_FLAT }) }}>
                    {gradeDelta(delta30)} {g.in30d}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {next && floor !== null && progress !== null && (
          <div className="flex flex-col gap-1.5" data-testid="grade-progress">
            <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 text-xs text-muted-foreground">
              <span>{grade} · {one(floor)}</span>
              <span data-testid="grade-gap">
                <b className="font-semibold text-foreground">{one(next.gap)}</b> {g.toGrade(next.grade)}
              </span>
              <span className="text-right">{next.grade} · {one(next.min)}</span>
            </div>
          </div>
        )}
      </div>

      {/* At the top grade the row read "Top grade for your age", which the
          A+ and its percentile already say, and gave no reason to tap it
          (design review, Oct 2026): it names the table it opens. */}
      <Link
        href={VO2_GRADE_HREF}
        aria-label={g.open}
        className="flex min-h-11 items-center justify-between gap-3 border-t border-border px-5 py-3 text-[13px] text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)]"
        data-testid="grade-footer"
      >
        <span className="min-w-0">{next && etaWeeks !== null ? g.eta(etaWeeks) : g.ladder}</span>
        <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </section>
  )
}
