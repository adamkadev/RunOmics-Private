'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ActivitySummary } from '@/domain/activity/types'
import { sessionZone } from '@/lib/colors'
import { formatDurationWords, formatPace, formatPercent, formatPlannedKm, formatRanKm, formatWeekday } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { PlanWorkoutView } from './planWorkoutView'
import { kindLabel, type DayKind } from './sessionKind'
import { intensityBlocks, stepRows, type StepTone } from './workoutSteps'
import { paceLabel, workoutSummary } from './workoutSummary'

// Radius 24 and 18 pt padding: the selected day is the screen's hero card.
const CARD = 'rounded-3xl border border-border bg-card p-[18px] shadow-card'

const PROFILE_HEIGHT: Record<StepTone, number> = { ease: 16, recovery: 16, work: 54 }

/** "● WED 21 · THRESHOLD", in the session's colour. */
function Eyebrow({ date, kind }: { date: string; kind: DayKind | null }) {
  return (
    <p
      className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]"
      style={{ color: kind?.color ?? 'var(--muted-foreground)' }}
    >
      {kind && <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: kind.color }} />}
      <span>{[formatWeekday(date, true), kind ? kindLabel(kind.type, kind.kind) : null].filter(Boolean).join(' · ')}</span>
    </p>
  )
}

function Title({ children }: { children: ReactNode }) {
  return <h2 className="mt-1.5 break-words text-[25px] font-bold leading-tight tracking-[-0.01em] text-foreground text-pretty">{children}</h2>
}

/**
 * A session still to come (redesign 3.0, 1d): the eyebrow, the title, one
 * line of distance, time and target, then its intensity profile - each step
 * as wide as it lasts - and its steps. No send-to-watch and no list of the
 * week's other sessions: the day selector above already is the week.
 */
export function PlannedWorkoutCard({ workout, kind }: { workout: PlanWorkoutView; kind: DayKind }) {
  const summary = workoutSummary(workout)
  const totalSeconds = summary.durationSeconds ?? 0
  const subline = [
    summary.distanceM ? `${formatPlannedKm(summary.distanceM / 1000)} ${t.units.km}` : null,
    totalSeconds > 0 ? formatDurationWords(totalSeconds) : null,
    ...summary.paces.map(paceLabel),
  ]
    .filter(Boolean)
    .join(' · ')
  const blocks = intensityBlocks(workout.structure, totalSeconds, kind.color)
  const rows = stepRows({ steps: workout.structure, type: kind.type, kind: kind.kind, color: kind.color, totalSeconds, pace: effortPace(workout.effort) })

  return (
    <section data-testid={`plan-workout-${workout.key}`} className={CARD}>
      <Eyebrow date={workout.date} kind={kind} />
      <Title>{summary.title}</Title>
      {subline && <p className="mt-1 text-[13px] text-muted-foreground">{subline}</p>}
      <div aria-hidden data-testid="intensity-profile" className="mt-4 flex h-[54px] items-end gap-[3px]">
        {blocks.map((block, i) => (
          <span
            key={i}
            data-tone={block.tone}
            className="min-w-[3px] rounded-[4px]"
            style={{ flexGrow: block.seconds, flexBasis: 0, height: PROFILE_HEIGHT[block.tone], background: block.fill }}
          />
        ))}
      </div>
      <ol className="mt-3.5 border-t border-border" data-testid="workout-steps">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-3 border-b border-border py-[7px] last:border-b-0">
            <span aria-hidden className="h-7 w-1.5 shrink-0 rounded-full" style={{ background: row.fill }} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold text-foreground">{row.title}</span>
              {row.detail && <span className="text-[12.5px] text-muted-foreground">{row.detail}</span>}
            </span>
            <span className="shrink-0 text-[13px] tabular-nums text-[var(--text-2)]">{row.duration}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

// effort reads "Z2 easy · 5:10-6:27 /km": a session without steps takes its pace from it.
const EFFORT_PACE = /(\d{1,2}:\d{2})[-–](\d{1,2}:\d{2})\s*\/km$/

function effortPace(effort: string | null): string | null {
  const match = effort?.match(EFFORT_PACE)
  return match ? t.plan.row.pace(`${match[1]}–${match[2]}`) : null
}

function Line({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-2 py-1.5 text-sm" data-testid={testId}>
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="min-w-0 text-foreground">{children}</span>
    </div>
  )
}

/**
 * A day that is over, or run (redesign 3.0, 1d): what was planned against
 * what was done - "10 km easy" against "11.5 km · 5:47 /km · Z2 86% ✓" - and
 * a way into each run. A missed session says so; a run nothing was planned
 * for says that.
 */
export function DoneDayCard({
  date,
  kind,
  title,
  planned,
  acts,
  onPlan,
}: {
  date: string
  kind: DayKind | null
  title: string
  /** "10 km · Easy run": what the plan said for the day. */
  planned: string | null
  acts: ActivitySummary[]
  /** The day was planned and run: a check by what was done. */
  onPlan: boolean
}) {
  const zone = sessionZone({ type: kind?.type })
  return (
    <section data-testid={`plan-day-done-${date}`} className={CARD}>
      <Eyebrow date={date} kind={kind} />
      <Title>{title}</Title>
      <div className="mt-3 border-t border-border pt-1.5">
        <Line label={t.plan.dayCard.planned} testId="planned-line">
          {planned ?? <span className="text-muted-foreground">{t.plan.dayCard.notPlanned}</span>}
        </Line>
        {acts.length === 0 ? (
          <Line label={t.plan.dayCard.done} testId="done-line">
            <span className="font-semibold text-[var(--neg)]">{t.sessionState.missed}</span>
          </Line>
        ) : (
          acts.map((a) => {
            const share = a.hrZones.find((z) => z.zone === zone)?.percent
            return (
              <Line key={a.id} label={t.plan.dayCard.done} testId="done-line">
                <span className="font-semibold">{`${formatRanKm(a.distanceKm)} ${t.units.km}`}</span>
                {[
                  a.paceSecPerKm !== null ? formatPace(a.paceSecPerKm) : null,
                  share !== undefined ? `${t.trainingZones.zoneNumber(zone)} ${formatPercent(share)}` : null,
                ]
                  .filter(Boolean)
                  .map((part) => ` · ${part}`)
                  .join('')}
                {onPlan && (
                  <span className="ml-1.5 text-[var(--pos)]" role="img" aria-label={t.plan.dayCard.asPlanned}>
                    ✓
                  </span>
                )}
              </Line>
            )
          })
        )}
      </div>
      {acts.map((a) => (
        <Link
          key={a.id}
          href={`/activities/${a.id}`}
          className="mt-2 flex items-center justify-between gap-2 rounded-[14px] bg-[var(--surface-2)] px-3.5 py-3 text-sm font-semibold text-accent-text transition-colors hover:bg-[var(--line-2)]"
        >
          <span className="min-w-0 truncate">{acts.length > 1 ? t.plan.dayCard.viewNamed(a.description || t.activityTypes[a.type]) : t.plan.dayCard.viewActivity}</span>
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      ))}
    </section>
  )
}

/** Rest is a prescribed state, not a missing render: the day says so, and what comes next. */
export function RestDayCard({ date, next }: { date: string; next: { weekday: string; title: string } | null }) {
  return (
    <section data-testid="plan-rest-day" className={cn(CARD, 'border-dashed bg-transparent shadow-none')}>
      <Eyebrow date={date} kind={null} />
      <Title>{t.plan.restCard.title}</Title>
      <p className="mt-1 text-[13px] text-muted-foreground">{next ? t.plan.restCard.next(next.weekday, next.title) : t.plan.restCard.noSession}</p>
    </section>
  )
}
