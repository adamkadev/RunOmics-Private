'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import type { ActivitySummary, ActivityType, PlannedWorkout, ScheduledTimeOfDay } from '@/domain/activity/types'
import { sessionZone, zoneColor } from '@/lib/colors'
import { sessionTitle } from './sessionTitle'
import type { HrBounds } from '@/domain/training/trimp'
import { EASY_SHARE_GUIDE, easyShare, type EasyHardSplit, type EasyTimeSource } from '@/domain/activity/easyShare'
import { weekPlanPhase } from '@/domain/training/weekPlanPhase'
import { EFFORT_ZONE_BY_TYPE } from '@/domain/training/workoutStructure'
import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'
import { weekTarget, type WeekTarget } from '@/domain/training/weekTarget'
import { formatWeekKm, resolveDayType, resolvePlannedType, weekPlanDays } from './weekPlanDays'
import { dayStateCells } from './dayStateCells'
import { DayStateLegend, DayStateStrip } from '@/components/ui/DayStateStrip'
import { SessionStateChip } from '@/components/ui/SessionCard'
import type { WeekDayState } from '@/domain/training/weekTarget'
import { SessionStructureBar } from './WorkoutStructure'
import { PlanPhaseTrack } from './PlanPhaseTrack'
import { paceLabel, workoutSummary } from './workoutSummary'
import { PeriodNav } from '@/components/ui/PeriodNav'
import type { FooterRace } from './RaceFooter'
import { shortDist } from '@/components/goals/shortDistance'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import type { PlanSpan } from '@/domain/training/planProgress'
import { addDays, isoDate } from '@/lib/calendarDate'
import { formatCountdown, formatDate, formatDateRange, formatDistance, formatDurationWords, formatPace, formatPlannedKm, formatRanKm } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { PlanCoachingView, PlanPrescriptionView } from './planCoachingView'
import {
  macrocyclePhaseRanges,
  macrocycleWeek,
  prescriptionDistanceMeters,
  prescriptionDuration,
} from '@/components/coaching/presentation'
import {
  coachWorkoutView,
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
function PlannedWorkoutRow({ workout, eyebrow, hero = false }: { workout: PlanWorkoutView; eyebrow?: string; hero?: boolean }) {
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
    <GlassSurface
      variant="card"
      data-testid={`plan-workout-row-${workout.key}`}
      className="w-full rounded-[22px] p-3.5"
      // Today's session is Plan's one hero surface (v4.3 A2).
      style={hero ? { border: '1.5px solid var(--acc-line)' } : undefined}
    >
      {/* The day heads its own card, as on a run's card (M11). */}
      {eyebrow && <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-accent-text">{eyebrow}</p>}
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-foreground" style={{ fontSize: '19px' }}>
            {summary.title}
          </span>
          <span className="block" style={{ fontSize: '13.5px', color: 'var(--muted-foreground)', marginTop: '6px', lineHeight: 1.5 }}>
            {detail}
          </span>
        </span>
      </div>
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
    </GlassSurface>
  )
}

// Rest is a prescribed state, not a missing render - it gets the same shell
// as any other day (just dashed, and unfilled) instead of a bare line of text
// floating in whatever space is left.
function RestDayCard({ next }: { next: { weekday: string; title: string } | null }) {
  return (
    <div
      className="w-full rounded-2xl p-3.5"
      style={{ border: '1px dashed var(--divider)' }}
    >
      <div className="font-bold text-muted-foreground" style={{ fontSize: '16px' }}>{t.plan.restCard.title}</div>
      <div className="mt-1" style={{ fontSize: '13px', color: 'var(--subtle)' }}>
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
  distanceM: number | null
  duration: { seconds: number; estimated: boolean } | null
  scheduledTime?: ScheduledTimeOfDay
  type?: ActivityType
  /** Set only when a completed day's recorded type differs from what was planned. */
  plannedType?: ActivityType
  done: boolean
}

const ROW_STATE_CLASS: Partial<Record<WeekDayState, string>> = {
  done: 'text-delta-good',
  missed: 'text-delta-warn',
  planned: 'text-subtle',
}

// One row per session, divider-separated like the Activities list rather than
// a stack of two-line cards - three sessions used to cost ~190px and their
// distances never lined up. The dot reads RUN_TYPE_ZONE, the same map
// the strip's bars use, so the two read as one vocabulary.
// A done row carries a check and a missed one the word, so a missed session
// reads as missed in the list as well as in the strip.
function WeekSessionRow({
  workout,
  state,
  onTap,
  isLast,
}: {
  workout: WeekRowItem
  state: WeekDayState
  onTap: () => void
  isLast: boolean
}) {
  const weekday = WEEKDAY_SHORT_INDEX[new Date(workout.date + 'T00:00:00').getDay()]
  const distanceKm = workout.distanceM ? workout.distanceM / 1000 : null
  // The distance and a check, so the title has room (H20): "8.51 ✓", not
  // "8.51 / 8 km ✓ Done" beside a title cut to "Threshold 3 × …".
  const kmLabel = distanceKm === null ? null : state === 'done' ? formatRanKm(distanceKm) : formatWeekKm(distanceKm)

  return (
    <button
      type="button"
      onClick={onTap}
      data-testid={`week-session-${workout.key}`}
      className="flex w-full items-center justify-between gap-3 text-left"
      style={{ padding: '13px 2px', borderBottom: isLast ? undefined : '1px solid var(--divider)' }}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className="shrink-0 rounded-[4px]"
          style={{
            width: '8px',
            height: '8px',
            background: workout.type ? zoneColor(sessionZone(workout)) : 'var(--subtle-2)',
            // Same divergence the bar's cap shows: the fill is what was
            // recorded, this ring is what was planned - without it, a title
            // that names one thing and a dot that colours another look like
            // a bug instead of the known Garmin-mismatch case.
            boxShadow: workout.plannedType ? `0 0 0 1.5px ${zoneColor(sessionZone({ type: workout.plannedType }))}` : undefined,
          }}
        />
        {weekday && <span className="w-9 shrink-0 text-muted-foreground" style={{ fontSize: '15px' }}>{weekday}</span>}
        <span className="truncate font-bold text-foreground" style={{ fontSize: '15px' }}>
          {workout.title}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2.5">
        <span className="text-sm text-muted-foreground">{kmLabel}</span>
        {state === 'done' ? (
          <span className={cn('w-4 text-right text-sm font-semibold', ROW_STATE_CLASS.done)} aria-label={t.sessionState.done}>✓</span>
        ) : state === 'missed' ? (
          <span className={cn('text-right text-xs font-semibold', ROW_STATE_CLASS.missed)}>{t.sessionState.missed}</span>
        ) : (
          <span className="w-4" aria-hidden="true" />
        )}
      </span>
    </button>
  )
}

// Volume, load and easy/hard are the week's three totals, read as one line
// instead of three cards - each with its unit spelled out so a bare "158/368"
// or "80/20" never appears without saying what it counts.
//
// Volume is what was run against what the plan scheduled - the same WeekTarget
// Today's ring and Activities read. It used to add the run km to whatever was
// still planned, missed days included, and call the sum the week.
function weekVolumeLabel(target: WeekTarget, notStarted: boolean): string {
  const s = t.plan.weekSummary
  if (target.planKm === null) return `${formatWeekKm(target.ranKm)} ${t.units.km} · ${s.sessionsCount(target.ranSessions)}`
  if (notStarted) return s.planOnly(formatWeekKm(target.planKm), target.planSessions)
  return `${s.ranOfPlan(formatRanKm(target.ranKm), formatWeekKm(target.planKm))} · ${s.sessionsOfPlan(target.ranSessions, target.planSessions)}`
}

// One line (M11): the volume on the left, the easy share on the right, as
// "92% easy · 80% target". The load behind an (i) and the long easy sentence
// are gone (H20).
function WeekSummaryLine({
  volume,
  missed,
  easyHard,
}: {
  volume: string
  missed: number
  easyHard: EasyHardSplit | null
}) {
  const s = t.plan.weekSummary
  return (
    <div data-testid="week-summary" className="flex items-baseline justify-between gap-3 px-1">
      <span className="min-w-0 text-subhead font-semibold text-foreground">
        {volume}
        {missed > 0 && <span className="text-footnote font-semibold text-delta-warn"> · {s.missed(missed)}</span>}
      </span>
      {easyHard && <span className="shrink-0 text-footnote text-muted-foreground">{s.easyOfTarget(easyHard.easy, EASY_SHARE_GUIDE)}</span>}
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
          // The bullet shows what was recorded, same resolver as the strip's
          // bar - no divergence badge here, that's the bar's job. The title's
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
            distanceM: d.acts.reduce((sum, a) => sum + a.distanceKm, 0) * 1000,
            duration: { seconds: d.acts.reduce((sum, a) => sum + a.durationSeconds, 0), estimated: false },
            type: resolved.type,
            plannedType: resolved.planned,
            done: true,
          }]
        }
        const coach = (byDateCoach?.get(d.date) ?? []).filter((v) => v.state !== 'cancelled')
        if (coach.length > 0) {
          const plan = byDatePlanned.get(d.date) ?? null
          // Titled by workoutSummary, as the day card and Today title it.
          return coach.map((view) => {
            const planned = coachWorkoutView(view, trainingZones, coach.length === 1 ? plan : null)
            return { ...planned, title: workoutSummary(planned).title, done: false }
          })
        }
        const plan = byDatePlanned.get(d.date)
        if (!plan) return []
        const planned = plannedWorkoutView(plan, trainingZones)
        return [{ ...planned, title: workoutSummary(planned).title, done: false }]
      })
  }, [days, byDateCoach, byDatePlanned, trainingZones])



  // Same priority as resolveDayType and the strip: a day that was actually
  // run counts as what was run, regardless of whether a coach/Garmin entry
  // exists for it. Reading straight from the plan for every day - as this
  // used to - silently dropped any completed day the plan didn't cover,
  // undercounting volume and sessions against what the strip and "this week"
  // list both show for the same week.
  // Easy time is Z1-Z2 time, as on every other screen. A day run counts its
  // recorded zone time; a session still to run counts at its type's zone for
  // its planned duration, so a week underway pools the two.
  const weekEasyTime = useMemo((): EasyTimeSource[] => {
    return days.flatMap((d): EasyTimeSource[] => {
      if (d.acts.length > 0) return d.acts.map((a) => ({ hrZones: a.hrZones }))
      const coach = (byDateCoach?.get(d.date) ?? []).filter((v) => v.state !== 'cancelled')
      if (coach.length > 0) {
        return coach.map((view) => ({
          type: view.prescription.type,
          seconds: prescriptionDuration(view.prescription)?.seconds ?? 0,
        }))
      }
      const plan = byDatePlanned.get(d.date)
      if (!plan) return []
      return [{ type: plan.type, seconds: plan.durationSecs ?? 0 }]
    })
  }, [days, byDateCoach, byDatePlanned])

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

  const { footerRaces } = useMemo(() => {
    if (!coaching) {
      return { footerRaces: nextRace ? [{ race: nextRace }] : [] }
    }
    const { targetEvent, tuneUpEvents, block } = coaching.plan
    const toRace = (event: typeof targetEvent): FooterRace => ({
      race: {
        date: event.date,
        name: event.name,
        distance: event.distanceLabel ?? '',
        location: event.location,
        targetSeconds: event.targetSeconds ?? null,
      },
      role: event.role,
      blockEndsHere: event.date === block.endDate,
    })
    const upcoming = [targetEvent, ...(tuneUpEvents ?? [])].filter((event) => event.date >= today)
    return { footerRaces: upcoming.map(toRace) }
  }, [coaching, nextRace, today])
  // The race the block builds to, on the phase line as "10K · D-64" (H20):
  // the Races section at the foot of the week is gone.
  const nextFooterRace = footerRaces.find((r) => r.race.date >= today)?.race ?? null
  const raceLabel = nextFooterRace
    ? `${shortDist(nextFooterRace.distance) || nextFooterRace.name} · ${formatCountdown(Math.round((Date.parse(nextFooterRace.date) - Date.parse(today)) / 86_400_000))}`
    : null

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
  const easyHard = easyShare(weekEasyTime)

  const dayEyebrow = selected.date === today ? `${t.plan.today} · ${formatDate(selected.date)}` : formatDate(selected.date)

  return (
    <div className="space-y-3">
      <div className="px-1">
        {(phaseLabel || weekOfLabel || fallbackLabel || raceLabel) && (
          <div className="flex items-baseline justify-between gap-3" data-testid="phase-line">
            <p className="min-w-0 text-footnote font-semibold text-muted-foreground">
              {[phaseLabel, weekOfLabel].filter(Boolean).join(' · ') || fallbackLabel}
            </p>
            {raceLabel && <p className="shrink-0 text-footnote font-bold text-muted-foreground">{raceLabel}</p>}
          </div>
        )}
        {/* The displayed week's own range, not the real `today` - the track
            otherwise always lit whichever phase covers the actual current
            date, so a pre-plan week in August still showed Base (today's
            phase) as active; and a single reference day disagreed with the
            header whenever a phase boundary fell mid-week. */}
        <PlanPhaseTrack
          ranges={coaching ? coachPhaseRanges : planPhaseRanges}
          weekStart={firstDay.date}
          weekEnd={lastDay.date}
        />
      </div>

      <div className="px-1">
        <PeriodNav
          label={
            // "Today" lives in this same row, not a row of its own below it -
            // a jump button that appears/disappears as its own row shifts the
            // strip under the reader's thumb every time they page off the
            // current week, and the strip is the one thing on this screen
            // that must hold still while it's being navigated.
            <span className="flex items-center gap-1.5 text-footnote font-medium text-muted-foreground">
              <span>{formatDateRange(firstDay.date, lastDay.date)}</span>
              {!atPresent && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={onToday}
                    className="font-semibold text-accent-text"
                  >
                    {t.plan.today}
                  </button>
                </>
              )}
            </span>
          }
          onPrev={() => onPrevWeek?.()}
          onNext={() => onNextWeek?.()}
          nextDisabled={atPresent && !canGoForward}
          prevLabel={t.plan.prevPeriod}
          nextLabel={t.plan.nextPeriod}
          size="sm"
          className="w-full justify-between"
        />
      </div>

      {/* State in shape - solid done, dashed planned, hatched missed, today
          ringed - so a missed session no longer draws as the same solid bar
          as one still to come. */}
      <div className="space-y-2.5 px-1">
        <DayStateStrip
          variant="bars"
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
        <DayStateLegend color="var(--zone-4)" />
      </div>

      <WeekSummaryLine
        volume={weekVolumeLabel(target, firstDay.date > today && target.ranSessions === 0)}
        missed={target.missedSessions}
        easyHard={easyHard}
      />

      <div className="space-y-3 px-1">
        {/* A run's or a plan's card carries the day as its own eyebrow (R2,
            M11); a rest day keeps it above. */}
        {selected.acts.length === 0 && selectedWorkouts.length === 0 && (
          <p className="text-xs font-bold uppercase tracking-wide text-accent-text">{dayEyebrow}</p>
        )}

        {selected.acts.length > 0 ? (
          <div className="space-y-2">
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
              // A quiet note, not a warning - the bar already carries the
              // divergence as a colour notch, this just spells it out.
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
                className="glass-card block w-full rounded-2xl p-3.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-xs font-bold uppercase tracking-wide text-accent-text">{dayEyebrow}</span>
                  <span className="flex shrink-0 items-center" style={{ gap: '8px' }}>
                    <SessionStateChip state="done" />
                    <ChevronRight size={19} style={{ color: 'var(--subtle-2)' }} aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-1 truncate font-bold text-foreground" style={{ fontSize: '19px' }}>
                  {activityTitle(a)}
                </div>
                <div className="block" style={{ fontSize: '13.5px', color: 'var(--muted-foreground)', marginTop: '6px', lineHeight: 1.5 }}>
                  {detail}
                </div>
                {typeDivergence && (
                  <div className="block" style={{ fontSize: '12px', color: 'var(--subtle-2)', marginTop: '2px' }}>
                    {typeDivergence}
                  </div>
                )}
                <div className="mt-3.5">
                  <SessionStructureBar
                    steps={[]}
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
          <div className="space-y-2">
            {selectedWorkouts.map((workout, i) => (
              <PlannedWorkoutRow key={workout.key} workout={workout} eyebrow={i === 0 ? dayEyebrow : undefined} hero={i === 0 && selected.date === today} />
            ))}
          </div>
        ) : (
          <RestDayCard next={findNextPlanned(days, selected.date, byDatePlanned, byDateCoach)} />
        )}
      </div>

      {thisWeekSessions.length > 0 && (
        <div className="px-1" data-testid="week-sessions">
          <div>
            {thisWeekSessions.map((workout, i) => (
              <WeekSessionRow
                key={workout.key}
                workout={workout}
                state={target.days.find((d) => d.date === workout.date)?.state ?? 'planned'}
                onTap={() => selectDate(workout.date)}
                isLast={i === thisWeekSessions.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
