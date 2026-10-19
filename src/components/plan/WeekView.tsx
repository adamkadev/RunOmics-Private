'use client'

import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ActivitySummary, ActivityType, PlannedWorkout } from '@/domain/activity/types'
import { weekTarget } from '@/domain/training/weekTarget'
import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { cardClass } from '@/components/ui/Card'
import { addDays, isoDate } from '@/lib/calendarDate'
import { formatDateRange, formatDurationWords, formatPlannedKm, formatRanKm, formatWeekday } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { PlanCoachingView, PlanPrescriptionView } from './planCoachingView'
import { coachWorkoutView, plannedWorkoutView, type PlanWorkoutView } from './planWorkoutView'
import { sessionTitle } from './sessionTitle'
import { dayKind, kindLetter } from './sessionKind'
import { formatWeekKm, weekPlanDays } from './weekPlanDays'
import { phaseWeek, planPhaseSpans, raceCountdown } from './planPhaseSpans'
import { planRace } from './planRace'
import { workoutSummary } from './workoutSummary'
import { DaySelector, type SelectorDay } from './DaySelector'
import { DoneDayCard, PlannedWorkoutCard, RestDayCard } from './PlanDayCard'

// 30 pt squares with the 44 pt hit area round them, beside the week's dates.
const NAV_BUTTON =
  'hit-44 flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-40'

/**
 * The phase the week is in (redesign 3.0, 1d): "General preparation" with
 * "Week 2 of 6 · Half in 29 wk" across from it, and under them one segment
 * per week of the phase, the weeks up to this one in the accent.
 */
function PhaseCard({ name, week, total, race }: { name: string; week: number; total: number; race: string | null }) {
  const p = t.plan.phase
  const weekOf = p.weekOf(total)
  return (
    <section className={cardClass({ padding: 'none', className: 'flex flex-col gap-2.5 px-3.5 py-3' })} data-testid="phase-line">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="text-[15px] font-semibold text-foreground">{name}</h2>
        <p className="text-xs text-muted-foreground">
          {weekOf.before} <b className="font-semibold text-foreground">{week}</b> {weekOf.after}
          {race && ` · ${race}`}
        </p>
      </div>
      <div aria-hidden className="flex gap-[3px]" data-testid="phase-segments">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} data-done={i < week || undefined} className={cn('h-[5px] flex-1 rounded-full', i < week ? 'bg-accent' : 'bg-[var(--line-2)]')} />
        ))}
      </div>
    </section>
  )
}

function findNextPlanned(
  dates: string[],
  fromDate: string,
  byDatePlanned: Map<string, PlannedWorkout>,
  byDateCoach?: ReadonlyMap<string, PlanPrescriptionView[]>
): { weekday: string; title: string } | null {
  for (const date of dates) {
    if (date <= fromDate) continue
    const coach = byDateCoach?.get(date)?.find((v) => v.state !== 'cancelled')
    const plan = byDatePlanned.get(date)
    // A line of prose: the coach's short name where there is one.
    const title = coach?.prescription.shortName ?? coach?.prescription.title ?? sessionTitle(plan?.name, plan?.type as ActivityType | undefined) ?? null
    if (title) return { weekday: formatWeekday(date), title }
  }
  return null
}

/** "10 km · Easy run": what a day's plan said, for its planned-against-done line. */
function plannedText(workout: PlanWorkoutView): string {
  const summary = workoutSummary(workout)
  const amount = summary.distanceM
    ? `${formatPlannedKm(summary.distanceM / 1000)} ${t.units.km}`
    : summary.durationSeconds
      ? formatDurationWords(summary.durationSeconds)
      : null
  return [amount, summary.shortTitle].filter(Boolean).join(' · ')
}

/** A day's planned sessions: the coach's where it has any, else Garmin's. */
function selectedWorkouts(
  date: string,
  byDatePlanned: Map<string, PlannedWorkout>,
  byDateCoach: ReadonlyMap<string, PlanPrescriptionView[]> | undefined,
  trainingZones: TrainingZonesData | null
): PlanWorkoutView[] {
  const plan = byDatePlanned.get(date) ?? null
  const coach = (byDateCoach?.get(date) ?? []).filter((v) => v.state !== 'cancelled')
  if (coach.length > 0) return coach.map((view) => coachWorkoutView(view, trainingZones, coach.length === 1 ? plan : null))
  return plan ? [plannedWorkoutView(plan, trainingZones)] : []
}

interface Props {
  weekStart: Date
  selectedDate: string
  onSelectDate: (date: string) => void
  byDate: Map<string, ActivitySummary[]>
  byDatePlanned: Map<string, PlannedWorkout>
  byDateCoach?: ReadonlyMap<string, PlanPrescriptionView[]>
  coaching?: PlanCoachingView | null
  today: string
  atPresent: boolean
  onToday: () => void
  onPrevWeek?: () => void
  onNextWeek?: () => void
  canGoForward?: boolean
  planPhaseRanges: PlanPhaseRange[]
  nextRace?: UpcomingRace | null
  trainingZones?: TrainingZonesData | null
}

/**
 * Plan's week (redesign 3.0, 1d): the phase, the week's km and runs against
 * the plan, the seven days, and the selected day's workout - its steps while
 * it is still to come, planned against done once it is over.
 */
export function WeekView({
  weekStart,
  selectedDate,
  onSelectDate,
  byDate,
  byDatePlanned,
  byDateCoach,
  coaching = null,
  today,
  atPresent,
  onToday,
  onPrevWeek,
  onNextWeek,
  canGoForward = false,
  planPhaseRanges,
  nextRace,
  trainingZones = null,
}: Props) {
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => isoDate(addDays(weekStart, i))), [weekStart])
  const firstDay = dates[0]!
  const lastDay = dates[6]!
  const selected = dates.includes(selectedDate) ? selectedDate : (dates.find((d) => d === today) ?? firstDay)

  const target = useMemo(
    () => weekTarget(weekPlanDays(dates, { byDate, byDatePlanned, byDateCoach: byDateCoach ?? new Map() }), today, null),
    [dates, byDate, byDatePlanned, byDateCoach, today]
  )

  const selectorDays = useMemo<SelectorDay[]>(
    () =>
      target.days.map((day) => {
        const kind = dayKind(day.date, byDate.get(day.date) ?? [], byDatePlanned, byDateCoach)
        return {
          date: day.date,
          state: day.state,
          km: day.state === 'done' ? day.ranKm : day.plannedKm,
          color: kind?.color ?? null,
          letter: kind && day.state !== 'rest' ? kindLetter(kind.type, kind.kind) : null,
          isToday: day.date === today,
        }
      }),
    [target, byDate, byDatePlanned, byDateCoach, today]
  )

  const phase = useMemo(() => phaseWeek(planPhaseSpans(coaching, planPhaseRanges), firstDay), [coaching, planPhaseRanges, firstDay])
  const race = useMemo(() => {
    const next = planRace(coaching, nextRace, today)
    return next ? raceCountdown(next, today) : null
  }, [coaching, nextRace, today])

  const acts = byDate.get(selected) ?? []
  const kind = dayKind(selected, acts, byDatePlanned, byDateCoach)
  const workouts = selectedWorkouts(selected, byDatePlanned, byDateCoach, trainingZones)

  function activityTitle(a: ActivitySummary): string {
    if (a.description && a.description !== t.activityTypes[a.type]) return a.description
    return sessionTitle(byDatePlanned.get(a.date)?.name, a.type) ?? t.activityTypes[a.type]
  }

  const w = t.plan.weekRow
  const planKm = target.planKm

  let dayCard
  if (acts.length > 0 || (selected < today && workouts.length > 0)) {
    dayCard = (
      <DoneDayCard
        date={selected}
        kind={kind}
        title={acts.length > 0 ? activityTitle(acts[0]!) : workoutSummary(workouts[0]!).title}
        planned={workouts[0] ? plannedText(workouts[0]) : null}
        acts={acts}
        onPlan={workouts.length > 0}
      />
    )
  } else if (workouts.length > 0 && kind) {
    dayCard = (
      <div className="flex flex-col gap-3">
        {workouts.map((workout) => (
          <PlannedWorkoutCard key={workout.key} workout={workout} kind={kind} />
        ))}
      </div>
    )
  } else {
    dayCard = <RestDayCard date={selected} next={selected < today ? null : findNextPlanned(dates, selected, byDatePlanned, byDateCoach)} />
  }

  return (
    <div className="flex flex-col gap-3.5">
      {phase && <PhaseCard name={phase.span.name} week={phase.week} total={phase.total} race={race} />}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1" data-testid="week-row">
        <div className="flex min-w-0 items-center gap-0.5">
          <button type="button" aria-label={t.plan.prevPeriod} onClick={() => onPrevWeek?.()} className={cn(NAV_BUTTON, '-ml-1.5')}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <h2 className="truncate text-base font-semibold text-foreground">{formatDateRange(firstDay, lastDay)}</h2>
          <button type="button" aria-label={t.plan.nextPeriod} onClick={() => onNextWeek?.()} disabled={atPresent && !canGoForward} className={NAV_BUTTON}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          {!atPresent && (
            <button
              type="button"
              onClick={onToday}
              className="hit-44 ml-1 shrink-0 rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-[13px] font-medium text-accent-text transition-colors hover:bg-[var(--line-2)]"
            >
              {t.plan.today}
            </button>
          )}
        </div>
        <p className="text-[13px] tabular-nums text-muted-foreground" data-testid="week-summary">
          <b className="font-semibold text-foreground">{formatRanKm(target.ranKm)}</b>
          {planKm === null ? ` ${t.units.km}` : ` ${w.kmOf(formatWeekKm(planKm))}`}
          {' · '}
          <b className="font-semibold text-foreground">{target.ranSessions}</b>
          {planKm === null ? ` ${w.runs(target.ranSessions)}` : ` ${w.runsOf(target.planSessions)}`}
        </p>
      </div>

      <DaySelector days={selectorDays} selectedDate={selected} onSelect={onSelectDate} />

      {dayCard}
    </div>
  )
}
