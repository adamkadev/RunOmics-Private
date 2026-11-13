'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PlannedWorkout } from '@/domain/activity/types'
import type { BlockGuideProposal, NumberRange } from '@/domain/coaching/types'
import type { PlanRun } from './planRun'
import type { CrossTrainingEntry } from '@/domain/activity/crossTraining'
import { CrossTrainingList } from '@/components/crossTraining/CrossTraining'
import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { cardClass } from '@/components/ui/Card'
import { checkpointCycle } from '@/domain/training/cycleCheckpoint'
import { CHECKPOINT_HREF } from '@/components/checkpoint/checkpointHref'
import { addDays, isoDate } from '@/lib/calendarDate'
import { formatClock, formatDate, formatDateRange, formatDurationWords, formatPlannedKm, formatRanKm, formatWeekday } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { PlanCoachingView, PlanPrescriptionView } from './planCoachingView'
import { coachWorkoutView, plannedWorkoutView, type PlanWorkoutView } from './planWorkoutView'
import { sessionTitle } from './sessionTitle'
import { dayKind, kindLetter } from './sessionKind'
import { planWeekTarget } from './weekPlanDays'
import { generalBlockWeek, phaseWeek, planPhaseSpans, raceCountdown } from './planPhaseSpans'
import { planRace } from './planRace'
import { workoutSummary } from './workoutSummary'
import { DaySelector, type SelectorDay } from './DaySelector'
import { dayFit } from './dayFit'
import { isGenericName, namedType, sessionLabel } from '@/lib/activityTitle'
import { BlockFinishedCard, ComingUpCard, DoneDayCard, PlannedWorkoutCard, RestDayCard, type ComingUpRow } from './PlanDayCard'
import { blockCovers, blockLifecycle } from './blockLifecycle'
import { useCoachWords } from '@/components/coaching/useCoachWords'
import { useSkippedDays } from '@/lib/skippedDays'

const NAV_BUTTON =
  'hit-44 flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-40'

function proposalLine(proposal: BlockGuideProposal): string {
  const p = t.plan.phase
  const range = (guide: NumberRange) => `${formatClock(guide.min)}–${formatClock(guide.max)}`
  return p.guideProposal(p.repClass[proposal.repClass], range(proposal.guide), range(proposal.proposedGuide), p.proposalSource[proposal.source])
}

/** Phase over block, its weeks and the 12-week count in one card, the count's line opening the checkpoint. */
function PhaseCard({ phase, name, week, total, race, cycle, proposals = [] }: { phase: string | null; name: string; week: number; total: number; race: string | null; cycle: string | null; proposals?: BlockGuideProposal[] }) {
  const p = t.plan.phase
  const weekOf = p.weekOf(total)
  return (
    <section className={cardClass({ padding: 'none', className: 'relative flex flex-col gap-2.5 px-3.5 py-3' })} data-testid="phase-line">
      {phase && (
        <p className="-mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-text" data-testid="phase-eyebrow">
          <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          {phase}
        </p>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="text-headline text-foreground">{name}</h2>
        <p className="text-xs text-muted-foreground">
          {week === 0 ? p.leadIn : `${weekOf.before} ${week} ${weekOf.after}`}
          {race && ` · ${race}`}
        </p>
      </div>
      <div aria-hidden className="flex gap-[3px]" data-testid="phase-segments">
        {/* The week under way is half full: a full bar would say the block is done. */}
        {Array.from({ length: total }, (_, i) => (
          <span key={i} data-done={i < week - 1 || undefined} data-current={i === week - 1 || undefined} className={cn('relative h-[5px] flex-1 overflow-hidden rounded-full', i < week - 1 ? 'bg-accent' : 'bg-[var(--line-2)]')}>
            {i === week - 1 && <span className="absolute inset-y-0 left-0 w-1/2 bg-accent" />}
          </span>
        ))}
      </div>
      {proposals.map((proposal) => (
        <p key={`${proposal.source}:${proposal.repClass}`} className="text-xs text-muted-foreground" data-testid="phase-proposal">{proposalLine(proposal)}</p>
      ))}
      {cycle && (
        <Link href={CHECKPOINT_HREF} className="hit-44 flex items-center justify-between gap-2 border-t border-border pt-2.5 text-[13px] text-foreground" data-testid="phase-cycle">
          {cycle}
          <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        </Link>
      )}
    </section>
  )
}

function plannedText(workout: PlanWorkoutView, title: string): string {
  const summary = workoutSummary(workout)
  const km = summary.distanceM ? `${formatPlannedKm(summary.distanceM / 1000)} ${t.units.km}` : null
  const time = summary.durationSeconds ? formatDurationWords(summary.durationSeconds) : null
  const session = sessionLabel(summary.shortTitle)
  return [km, time, session === title ? null : session].filter(Boolean).join(' · ')
}

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

function comingUpRows(
  dates: string[],
  today: string,
  byDate: Map<string, PlanRun[]>,
  byDatePlanned: Map<string, PlannedWorkout>,
  byDateCoach: ReadonlyMap<string, PlanPrescriptionView[]> | undefined,
  trainingZones: TrainingZonesData | null
): ComingUpRow[] {
  return dates.flatMap((date) => {
    if (date < today || (byDate.get(date) ?? []).length > 0) return []
    const kind = dayKind(date, [], byDatePlanned, byDateCoach)
    if (!kind) return []
    return selectedWorkouts(date, byDatePlanned, byDateCoach, trainingZones).map((workout) => {
      const summary = workoutSummary(workout)
      const detail = [
        formatWeekday(date, true),
        summary.distanceM ? `${formatPlannedKm(summary.distanceM / 1000)} ${t.units.km}` : null,
        summary.durationSeconds ? formatDurationWords(summary.durationSeconds) : null,
      ]
      return { key: workout.key, date, title: summary.shortTitle, detail: detail.filter(Boolean).join(' · '), color: kind.color }
    })
  })
}

interface Props {
  weekStart: Date
  selectedDate: string
  onSelectDate: (date: string) => void
  byDate: Map<string, PlanRun[]>
  byDateOther?: ReadonlyMap<string, CrossTrainingEntry[]>
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
  hrZoneBoundsBpm?: readonly number[] | null
  exploreAvailable?: boolean
}

export function WeekView({
  weekStart,
  selectedDate,
  onSelectDate,
  byDate,
  byDateOther,
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
  hrZoneBoundsBpm = null,
  exploreAvailable = false,
}: Props) {
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => isoDate(addDays(weekStart, i))), [weekStart])
  const firstDay = dates[0]!
  const lastDay = dates[6]!
  const selected = dates.includes(selectedDate) ? selectedDate : (dates.find((d) => d === today) ?? firstDay)

  const target = useMemo(
    () => planWeekTarget(dates, { byDate, byDatePlanned, byDateCoach: byDateCoach ?? new Map() }, today, null),
    [dates, byDate, byDatePlanned, byDateCoach, today]
  )

  const skipped = useSkippedDays()
  const selectorDays = useMemo<SelectorDay[]>(
    () =>
      target.days.map((day) => {
        const kind = dayKind(day.date, byDate.get(day.date) ?? [], byDatePlanned, byDateCoach)
        return {
          date: day.date,
          state: day.state === 'missed' && skipped.has(day.date) ? 'rest' : day.state,
          km: day.state === 'done' ? (day.runs > 0 ? day.ranKm : null) : day.plannedKm,
          color: kind?.color ?? null,
          text: kind?.text ?? null,
          letter: kind && day.state !== 'rest' ? kindLetter(kind.type, kind.kind) : null,
          isToday: day.date === today,
          other: (byDateOther?.get(day.date) ?? []).map((entry) => entry.kind),
        }
      }),
    [target, byDate, byDateOther, byDatePlanned, byDateCoach, today, skipped]
  )

  const block = useMemo(() => blockLifecycle(coaching, today), [coaching, today])

  const phase = useMemo(() => {
    const week = phaseWeek(planPhaseSpans(coaching, planPhaseRanges), firstDay)
    return coaching ? generalBlockWeek(week, coaching.plan.block, firstDay) : week
  }, [coaching, planPhaseRanges, firstDay])
  const words = useCoachWords(coaching !== null)
  const blockName = phase?.span.key === 'general' ? words?.block.name || null : null
  const cycleLine = useMemo(() => {
    if (!coaching) return null
    const cycle = checkpointCycle(coaching.plan.macrocycleStartDate ?? coaching.plan.block.startDate, today)
    return cycle.mode === 'rolling' || cycle.complete ? null : t.plan.phase.checkpoint(cycle.week, formatDate(cycle.current.end, { style: 'bare', year: 'never' }))
  }, [coaching, today])
  const race = useMemo(() => {
    const next = planRace(coaching, nextRace, today)
    return next ? raceCountdown(next, today) : null
  }, [coaching, nextRace, today])

  const acts = byDate.get(selected) ?? []
  const others = byDateOther?.get(selected) ?? []
  const kind = dayKind(selected, acts, byDatePlanned, byDateCoach)
  const workouts = selectedWorkouts(selected, byDatePlanned, byDateCoach, trainingZones)
  const { ranOn = null, standsFor = null } = target.days.find((day) => day.date === selected) ?? {}
  const fitWorkouts = workouts.length > 0 || !standsFor ? workouts : selectedWorkouts(standsFor, byDatePlanned, byDateCoach, trainingZones)

  function activityTitle(a: PlanRun): string {
    if (a.description && a.description !== t.activityTypes[a.type]) return a.description
    return sessionTitle(byDatePlanned.get(a.date)?.name, a.type) ?? t.activityTypes[a.type]
  }

  const w = t.plan.weekRow
  const planKm = target.planKm

  let dayCard
  if (acts.length > 0 || (selected < today && workouts.length > 0)) {
    const session = fitWorkouts[0] ?? null
    // A run that kept a generic name ("Easy", the watch's) is titled by the session it ran: "Easy run + 6 strides".
    // One named for another kind ("Easy run" on a threshold day) keeps its own name.
    const first = acts[0]
    // Judged as shown: "Easy · 7.5 km" reads "Easy run" once the plan's distance is dropped, as generic as "Easy".
    const generic = !!first && !!session && isGenericName(sessionLabel(activityTitle(first))) && (namedType(first.description) ?? first.type) === first.type
    const named = !!first && !generic
    const title = sessionLabel(named ? activityTitle(acts[0]!) : workoutSummary(session ?? workouts[0]!).shortTitle)
    const planned = session ? plannedText(session, title) : null
    dayCard = (
      <DoneDayCard
        date={selected}
        kind={kind}
        title={title}
        planned={session && workouts.length === 0 && standsFor ? [t.plan.dayCard.standsFor(formatWeekday(standsFor, true)), planned].filter(Boolean).join(' · ') : planned}
        acts={acts}
        fit={dayFit(acts, session, hrZoneBoundsBpm)}
        ranOn={ranOn}
      />
    )
  } else if (workouts.length > 0 && kind) {
    dayCard = (
      <div className="flex flex-col gap-3">
        {workouts.map((workout) => (
          <PlannedWorkoutCard
            key={workout.key}
            workout={workout}
            kind={kind}
            hrZoneBoundsBpm={hrZoneBoundsBpm}
            exploreAvailable={exploreAvailable}
          />
        ))}
      </div>
    )
  } else {
    const coming = comingUpRows(dates, today, byDate, byDatePlanned, byDateCoach, trainingZones)
    const over = block !== null && selected > block.endDate
    dayCard = (
      <>
        {over ? (
          <BlockFinishedCard done={block.done} total={block.total} />
        ) : (
          <RestDayCard date={selected} covered={blockCovers(block, selected)} />
        )}
        {coming.length > 0 && <ComingUpCard rows={coming} selectedDate={selected} onSelect={onSelectDate} />}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      {phase && (
        <PhaseCard
          phase={blockName && t.plan.month.phaseEnds(phase.span.shortName, formatDate(phase.span.endDate, { style: 'bare', year: 'never' }))}
          name={blockName ?? phase.span.name}
          week={phase.week}
          total={phase.total}
          race={race}
          cycle={cycleLine}
          proposals={phase.span.key === 'general' ? words?.block.guideProposals : undefined}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1" data-testid="week-row">
        <div className="flex min-w-0 items-center gap-0.5">
          <button type="button" aria-label={t.plan.prevPeriod} onClick={() => onPrevWeek?.()} className={cn(NAV_BUTTON, '-ml-1.5')}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <h2 className="truncate text-[17px] font-semibold text-foreground">{formatDateRange(firstDay, lastDay)}</h2>
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
        {/* Km only: Coming up and the selector count the runs. */}
        <p className="text-[13px] tabular-nums text-muted-foreground" data-testid="week-summary">
          <b className="font-semibold text-foreground">{formatRanKm(target.ranKm)}</b>
          {planKm === null ? ` ${t.units.km}` : ` ${w.kmOf(formatPlannedKm(planKm))}`}
        </p>
      </div>

      <DaySelector days={selectorDays} selectedDate={selected} onSelect={onSelectDate} />

      {dayCard}

      {others.length > 0 && (
        <section className={cardClass({ className: 'flex flex-col gap-1 py-3' })} data-testid="plan-cross-training">
          <h3 className="text-[13px] font-semibold text-muted-foreground">{t.crossTraining.title}</h3>
          <CrossTrainingList entries={others} />
        </section>
      )}

    </div>
  )
}
