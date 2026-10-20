'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ActivitySummary } from '@/domain/activity/types'
import { sessionZone } from '@/lib/colors'
import { sessionHrCapBpm } from '@/domain/training/hrTarget'
import { formatClock, formatDurationWords, formatPace, formatPercent, formatPlannedKm, formatRanKm, formatWeekday } from '@/lib/formatters'
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

/** A target of the session: its name on the left, the number on the right. */
function TargetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-[7px] last:border-b-0" data-testid="plan-target">
      <span className="min-w-0 text-[13px] text-muted-foreground">{label}</span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  )
}

/**
 * A session still to come (redesign 3.0, 1d): the eyebrow, the title, one
 * line of distance and time, then its intensity profile - each step as wide
 * as it lasts - and its steps. No send-to-watch and no list of the week's
 * other sessions: the day selector above already is the week (a rest day
 * lists them, 3.0.2, having nothing else to show).
 *
 * A session of one step has no structure to draw (App Fixes 3b): a full-width
 * block said "structured" about an easy run. It shows its targets instead -
 * the pace range, and the zone and bpm cap to hold.
 */
export function PlannedWorkoutCard({
  workout,
  kind,
  hrZoneBoundsBpm = null,
}: {
  workout: PlanWorkoutView
  kind: DayKind
  hrZoneBoundsBpm?: readonly number[] | null
}) {
  const s = t.plan.session
  const summary = workoutSummary(workout)
  const totalSeconds = summary.durationSeconds ?? 0
  const structured = (workout.structure?.length ?? 0) > 1
  const subline = [
    summary.distanceM ? `${formatPlannedKm(summary.distanceM / 1000)} ${t.units.km}` : null,
    totalSeconds > 0 ? formatDurationWords(totalSeconds) : null,
    // A one-step session carries its paces as targets under the card instead.
    ...(structured ? summary.paces.map(paceLabel) : []),
  ]
    .filter(Boolean)
    .join(' · ')
  const blocks = intensityBlocks(workout.structure, totalSeconds, kind.color)
  const rows = stepRows({ steps: workout.structure, type: kind.type, kind: kind.kind, color: kind.color, totalSeconds, pace: effortPace(workout.effort) })
  // A one-step session has no structure to read a pace off (the coach's
  // steps collapse to none), so its target comes from the effort line.
  const paceTarget = structured
    ? null
    : (summary.paces[0] ? `${formatClock(summary.paces[0].pace[0])}–${formatClock(summary.paces[0].pace[1])}` : effortPaceRange(workout.effort))
  const hrCap = sessionHrCapBpm(workout.hr, hrZoneBoundsBpm)
  const hrZone = workout.hr?.zone ?? null

  return (
    <section data-testid={`plan-workout-${workout.key}`} className={CARD}>
      <Eyebrow date={workout.date} kind={kind} />
      <Title>{summary.title}</Title>
      {subline && <p className="mt-1 text-[13px] text-muted-foreground">{subline}</p>}
      {structured && (
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
      )}
      {!structured && (paceTarget !== null || hrCap !== null) && (
        <div className="mt-3.5 border-t border-border" data-testid="plan-targets">
          {paceTarget !== null && <TargetRow label={s.paceTarget} value={`${paceTarget} ${t.units.perKm}`} />}
          {hrCap !== null && <TargetRow label={hrZone ? s.hrTargetZone(hrZone) : s.hrTarget} value={`${s.hrCap(hrCap)} ${t.units.bpm}`} />}
        </div>
      )}
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
  const range = effortPaceRange(effort)
  return range ? t.plan.row.pace(range) : null
}

/** Just the range out of an effort line: "5:30–6:24". */
function effortPaceRange(effort: string | null): string | null {
  const match = effort?.match(EFFORT_PACE)
  return match ? `${match[1]}–${match[2]}` : null
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

/**
 * Rest is a prescribed state, not a missing render (3.0.2: one line). The
 * day and "Rest day" on the left, the next session on the right; the week's
 * sessions are in Coming up under it.
 */
export function RestDayCard({ date, next }: { date: string; next: { weekday: string; title: string } | null }) {
  const r = t.plan.restCard
  return (
    <section
      data-testid="plan-rest-day"
      className="flex items-center justify-between gap-3 rounded-[18px] border border-dashed border-border px-4 py-3"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{`${formatWeekday(date, true)} · ${r.eyebrow}`}</p>
        <h2 className="text-[17px] font-semibold leading-tight text-foreground">{r.title}</h2>
      </div>
      {next && (
        <p className="flex min-w-0 flex-col items-end text-right text-xs text-muted-foreground" data-testid="rest-next">
          <span className="whitespace-nowrap">{r.next(next.weekday)}</span>
          <span className="max-w-full truncate">{next.title}</span>
        </p>
      )}
    </section>
  )
}

export interface ComingUpRow {
  key: string
  date: string
  title: string
  /** "Tue 20 · 10 km · 1:00 h". */
  detail: string
  color: string
}

/**
 * The week's sessions still to come (3.0.2), under a rest day: each row its
 * type's colour, its title and its day, distance and time; a tap selects
 * the day, as the day selector does.
 */
export function ComingUpCard({ rows, selectedDate, onSelect }: { rows: ComingUpRow[]; selectedDate: string; onSelect: (date: string) => void }) {
  const c = t.plan.comingUp
  return (
    <section className="rounded-3xl border border-border bg-card px-4 pb-1 pt-3.5 shadow-card" data-testid="coming-up">
      <div className="flex items-baseline justify-between gap-3 pb-2">
        <h2 className="text-[15px] font-semibold text-foreground">{c.title}</h2>
        <span className="text-xs text-muted-foreground">{c.hint}</span>
      </div>
      <ul>
        {rows.map((row) => (
          <li key={row.key} className="border-t border-border">
            <button
              type="button"
              onClick={() => onSelect(row.date)}
              aria-pressed={row.date === selectedDate}
              className="flex w-full items-center gap-3 py-3 text-left transition-opacity active:opacity-70"
              data-testid="coming-up-row"
            >
              <span aria-hidden className="h-8 w-1 shrink-0 rounded-full" style={{ background: row.color }} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold text-foreground">{row.title}</span>
                <span className="text-xs text-muted-foreground">{row.detail}</span>
              </span>
              <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
