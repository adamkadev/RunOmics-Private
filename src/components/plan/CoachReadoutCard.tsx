import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { CoachReadout } from '@/application/coaching/GetCoachReadout'
import type { CoachDecisionOutcome, NumberRange } from '@/domain/coaching/types'
import { cardClass } from '@/components/ui/Card'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'
import { VERDICT_TONE } from '@/components/activity/ControlledThresholdCard'
import { formatClock, formatDate, formatDistance, formatDuration, formatPace, formatWeekday } from '@/lib/formatters'
import { t } from '@/i18n'

const OUTCOME_TONE: Record<CoachDecisionOutcome, StatusTone> = { KEEP: 'good', ADJUST: 'amber', REPLAN: 'accent' }

const range = (band: NumberRange) => `${formatClock(band.min)}–${formatClock(band.max)}`

function Row({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-baseline gap-2 py-2.5 text-sm" data-testid={testId}>
      <span className="text-[13px] text-muted-foreground text-pretty">{label}</span>
      <div className="min-w-0 text-foreground text-pretty">{children}</div>
    </div>
  )
}

function Comparison({ comparison }: { comparison: NonNullable<CoachReadout['evaluation']>['comparison'] }) {
  const c = t.coaching
  const rows = [
    comparison.plannedDistanceMeters !== undefined && comparison.actualDistanceMeters !== undefined
      ? [c.distance, `${formatDistance(comparison.plannedDistanceMeters / 1_000)} ${t.units.km}`, `${formatDistance(comparison.actualDistanceMeters / 1_000)} ${t.units.km}`]
      : null,
    comparison.plannedDurationSeconds !== undefined && comparison.actualDurationSeconds !== undefined
      ? [t.activity.stats.duration, formatDuration(comparison.plannedDurationSeconds), formatDuration(comparison.actualDurationSeconds)]
      : null,
    comparison.plannedPaceSecPerKm !== undefined && comparison.actualPaceSecPerKm !== undefined
      ? [c.pace, range(comparison.plannedPaceSecPerKm), formatClock(comparison.actualPaceSecPerKm)]
      : null,
    comparison.plannedHrBpm !== undefined && comparison.actualAvgHrBpm !== undefined
      ? [c.heartRate, `${comparison.plannedHrBpm.min}–${comparison.plannedHrBpm.max}`, String(comparison.actualAvgHrBpm)]
      : null,
  ].filter((row): row is string[] => row !== null)
  if (rows.length === 0) return null
  return (
    <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 text-[13px] tabular-nums" data-testid="coach-comparison">
      <span />
      <span className="text-right text-caption uppercase tracking-[0.06em] text-muted-foreground">{c.planned}</span>
      <span className="text-right text-caption uppercase tracking-[0.06em] text-muted-foreground">{c.actual}</span>
      {rows.map(([label, planned, actual]) => (
        <div key={label} className="contents">
          <span className="truncate text-muted-foreground">{label}</span>
          <span className="text-right text-[var(--text-2)]">{planned}</span>
          <span className="text-right font-semibold text-foreground">{actual}</span>
        </div>
      ))}
    </div>
  )
}

/** Secondary to the week: what the coach last decided and what autoregulate reads now, as facts the athlete acts on. */
export function CoachReadoutCard({ readout, onSelectDate }: { readout: CoachReadout; onSelectDate: (date: string) => void }) {
  const r = t.coaching.readout
  const reps = t.coaching.controlledRun.repClass
  const { decision, evaluation, nextKey, controlled, guideProposals, fatigue, fitnessCheck } = readout
  const rows = Boolean(evaluation || nextKey || controlled || guideProposals.length > 0 || fatigue || fitnessCheck)
  if (!decision && !rows) return null

  return (
    <section className={cardClass({ padding: 'none', className: rows ? 'px-4 pb-1 pt-3.5' : 'px-4 py-3.5' })} data-testid="coach-readout">
      <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 ${rows ? 'pb-2.5' : ''}`}>
        <h2 className="text-headline text-foreground">{r.title}</h2>
        {decision && (
          <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground" data-testid="coach-decision">
            <StatusPill tone={OUTCOME_TONE[decision.outcome]}>{t.coaching.outcomes[decision.outcome]}</StatusPill>
            <span className="truncate">{`${r.triggers[decision.trigger]} · ${formatDate(decision.date)}`}</span>
          </span>
        )}
      </div>
      {rows && (
        <div className="divide-y divide-border border-t border-border">
          {controlled && (
            <Row label={r.threshold} testId="coach-threshold">
              <Link href={`/activities/${controlled.activityId}`} prefetch={false} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{`${formatWeekday(controlled.date, true)} · ${reps[controlled.repClass]}`}</span>
                  <StatusPill tone={VERDICT_TONE[controlled.verdict]}>{t.coaching.controlledRun.verdicts[controlled.verdict]}</StatusPill>
                </span>
                <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
              </Link>
            </Row>
          )}
          {guideProposals.map((proposal) => (
            <Row key={proposal.repClass} label={r.paceGuide} testId="coach-guide">
              <span className="whitespace-nowrap font-semibold tabular-nums">{r.guideChange(range(proposal.guide), range(proposal.proposedGuide))}</span>
              <span className="block text-xs text-muted-foreground">{r.proposed(reps[proposal.repClass])}</span>
            </Row>
          ))}
          {fatigue && (
            <Row label={r.easyRuns} testId="coach-fatigue">
              <span className="text-[var(--warn)]">{r.fatigue(fatigue.aboveNormalBpm)}</span>
            </Row>
          )}
          {fitnessCheck && (
            <Row label={r.fitnessCheck} testId="coach-check">
              <span className="tabular-nums">{r.check(formatDate(fitnessCheck.date), formatPace(fitnessCheck.paceSecPerKm), formatPace(fitnessCheck.impliedThresholdSecPerKm))}</span>
              {fitnessCheck.proposedGuides.length > 0 && <span className="block text-xs text-muted-foreground">{r.checkGuides}</span>}
            </Row>
          )}
          {evaluation && (
            <Row label={r.lastRun} testId="coach-evaluation">
              <Link href={`/activities/${evaluation.activityId}`} prefetch={false} className="flex items-center justify-between gap-2">
                <span>{formatWeekday(evaluation.date, true)}</span>
                <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
              </Link>
              <Comparison comparison={evaluation.comparison} />
            </Row>
          )}
          {nextKey && (
            <Row label={r.nextKey} testId="coach-next-key">
              <button type="button" onClick={() => onSelectDate(nextKey.date)} className="flex w-full items-center justify-between gap-2 text-left">
                <span className="min-w-0 truncate font-semibold">{`${formatWeekday(nextKey.date, true)} · ${nextKey.title}`}</span>
                <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
              </button>
            </Row>
          )}
        </div>
      )}
    </section>
  )
}
