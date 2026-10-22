'use client'
import { setDaySkipped, useSkippedDays } from '@/lib/skippedDays'

import Link from 'next/link'
import { Check, ChevronRight } from 'lucide-react'
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
const CARD = 'content-card rounded-[24px] bg-card shadow-[var(--card-edge)] p-4'

// 44 pt at its tallest (F9), easy and recovery steps a third of it.
const PROFILE_HEIGHT: Record<StepTone, number> = { ease: 14, recovery: 14, work: 44 }

/** "WED 21 · THRESHOLD", in the session's colour (App Fixes 3b: no dot). */
function Eyebrow({ date, kind }: { date: string; kind: DayKind | null }) {
  return (
    <p
      className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]"
      style={{ color: kind?.color ?? 'var(--muted-foreground)' }}
    >
      <span>{[formatWeekday(date, true), kind ? kindLabel(kind.type, kind.kind) : null].filter(Boolean).join(' · ')}</span>
    </p>
  )
}

function Title({ children }: { children: ReactNode }) {
  return <h2 className="mt-1.5 break-words text-[25px] font-bold leading-tight tracking-[-0.01em] text-foreground text-pretty">{children}</h2>
}

/** A target of the session as a tile (App Fixes 3b): its name over the number. */
function TargetTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-[3px] rounded-[14px] bg-[var(--background)] px-3 py-2.5" data-testid="plan-target">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[15px] font-semibold tabular-nums text-foreground">{value}</span>
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
  const km = summary.distanceM ? `${formatPlannedKm(summary.distanceM / 1000)} ${t.units.km}` : null
  const time = totalSeconds > 0 ? formatDurationWords(totalSeconds) : null
  const subline = [km, time, ...(structured ? summary.paces.map(paceLabel) : [])].filter(Boolean).join(' · ')
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
      {structured ? (
        <>
          <Title>{summary.title}</Title>
          {subline && <p className="mt-1 text-[13px] text-muted-foreground">{subline}</p>}
        </>
      ) : (
        // One step (App Fixes 3b): the distance and time across from the
        // title, "10 km · 1:00 h", the km in ink.
        <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <h2 className="break-words text-2xl font-bold leading-tight tracking-[-0.02em] text-foreground text-pretty">{summary.title}</h2>
          {(km || time) && (
            <span className="text-sm text-[var(--text-2)]" data-testid="plan-amount">
              {km && <b className="font-semibold text-foreground">{km}</b>}
              {km && time && ' · '}
              {time}
            </span>
          )}
        </div>
      )}
      {structured && (
        // 10 pt under the detail line, 14 pt over the steps' divider (F9).
        <div aria-hidden data-testid="intensity-profile" className="mt-2.5 flex h-[44px] items-end gap-[3px]">
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
        <div className="mt-2.5 grid grid-cols-2 gap-2" data-testid="plan-targets">
          {paceTarget !== null && <TargetTile label={s.paceTarget} value={`${paceTarget} ${t.units.perKm}`} />}
          {hrCap !== null && <TargetTile label={hrZone ? s.hrTargetZone(hrZone) : s.hrTarget} value={`${s.hrCap(hrCap)} ${t.units.bpm}`} />}
        </div>
      )}
      {/* The steps only when there is more than one to read. */}
      {structured && (
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
      )}
    </section>
  )
}

/**
 * The week's next quality session (App Fixes 3b), under the day card: its
 * label in the session's colour, then "Wed 21 · Threshold 3 × 8′". A tap
 * selects its day.
 */
export function NextKeySessionCard({ weekday, title, color, onSelect }: { weekday: string; title: string; color: string; onSelect?: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center justify-between gap-3 content-card rounded-[24px] bg-card shadow-[var(--card-edge)] px-4 py-3 text-left transition-transform duration-100 ease-out active:scale-[0.98]"
      data-testid="next-key-session"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color }}>{t.plan.nextKeySession}</span>
        <span className="truncate text-sm font-semibold text-foreground">{`${weekday} · ${title}`}</span>
      </span>
      <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
    </button>
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
 * A missed session (Wave 5, Today › missed day): "Missed", and the way to say
 * it was skipped on purpose - sick or resting - which Today then draws as a
 * rest day and stops counting. Undone the same way.
 */
function MissedLine({ date }: { date: string }) {
  const skipped = useSkippedDays().has(date)
  const s = t.plan.dayCard
  return (
    <Line label={t.plan.dayCard.done} testId="done-line">
      {skipped ? (
        <span className="font-semibold text-muted-foreground" data-testid="skipped-mark">{s.skipped}</span>
      ) : (
        <span className="font-semibold text-[var(--warn)]">{t.sessionState.missed}</span>
      )}
      <button
        type="button"
        onClick={() => setDaySkipped(date, !skipped)}
        className="ml-2 text-[13px] font-medium text-accent-text"
        data-testid="skip-toggle"
      >
        {skipped ? s.undoSkip : s.markSkipped}
      </button>
    </Line>
  )
}

/**
 * A day that is over, or run (redesign 3.0, 1d): what was planned against
 * what was done - "10 km easy" against "11.5 km · 5:47 /km · Z2 86%", ticked - and
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
          <MissedLine date={date} />
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
                  <Check
                    size={13}
                    strokeWidth={3}
                    role="img"
                    aria-label={t.plan.dayCard.asPlanned}
                    className="ml-1.5 inline-block shrink-0 align-[-2px] text-[var(--pos)]"
                  />
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
    <section className="content-card rounded-[24px] bg-card shadow-[var(--card-edge)] px-4 pb-1 pt-3.5" data-testid="coming-up">
      <div className="flex items-baseline justify-between gap-3 pb-2">
        <h2 className="text-headline text-foreground">{c.title}</h2>
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
