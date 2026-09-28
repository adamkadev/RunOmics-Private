'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { ActivitySummary, ActivityType, PlannedWorkout, ScheduledTimeOfDay } from '@/domain/activity/types'
import { sessionZone } from '@/lib/colors'
import { sessionTitle } from './sessionTitle'
import type { HrBounds } from '@/domain/training/trimp'
import { weekPlanPhase } from '@/domain/training/weekPlanPhase'
import { EFFORT_ZONE_BY_TYPE } from '@/domain/training/workoutStructure'
import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'
import { weekTarget, type WeekTarget } from '@/domain/training/weekTarget'
import { formatWeekKm, resolveDayType, resolvePlannedType, weekPlanDays } from './weekPlanDays'
import { dayStateCells } from './dayStateCells'
import { SessionStateChip } from '@/components/ui/SessionCard'
import { cardClass } from '@/components/ui/Card'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { Stat, StatGrid, Unit } from '@/components/ui/Stat'
import { TypeDot } from '@/components/ui/TypeDot'
import type { WeekDayState } from '@/domain/training/weekTarget'
import { SessionStructureBar } from './WorkoutStructure'
import { PlanPhaseTrack } from './PlanPhaseTrack'
import { PlanPeriodNav } from './PlanPeriodNav'
import { WeekChart, WeekChartLegend } from './WeekChart'
import { adherenceTone, planAdherence, PLAN_ADHERENCE_AIM } from './weekStats'
import { planRace, raceWeekLabel } from './planRace'
import { paceLabel, stepClock, stepSeconds, workoutSummary } from './workoutSummary'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import type { PlanSpan } from '@/domain/training/planProgress'
import { addDays, isoDate } from '@/lib/calendarDate'
import { formatClock, formatDate, formatDateRange, formatDistance, formatDurationWords, formatPace, formatPlannedKm, formatRanKm } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { PlanCoachingView, PlanPrescriptionView } from './planCoachingView'
import {
  macrocyclePhaseRanges,
  macrocycleWeek,
  prescriptionDistanceMeters,
} from '@/components/coaching/presentation'
import {
  coachWorkoutView,
  doneDaySteps,
  plannedWorkoutView,
  type PlanWorkoutView,
} from './planWorkoutView'

interface Day {
  date: string
  acts: ActivitySummary[]
}

// effort already reads "Z2 easy · 5:10-6:27 /km" for the sheet and the old
// subtitle - split off the pace range here, display-only, so this card alone
// can put "target" in front of it without reshaping that shared string.
const EFFORT_PACE = /^(.*?)\s*·\s*(\d{1,2}:\d{2}[-–]\d{1,2}:\d{2}\s*\/km)$/

function splitEffort(effort: string | null): { band: string | null; pace: string | null } {
  if (!effort) return { band: null, pace: null }
  const match = effort.match(EFFORT_PACE)
  return match ? { band: match[1] ?? null, pace: match[2] ?? null } : { band: effort, pace: null }
}

// The 42px shoe glyph said "this is a run" on a screen where everything is a
// run, and it cost the structure bar its width. The session name carries the
// card now; everything else - duration, zone, pace - moved down into one
// detail line. Time of day is dropped from it entirely: it isn't a plan
// instruction, and on a narrow card it was the reason the pace range (the one
// number worth reading) got truncated.
//
// A planned session with no logged activity is a read-only statement of what
// is prescribed, not a control - there is nowhere for a tap to go, so this is
// a plain div: no onClick, no chevron, no hover/press state.
function PlannedWorkoutRow({ workout }: { workout: PlanWorkoutView }) {
  // The same reading as Today's hero (workoutSummary): the title, the
  // duration and distance, then each pace by name - "easy 5:30–6:24 ·
  // strides 3:35" - never one merged range (H02).
  const summary = workoutSummary(workout)
  const { band } = splitEffort(workout.effort)
  const detail = [
    summary.durationSeconds ? formatDurationWords(summary.durationSeconds) : null,
    summary.distanceM ? `${formatPlannedKm(summary.distanceM / 1000)} ${t.units.km}` : null,
    ...summary.paces.map(paceLabel),
  ]
    .filter(Boolean)
    .join(' · ') || t.plan.planned
  const zoneWord = band?.split(' ')[0] ?? null

  return (
    <div data-testid={`plan-workout-row-${workout.key}`} className={cardClass()}>
      <div className="break-words text-[15px] font-semibold text-foreground text-pretty">{summary.title}</div>
      <div className="mt-1 text-[13px] leading-normal text-muted-foreground">{detail}</div>
      {workout.duration && (
        <div className="mt-3.5">
          <SessionStructureBar
            steps={workout.structure ?? []}
            zoneWord={zoneWord}
            zone={workout.type ? sessionZone(workout) : null}
            totalSeconds={workout.duration.seconds}
          />
        </div>
      )}
    </div>
  )
}

// Rest is a prescribed state, not a missing render - it gets the same shell
// as any other day, dashed and unfilled (v4.17).
function RestDayCard({ next }: { next: { weekday: string; title: string } | null }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-dashed border-[var(--line-2)] px-5 py-4">
      <div className="text-[15px] font-semibold text-foreground">{t.plan.restCard.title}</div>
      <div className="text-[13px] text-muted-foreground">
        {next ? t.plan.restCard.next(next.weekday, next.title) : t.plan.restCard.noSession}
      </div>
    </div>
  )
}

function findNextPlanned(
  days: Day[],
  fromDate: string,
  byDatePlanned: Map<string, PlannedWorkout>,
  byDateCoach?: ReadonlyMap<string, PlanPrescriptionView[]>
): { weekday: string; title: string } | null {
  const fromIndex = days.findIndex((d) => d.date === fromDate)
  if (fromIndex === -1) return null

  for (let i = fromIndex + 1; i < days.length; i++) {
    const d = days[i]!
    const coach = byDateCoach?.get(d.date)?.find((v) => v.state !== 'cancelled')
    const plan = byDatePlanned.get(d.date)
    const title = coach?.prescription.title ?? sessionTitle(plan?.name, plan?.type as ActivityType | undefined) ?? null
    if (title) return { weekday: WEEKDAY_SHORT_INDEX[new Date(d.date + 'T00:00:00').getDay()]!, title }
  }
  return null
}

const WEEKDAY_SHORT_INDEX: Record<number, string> = {
  0: t.plan.weekdays[6] ?? 'Sun',
  1: t.plan.weekdays[0] ?? 'Mon',
  2: t.plan.weekdays[1] ?? 'Tue',
  3: t.plan.weekdays[2] ?? 'Wed',
  4: t.plan.weekdays[3] ?? 'Thu',
  5: t.plan.weekdays[4] ?? 'Fri',
  6: t.plan.weekdays[5] ?? 'Sat',
}

interface WeekRowItem {
  key: string
  date: string
  title: string
  /** The row's second line: a run's time and pace, a plan's zone and targets. */
  detail: string | null
  distanceM: number | null
  duration: { seconds: number; estimated: boolean } | null
  scheduledTime?: ScheduledTimeOfDay
  type?: ActivityType
  done: boolean
}

/**
 * A planned session's target, as its row writes it (v4.17): the zone, the
 * paces by name, and the recovery between reps - "Z4 · 4:22–4:28 /km · 4:00
 * rec". The title already names the reps; a type-less Garmin plan has no zone
 * to state.
 */
function plannedRowDetail(view: PlanWorkoutView): string | null {
  const summary = workoutSummary(view)
  const r = t.plan.row
  const paces = summary.paces.map(({ kind, pace }) => {
    const range = `${formatClock(pace[0])}–${formatClock(pace[1])}`
    return kind === 'strides' ? r.stridesPace(formatClock(pace[0])) : kind === 'easy' ? r.easyPace(range) : r.pace(range)
  })
  if (paces.length === 0) {
    // A one-block session has no steps to read: its pace is the effort's.
    const { pace } = splitEffort(view.effort)
    if (pace) paces.push(r.pace(pace.replace(/\s*\/km$/, '').replace('-', '–')))
  }
  const recovery = summary.paces.some((p) => p.kind === 'work') ? view.structure?.find((step) => step.kind === 'recovery') : undefined
  return (
    [
      view.type ? t.trainingZones.zoneNumber(sessionZone(view)) : null,
      ...paces,
      recovery ? r.recovery(stepClock(stepSeconds(recovery))) : null,
    ]
      .filter(Boolean)
      .join(' · ') || null
  )
}

/** A run's row: how long, and how fast. */
function doneRowDetail(acts: ActivitySummary[]): string | null {
  const seconds = acts.reduce((sum, a) => sum + a.durationSeconds, 0)
  const km = acts.reduce((sum, a) => sum + a.distanceKm, 0)
  return [seconds > 0 ? formatDurationWords(seconds) : null, seconds > 0 && km > 0 ? formatPace(seconds / km) : null].filter(Boolean).join(' · ') || null
}

// One row per session (v4.17): the day, the type's dot, the title over its
// target, the km, a chevron - the dot is the same zone the chart tints the
// day's bar in. A done row carries a check by its km and a missed one the
// word, so a missed session reads as missed in the list as well as in the
// chart.
function WeekSessionRow({
  workout,
  state,
  onTap,
  isToday = false,
}: {
  workout: WeekRowItem
  state: WeekDayState
  onTap: () => void
  /** Today's row: an accent day label. */
  isToday?: boolean
}) {
  const weekday = WEEKDAY_SHORT_INDEX[new Date(workout.date + 'T00:00:00').getDay()]
  const distanceKm = workout.distanceM ? workout.distanceM / 1000 : null
  const km = distanceKm === null ? null : state === 'done' ? formatRanKm(distanceKm) : formatWeekKm(distanceKm)

  return (
    <button
      type="button"
      onClick={onTap}
      data-testid={`week-session-${workout.key}`}
      className="grid w-full grid-cols-[2.25rem_0.5rem_minmax(0,1fr)_auto_1rem] items-center gap-3 border-b border-border px-5 py-3.5 text-left transition-colors last:border-b-0 hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)] sm:grid-cols-[3rem_0.75rem_minmax(0,1fr)_auto_1rem]"
    >
      <span
        data-testid={isToday ? 'week-session-today-day' : undefined}
        className={cn('text-[13px]', isToday ? 'font-semibold text-accent-text' : 'text-muted-foreground')}
      >
        {weekday}
      </span>
      <TypeDot type={workout.type} size={8} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="break-words text-sm font-semibold text-foreground text-pretty">{workout.title}</span>
        {(workout.detail || state === 'missed') && (
          <span className="break-words text-xs text-muted-foreground text-pretty">
            {state === 'missed' && <span className="font-medium text-[var(--neg)]">{t.sessionState.missed}</span>}
            {state === 'missed' && workout.detail && ' · '}
            {workout.detail}
          </span>
        )}
      </span>
      <span className="flex items-baseline gap-1.5 whitespace-nowrap text-sm font-semibold text-foreground">
        {state === 'done' && (
          <span className="text-[13px] text-[var(--pos)]" aria-label={t.sessionState.done}>
            ✓
          </span>
        )}
        {km !== null && (
          <span>
            {km}
            <Unit>{t.units.km}</Unit>
          </span>
        )}
      </span>
      <ChevronRight size={16} aria-hidden="true" className="text-subtle" />
    </button>
  )
}

// The week's three stats (v4.17): the distance and the sessions, each against
// the plan, and how much of what was due was run. Distance is the same
// WeekTarget Today's ring and Activities read: what was run against what the
// plan scheduled. It used to add the run km to whatever was still planned,
// missed days included, and call the sum the week.
function WeekStats({ target, notStarted }: { target: WeekTarget; notStarted: boolean }) {
  const s = t.plan.stats
  const w = t.plan.weekSummary
  const planKm = target.planKm
  const distance =
    planKm === null
      ? { value: formatWeekKm(target.ranKm), unit: t.units.km }
      : notStarted
        ? { value: formatWeekKm(planKm), unit: s.kmPlanned }
        : { value: formatRanKm(target.ranKm), unit: s.ofKm(formatWeekKm(planKm)) }
  const sessions =
    planKm === null
      ? { value: String(target.ranSessions), unit: null }
      : notStarted
        ? { value: String(target.planSessions), unit: s.planned }
        : { value: String(target.plannedDone), unit: s.ofSessions(target.planSessions) }
  const missed = planKm === null ? 0 : target.missedSessions
  const unplanned = planKm === null ? 0 : target.unplannedRuns
  const adherence = planAdherence(target)

  return (
    <div data-testid="week-summary" className="flex flex-col gap-3 border-t border-border pt-3.5">
      <StatGrid columns={3}>
        <Stat label={s.distance} value={distance.value} unit={distance.unit} />
        <Stat
          label={s.sessions}
          value={sessions.value}
          unit={sessions.unit}
          meaning={
            missed > 0 || unplanned > 0 ? (
              <>
                {missed > 0 && <span className="text-[var(--neg)]">{w.missed(missed)}</span>}
                {missed > 0 && unplanned > 0 && ' · '}
                {unplanned > 0 && w.unplanned(unplanned)}
              </>
            ) : null
          }
        />
        <Stat
          label={s.adherence}
          value={adherence === null ? '—' : `${adherence}%`}
          meaning={planKm === null ? s.noPlan : s.adherenceAim(PLAN_ADHERENCE_AIM)}
          tone={adherenceTone(adherence)}
        />
      </StatGrid>
    </div>
  )
}

interface Props {
  weekStart: Date
  byDate: Map<string, ActivitySummary[]>
  byDatePlanned: Map<string, PlannedWorkout>
  byDateCoach?: ReadonlyMap<string, PlanPrescriptionView[]>
  coaching?: PlanCoachingView | null
  onSelectDate?: (date: string) => void
  hrBounds?: HrBounds
  today: string
  atPresent: boolean
  onToday: () => void
  onPrevWeek?: () => void
  onNextWeek?: () => void
  canGoForward?: boolean
  planPhaseRanges: PlanPhaseRange[]
  nextRace?: UpcomingRace | null
  trainingZones?: TrainingZonesData | null
  planSpan?: PlanSpan | null
  initialSelectedDate?: string | null
}

export function WeekView({
  weekStart,
  byDate,
  byDatePlanned,
  byDateCoach,
  coaching = null,
  onSelectDate,
  today,
  atPresent,
  onToday,
  onPrevWeek,
  onNextWeek,
  canGoForward = false,
  planPhaseRanges,
  nextRace,
  trainingZones = null,
  initialSelectedDate,
}: Props) {
  const days: Day[] = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = isoDate(addDays(weekStart, i))
        return { date, acts: byDate.get(date) ?? [] }
      }),
    [weekStart, byDate]
  )
  const firstDay = days[0]!
  const lastDay = days[days.length - 1]!

  const [selectedDate, setSelectedDate] = useState(
    () =>
      days.find((d) => d.date === initialSelectedDate)?.date ??
      days.find((d) => d.date === today)?.date ??
      firstDay.date
  )
  const selected = days.find((d) => d.date === selectedDate) ?? firstDay
  const selectedPlan = byDatePlanned.get(selected.date)

  function selectDate(date: string) {
    setSelectedDate(date)
    onSelectDate?.(date)
  }

  function activityTitle(a: ActivitySummary): string {
    if (a.description && a.description !== t.activityTypes[a.type]) return a.description
    return sessionTitle(selectedPlan?.name, a.type) ?? a.description ?? t.activityTypes[a.type]
  }

  const selectedWorkouts = useMemo<PlanWorkoutView[]>(() => {
    const plan = byDatePlanned.get(selected.date) ?? null
    const coach = byDateCoach?.get(selected.date) ?? []
    if (coach.length > 0) {
      const garmin = coach.length === 1 ? plan : null
      return coach.map((view) => coachWorkoutView(view, trainingZones, garmin))
    }
    return plan ? [plannedWorkoutView(plan, trainingZones)] : []
  }, [byDatePlanned, byDateCoach, selected.date, trainingZones])

  // Every day this week that did something, logged or planned, the strip's
  // bars as a tappable list - including the selected day itself, so the
  // label ("This week," not "Rest of the week") never disagrees with days
  // the list actually shows. It used to drop a day once it was completed and
  // exclude whichever day was selected; either one alone could empty the
  // section, or leave it showing only days on one side of today, while its
  // old name promised what was left of the week.
  const thisWeekSessions = useMemo<WeekRowItem[]>(() => {
    return days
      .flatMap((d): WeekRowItem[] => {
        if (d.acts.length > 0) {
          // The dot shows what was recorded, same resolver as the chart's
          // bar - the day card spells out a divergence. The title's
          // generic fallback has to name that same resolved type, not just
          // whichever activity happens to be first: a day with an easy run
          // and a hard interval session resolves (and paints) as the hard
          // one, and the label can't disagree with the dot next to it.
          const plannedType = resolvePlannedType(d.date, byDatePlanned, byDateCoach)
          const resolved = resolveDayType(d.acts, plannedType)!
          const primaryAct = d.acts.find((a) => a.type === resolved.type) ?? d.acts[0]!
          const title = primaryAct.description && primaryAct.description !== t.activityTypes[primaryAct.type]
            ? primaryAct.description
            : t.activityTypes[resolved.type]
          return [{
            key: `done:${d.date}`,
            date: d.date,
            title,
            detail: doneRowDetail(d.acts),
            distanceM: d.acts.reduce((sum, a) => sum + a.distanceKm, 0) * 1000,
            duration: { seconds: d.acts.reduce((sum, a) => sum + a.durationSeconds, 0), estimated: false },
            type: resolved.type,
            done: true,
          }]
        }
        const coach = (byDateCoach?.get(d.date) ?? []).filter((v) => v.state !== 'cancelled')
        if (coach.length > 0) {
          const plan = byDatePlanned.get(d.date) ?? null
          // Titled by workoutSummary, as the day card and Today title it.
          return coach.map((view) => {
            const planned = coachWorkoutView(view, trainingZones, coach.length === 1 ? plan : null)
            return { ...planned, title: workoutSummary(planned).title, detail: plannedRowDetail(planned), done: false }
          })
        }
        const plan = byDatePlanned.get(d.date)
        if (!plan) return []
        const planned = plannedWorkoutView(plan, trainingZones)
        return [{ ...planned, title: workoutSummary(planned).title, detail: plannedRowDetail(planned), done: false }]
      })
  }, [days, byDateCoach, byDatePlanned, trainingZones])

  // Same priority as resolveDayType and the strip: a day that was actually
  // run counts as what was run, regardless of whether a coach/Garmin entry
  // exists for it. Reading straight from the plan for every day - as this
  // used to - silently dropped any completed day the plan didn't cover,
  // undercounting volume and sessions against what the strip and "this week"
  // list both show for the same week.
  const coachPhaseRanges = useMemo(
    () => (coaching ? macrocyclePhaseRanges(coaching.plan) : []),
    [coaching]
  )

  // The title used to read Garmin's phase ranges while the track below it read the
  // coaching plan's, so a known Base week still degraded to the "This week" fallback.
  const planPhase = useMemo(
    () => weekPlanPhase(days.map((d) => d.date), coachPhaseRanges.length ? coachPhaseRanges : planPhaseRanges),
    [days, coachPhaseRanges, planPhaseRanges]
  )

  // Bound to the displayed week, not the real "today" - otherwise paging to
  // any other week still read the current week's number, so every week in
  // the block looked like the same week.
  const targetWeek = coaching ? macrocycleWeek(coaching.plan, firstDay.date) : null

  // The race the block builds to: its week closes the phase card, and the
  // header counts down to it (v4.17).
  const race = useMemo(() => planRace(coaching, nextRace, today), [coaching, nextRace, today])

  const weekOver = lastDay.date < today
  const isCurrentWeek = !weekOver && firstDay.date <= today

  // weekPlanPhase returns null both when the coach/Garmin ranges don't cover
  // this week at all (before the plan starts) and for other gaps - only the
  // first of those gets its own label, so a bare week counter never renders
  // for a week the ranges simply don't reach yet.
  const activePhaseRanges = coaching ? coachPhaseRanges : planPhaseRanges
  const isPrePlan = planPhase === null && activePhaseRanges.length > 0 && lastDay.date < activePhaseRanges[0]!.startDate

  const phaseLabel = planPhase
    ? t.plan.weekPurpose.planPhase[planPhase]
    : isPrePlan
      ? t.plan.weekPurpose.prePlan
      : null
  const weekOfLabel = !isPrePlan && targetWeek ? t.plan.weekPurpose.weekOfTarget(targetWeek.done, targetWeek.total) : null
  const fallbackLabel = phaseLabel || weekOfLabel ? null : weekOver ? null : isCurrentWeek ? t.plan.weekPurpose.thisWeek : t.plan.weekPurpose.upcoming

  const target = useMemo(
    () => weekTarget(weekPlanDays(days.map((d) => d.date), { byDate, byDatePlanned, byDateCoach: byDateCoach ?? new Map() }), today, null),
    [days, byDate, byDatePlanned, byDateCoach, today]
  )

  const isTodaySelected = selected.date === today
  const dayEyebrow = isTodaySelected ? `${t.plan.today} · ${formatDate(selected.date)}` : formatDate(selected.date)
  const phaseRanges = coaching ? coachPhaseRanges : planPhaseRanges
  const phaseText = [phaseLabel, weekOfLabel].filter(Boolean)

  return (
    <div className="flex flex-col gap-3.5">
      {(phaseText.length > 0 || fallbackLabel || race || phaseRanges.length >= 2) && (
        <section className={cardClass({ className: 'flex flex-col gap-2.5 py-4' })}>
          {(phaseText.length > 0 || fallbackLabel || race) && (
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[13px]" data-testid="phase-line">
              <p className="min-w-0 text-muted-foreground">
                {phaseText.length > 0 ? (
                  <>
                    {/* The phase in ink, where the plan is in it; the week count muted beside it. */}
                    <span className="font-semibold text-foreground">{phaseText[0]}</span>
                    {phaseText[1] && ` · ${phaseText[1]}`}
                  </>
                ) : (
                  fallbackLabel
                )}
              </p>
              {race && <p className="shrink-0 text-muted-foreground">{raceWeekLabel(race)}</p>}
            </div>
          )}
          {/* The displayed week's own range, not the real `today` - the track
              otherwise always lit whichever phase covers the actual current
              date, so a pre-plan week in August still showed Base (today's
              phase) as active; and a single reference day disagreed with the
              header whenever a phase boundary fell mid-week. */}
          <PlanPhaseTrack ranges={phaseRanges} weekStart={firstDay.date} weekEnd={lastDay.date} />
        </section>
      )}

      <section className={cardClass({ className: 'flex flex-col gap-4 pt-4' })}>
        <PlanPeriodNav
          label={formatDateRange(firstDay.date, lastDay.date)}
          onPrev={() => onPrevWeek?.()}
          onNext={() => onNextWeek?.()}
          nextDisabled={atPresent && !canGoForward}
          onToday={atPresent ? null : onToday}
        />
        {/* State in shape - accent done, dashed planned, negative missed,
            today outlined - so a missed session never draws as the same bar
            as one still to come. */}
        <WeekChart
          days={dayStateCells(target.days, today, 'short').map((cell) => {
            const coach = byDateCoach?.get(cell.date) ?? []
            if (coach.length === 0) return cell
            return {
              ...cell,
              detail: coach.map((view) => `${view.prescription.title} · ${t.coaching.states[view.state]}`).join(', '),
              testId: `coach-calendar-${cell.date}`,
            }
          })}
          selectedDate={selected.date}
          onSelect={selectDate}
        />
        <WeekChartLegend />
        <WeekStats
          target={target}
          notStarted={firstDay.date > today && target.ranSessions === 0}
        />
      </section>

      {/* The selected day heads its card, above it. */}
      <p className={cn(EYEBROW_CLASS, 'px-1 pt-2', isTodaySelected ? 'text-accent-text' : 'text-muted-foreground')}>{dayEyebrow}</p>

      {selected.acts.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {selected.acts.map((a) => {
            // A coach prescription is only this activity's plan when it is
            // actually linked to it (activityId). Otherwise it may describe
            // a session that was swapped or skipped, and Garmin's own plan -
            // which tracks what was actually suggested for the day - is the
            // honest comparison.
            const coach = byDateCoach?.get(a.date)?.find((v) => v.state !== 'cancelled' && v.activityId === a.id)
            const plan = byDatePlanned.get(a.date)
            const plannedMeters = coach ? prescriptionDistanceMeters(coach.prescription) : (plan?.distanceM ?? null)
            const plannedKm = plannedMeters !== null ? Math.round(plannedMeters / 1000) : null
            const detail = [
              t.plan.ranKm(formatDistance(a.distanceKm)),
              plannedKm !== null ? t.plan.plannedKmLabel(plannedKm) : null,
              a.paceSecPerKm !== null ? formatPace(a.paceSecPerKm) : null,
              a.rpe !== null ? t.activities.row.rpeValue(a.rpe) : null,
            ]
              .filter(Boolean)
              .join(' · ')
            const zoneWord = EFFORT_ZONE_BY_TYPE[a.type] ?? null
            // A quiet note, not a warning: what was planned, what was run.
            const plannedType = resolvePlannedType(a.date, byDatePlanned, byDateCoach)
            const typeDivergence =
              plannedType && plannedType !== a.type
                ? t.plan.plannedVsRecorded(t.activityTypes[plannedType], t.activityTypes[a.type])
                : null

            return (
              <Link
                key={a.id}
                href={`/activities/${a.id}`}
                aria-label={`${activityTitle(a)}, ${formatDate(a.date)}, ${t.plan.viewActivity}`}
                className={cardClass({ className: 'block transition-colors hover:bg-[var(--surface-2)]' })}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 break-words text-[15px] font-semibold text-foreground text-pretty">{activityTitle(a)}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <SessionStateChip state="done" />
                    <ChevronRight size={18} className="text-subtle" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-1 text-[13px] leading-normal text-muted-foreground">{detail}</div>
                {typeDivergence && <div className="mt-0.5 text-xs text-subtle">{typeDivergence}</div>}
                <div className="mt-3.5">
                  <SessionStructureBar
                    steps={doneDaySteps(a.type, coach, plan)}
                    zoneWord={zoneWord}
                    zone={sessionZone(a)}
                    totalSeconds={a.durationSeconds}
                  />
                </div>
              </Link>
            )
          })}
        </div>
      ) : selectedWorkouts.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {selectedWorkouts.map((workout) => (
            <PlannedWorkoutRow key={workout.key} workout={workout} />
          ))}
        </div>
      ) : (
        <RestDayCard next={findNextPlanned(days, selected.date, byDatePlanned, byDateCoach)} />
      )}

      {thisWeekSessions.length > 0 && (
        <section className={cardClass({ padding: 'none', overflow: true })} data-testid="week-sessions">
          {thisWeekSessions.map((workout) => (
            <WeekSessionRow
              key={workout.key}
              workout={workout}
              state={target.days.find((d) => d.date === workout.date)?.state ?? 'planned'}
              onTap={() => selectDate(workout.date)}
              isToday={workout.date === today}
            />
          ))}
        </section>
      )}
    </div>
  )
}
