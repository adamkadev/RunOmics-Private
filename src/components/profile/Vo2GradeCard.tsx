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
/** A 30-day change under this reads as flat. */
export const GRADE_DELTA_FLAT = 0.3

const one = (n: number) => formatKm(n, 1)

export function gradeDelta(delta: number): string {
  if (Math.abs(delta) < GRADE_DELTA_FLAT) return `${PLUS_MINUS}${one(Math.abs(delta))}`
  return `${delta > 0 ? '+' : MINUS}${one(Math.abs(delta))}`
}

export function GradeBandLabel({ band }: { band: { sex: 'male' | 'female'; bracket: string } }) {
  return (
    <span className="text-xs text-muted-foreground" data-testid="grade-band">
      <GlossaryTerm term="vo2Grade">{t.vo2Grade.band(band.sex, band.bracket)}</GlossaryTerm>
    </span>
  )
}

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

  const { grade, value, topPercent, band, delta30, change } = view

  return (
    <Link
      href={VO2_GRADE_HREF}
      className={cardClass({ padding: 'none', className: 'flex items-center gap-4 rounded-[18px] px-4 py-4 transition-colors hover:bg-[var(--surface-2)]' })}
      data-testid="vo2-grade-card"
    >
      <GradeTile testId="grade-letter">{grade}</GradeTile>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-[22px] font-semibold leading-tight tabular-nums text-foreground">
          {one(value)}
          <Unit>{g.valueLabel}</Unit>
        </p>
        <p className="text-[13px] text-[var(--text-2)]" data-testid="grade-band">
          {g.topInBand(topPercent, band.sex, band.bracket)}
        </p>
        {change?.kind === 'up' ? (
          <p className="text-xs text-[var(--pos)]" data-testid="grade-up">
            {change.regained ? g.regainedGrade : g.newGrade} · {g.upFrom(change.from)}
          </p>
        ) : change?.kind === 'down' ? (
          <p className="text-xs text-muted-foreground" data-testid="grade-down">{g.downFrom(change.from, change.daysOff)}</p>
        ) : (
          delta30 !== null && (
            <p className="text-xs" data-testid="grade-delta" style={{ color: deltaColor('vo2max', delta30, { flatBelow: GRADE_DELTA_FLAT }) }}>
              {gradeDelta(delta30)} {g.in30d}
            </p>
          )
        )}
      </div>
      <ChevronRight size={18} className="shrink-0 text-subtle" aria-hidden />
    </Link>
  )
}
