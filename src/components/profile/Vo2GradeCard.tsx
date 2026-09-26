import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { Vo2GradeView } from '@/application/usecases/GetVo2Grade'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { GlossaryTerm } from '@/components/ui/GlossaryTerm'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { deltaColor } from '@/lib/deltaTone'
import { formatKm } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

export const VO2_GRADE_HREF = '/athlete/vo2max'
/** The grade card's own neutral band for the 30-day change (v5.3). */
export const GRADE_DELTA_FLAT = 0.3

const one = (n: number) => formatKm(n, 1)

/** "↑0.8", "↓0.4", or "±0.2" when the change is inside the neutral band. */
export function gradeDelta(delta: number): string {
  if (Math.abs(delta) < GRADE_DELTA_FLAT) return `±${one(Math.abs(delta))}`
  return `${delta > 0 ? '↑' : '↓'}${one(Math.abs(delta))}`
}

/** "Men 20–29" with the (i) that says where the bands come from. */
export function GradeBandLabel({ band }: { band: { sex: 'male' | 'female'; bracket: string } }) {
  return (
    <span className="text-footnote text-muted-foreground" data-testid="grade-band">
      <GlossaryTerm term="vo2Grade" quiet>{t.vo2Grade.band(band.sex, band.bracket)}</GlossaryTerm>
    </span>
  )
}

/**
 * The grade hero on Athlete & zones (v5.3 G1, states in G4). The letter and
 * the value are ink, never the accent and never --good; the accent is only
 * the progress fill, which is data. A level-up says so in --good for three
 * days; a drop is muted, with its reason where one is known, never amber.
 */
export function Vo2GradeCard({ view }: { view: Vo2GradeView }) {
  const g = t.vo2Grade

  if (view.status === 'calibrating') {
    return (
      <GlassSurface variant="card" className="rounded-card-sm px-4 py-4" data-testid="vo2-grade-card">
        <p className={cn(EYEBROW_CLASS, 'text-muted-foreground')}>{g.title}</p>
        <div className="mt-3 flex items-center gap-4">
          <span className="font-display text-[44px] font-bold leading-none text-foreground" aria-hidden>—</span>
          <div className="min-w-0">
            <p className="text-subhead font-semibold text-foreground">
              {view.runsNeeded > 0 ? g.gradeIn(view.runsNeeded) : g.gradeAfter}
            </p>
            <div className="mt-2 flex flex-wrap gap-1" aria-label={g.calibrating} data-testid="grade-calibration">
              {Array.from({ length: view.runsTarget }, (_, i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: i < view.runs ? 'var(--foreground)' : 'var(--band)' }}
                />
              ))}
            </div>
          </div>
        </div>
      </GlassSurface>
    )
  }

  const { grade, value, topPercent, band, delta30, next, floor, etaWeeks, change } = view
  const progress = next && floor !== null ? Math.min(1, Math.max(0, (value - floor) / (next.min - floor))) : null

  return (
    <GlassSurface variant="card" className="overflow-hidden rounded-card-sm" data-testid="vo2-grade-card">
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className={cn(EYEBROW_CLASS, 'text-muted-foreground')}>{g.title}</p>
          <GradeBandLabel band={band} />
        </div>

        <div className="mt-3 flex items-center gap-4">
          <span className="font-display text-[44px] font-bold leading-none text-foreground" data-testid="grade-letter">{grade}</span>
          <div className="min-w-0 space-y-0.5">
            {change?.kind === 'up' ? (
              <>
                <p className="text-subhead font-semibold text-foreground">
                  {g.newGrade} · <span className="text-[var(--good)]" data-testid="grade-up">{g.upFrom(change.from)}</span>
                </p>
                <p className="text-footnote text-muted-foreground">
                  {one(value)} · {g.topForAgeInline(topPercent)}
                </p>
              </>
            ) : change?.kind === 'down' ? (
              <>
                <p className="text-subhead font-semibold text-muted-foreground" data-testid="grade-down">{g.downFrom(change.from, change.daysOff)}</p>
                <p className="text-footnote text-muted-foreground">{g.dropNote}</p>
              </>
            ) : (
              <>
                <p className="font-display text-title3 font-bold leading-tight tabular-nums text-foreground">
                  {one(value)} <span className="font-sans text-footnote font-medium text-muted-foreground">{g.unit}</span>
                </p>
                <p className="text-footnote text-muted-foreground">{g.topForAge(topPercent)}</p>
                {delta30 !== null && (
                  <p className="text-footnote text-muted-foreground" data-testid="grade-delta">
                    <span style={{ color: deltaColor('vo2max', delta30, { flatBelow: GRADE_DELTA_FLAT }) }}>{gradeDelta(delta30)}</span> {g.in30d}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {next && floor !== null && progress !== null && (
          <div className="mt-4" data-testid="grade-progress">
            <div className="flex justify-between text-caption tabular-nums text-muted-foreground">
              <span>{grade} · {one(floor)}</span>
              <span>{next.grade} · {one(next.min)}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--track)]">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      <Link
        href={VO2_GRADE_HREF}
        aria-label={g.open}
        className="mt-4 flex min-h-11 items-center justify-between gap-3 border-t border-border px-4 py-3 text-footnote text-foreground"
        data-testid="grade-footer"
      >
        <span className="min-w-0">
          {next ? (
            <>
              {g.toNext(one(next.gap), next.grade)}
              {etaWeeks !== null && <span className="text-muted-foreground"> {g.eta(etaWeeks)}</span>}
            </>
          ) : (
            g.topGrade
          )}
        </span>
        <ChevronRight size={16} className="shrink-0 text-subtle" aria-hidden />
      </Link>
    </GlassSurface>
  )
}
