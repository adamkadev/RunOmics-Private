'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, X } from 'lucide-react'
import { SectionDivider } from '@/components/ui/SectionLabel'
import type { ActivitySummary, ActivityType, PlannedWorkout } from '@/domain/activity/types'
import type { HrBounds } from '@/domain/training/trimp'
import {
  summarizeWeek,
  weeklyTrimpTotals,
  compareWeekLoad,
  computeWeekAdherence,
  summarizePlannedWeek,
} from '@/domain/training/weekSummary'
import type { PlannedWeek, WeekSummary } from '@/domain/training/weekSummary'
import { weekTrainingStatus } from '@/domain/training/weekStatus'
import { weekPlanPhase } from '@/domain/training/weekPlanPhase'
import { EFFORT_ZONE_BY_TYPE } from '@/domain/training/workoutStructure'
import type { TrainingStatusCalendar } from '@/application/usecases/GetTrainingStatusCalendar'
import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'
import { SessionStructureBar } from './WorkoutStructure'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { InlineJumpButton } from '@/components/ui/InlineJumpButton'
import { WeekPurposeBanner } from './WeekPurposeBanner'
import { RaceFooter, type FooterRace } from './RaceFooter'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { weeksInPlan, type PlanSpan } from '@/domain/training/planProgress'
import { addDays, isoDate, isoWeekNumber } from '@/lib/calendarDate'
import { formatDate, formatPace } from '@/lib/formatters'
import { INTENSITY_DOT_COLORS, intensityDotColor } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { CoachingOverview, PrescriptionView } from '@/application/coaching/GetCoachingView'
import { COACHING_TO_ACTIVITY_TYPE } from '@/domain/coaching/types'
import { macrocyclePhaseRanges, macrocycleWeek, prescriptionDistanceMeters } from '@/components/coaching/presentation'
import {
  coachWorkoutView,
  formatPlanDuration,
  plannedWorkoutView,
  type PlanWorkoutView,
} from './planWorkoutView'

const MISSED = 'var(--color-missed)'
const MISSED_10 = 'color-mix(in srgb, var(--color-missed) 10%, transparent)'
const MISSED_25 = 'color-mix(in srgb, var(--color-missed) 25%, transparent)'
const FG_05 = 'color-mix(in srgb, var(--color-foreground) 5%, transparent)'
const FG_07 = 'color-mix(in srgb, var(--color-foreground) 7%, transparent)'
const FG_18 = 'color-mix(in srgb, var(--color-foreground) 18%, transparent)'

// Day-chip states: done and planned each get one fixed colour now instead of
// borrowing the session's own type colour, so a week of mixed session types
// still reads as one consistent legend (see the strip's caption row).
const DONE_FILL = 'rgba(90,151,245,.14)'
const DONE_BORDER = 'rgba(90,151,245,.32)'
const DONE_TEXT = '#9cc4ff'
const TODAY_BORDER = '#34d399'
const PLANNED_FILL = 'rgba(148,178,220,.07)'
const PLANNED_TEXT = '#c3ccd6'

const TREND_WEEKS = 8

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
  const { band, pace } = splitEffort(workout.effort)
  const detail = [formatPlanDuration(workout.duration), band, pace ? t.plan.targetPace(pace) : null]
    .filter(Boolean)
    .join(' · ') || t.plan.planned
  const zoneWord = band?.split(' ')[0] ?? null

  return (
    <div
      data-testid={`plan-workout-row-${workout.key}`}
      className="w-full rounded-2xl border border-foreground/[0.08] bg-foreground/[0.04] p-3.5"
    >
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-foreground" style={{ fontSize: '19px' }}>
            {workout.title}
          </span>
          <span className="block" style={{ fontSize: '13.5px', color: '#97a3b0', marginTop: '6px', lineHeight: 1.5 }}>
            {detail}
          </span>
        </span>
      </div>
      {workout.duration && (
        <div className="mt-3.5">
          <SessionStructureBar
            steps={workout.structure ?? []}
            zoneWord={zoneWord}
            totalSeconds={workout.duration.seconds}
          />
        </div>
      )}
    </div>
  )
}

// Rest is a prescribed state, not a missing render - it gets the same shell
// as any other day (just dashed, and unfilled) instead of a bare line of text
// floating in whatever space is left.
function RestDayCard({ next }: { next: { weekday: string; title: string } | null }) {
  return (
    <div
      className="w-full rounded-2xl p-3.5"
      style={{ border: '1px dashed rgba(148,178,220,.2)' }}
    >
      <div className="font-bold" style={{ fontSize: '16px', color: '#c3ccd6' }}>{t.plan.restCard.title}</div>
      <div className="mt-1" style={{ fontSize: '13px', color: '#8d99a6' }}>
        {next ? t.plan.restCard.next(next.weekday, next.title) : t.plan.restCard.noSession}
      </div>
    </div>
  )
}

function findNextPlanned(
  days: Day[],
  fromDate: string,
  byDatePlanned: Map<string, PlannedWorkout>,
  byDateCoach?: ReadonlyMap<string, PrescriptionView[]>
): { weekday: string; title: string } | null {
  const fromIndex = days.findIndex((d) => d.date === fromDate)
  if (fromIndex === -1) return null

  for (let i = fromIndex + 1; i < days.length; i++) {
    const d = days[i]!
    const coach = byDateCoach?.get(d.date)?.find((v) => v.state !== 'cancelled')
    const plan = byDatePlanned.get(d.date)
    const title = coach?.prescription.title ?? plan?.name ?? null
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

// One row per session, divider-separated like the Activities list rather than
// a stack of two-line cards - three sessions used to cost ~190px and their
// distances never lined up. The dot reuses A6's intensity bucketing so the two
// screens read as the same vocabulary.
function ComingUpRow({ workout, onTap, isLast }: { workout: PlanWorkoutView; onTap: () => void; isLast: boolean }) {
  const weekday = WEEKDAY_SHORT_INDEX[new Date(workout.date + 'T00:00:00').getDay()]
  const detail =
    formatPlanDuration(workout.duration) ??
    (workout.scheduledTime ? t.plan.timeOfDay[workout.scheduledTime] : undefined)
  const distanceKm = workout.distanceM ? Math.round(workout.distanceM / 1000) : null

  return (
    <button
      type="button"
      onClick={onTap}
      data-testid={`coming-up-${workout.key}`}
      className="flex w-full items-center justify-between gap-3 text-left"
      style={{ padding: '13px 2px', borderBottom: isLast ? undefined : '1px solid rgba(148,178,220,.1)' }}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className="shrink-0 rounded-[4px]"
          style={
            workout.type === 'Race'
              ? { width: '8px', height: '8px', border: `1.5px solid ${INTENSITY_DOT_COLORS.long}` }
              : { width: '8px', height: '8px', background: workout.type ? intensityDotColor(workout.type) : 'var(--accent)' }
          }
        />
        <span className="truncate font-bold text-foreground" style={{ fontSize: '15px' }}>
          {[weekday, workout.title].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="shrink-0" style={{ fontSize: '13px', color: '#8d99a6' }}>
        {[distanceKm ? `~${distanceKm} ${t.units.km}` : null, detail].filter(Boolean).join(' · ')}
      </span>
    </button>
  )
}

const LEGEND_INK = '#7d8896'

// done · today · planned km - the only three states the strip needs a key for.
// Rest carries its own label already, so it isn't listed here.
function DayChipLegend() {
  const s = t.plan.dayChipLegend
  return (
    <div
      className="flex items-center justify-center"
      style={{ marginTop: '8px', gap: '14px', fontSize: '11px', color: LEGEND_INK }}
    >
      <span className="flex items-center gap-1.5">
        <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: 'rgba(90,151,245,.32)' }} />
        {s.done}
      </span>
      <span className="flex items-center gap-1.5">
        <span style={{ width: '9px', height: '9px', borderRadius: '3px', border: `1.5px solid ${TODAY_BORDER}` }} />
        {s.today}
      </span>
      <span className="flex items-center gap-1.5">
        <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: 'rgba(148,178,220,.18)' }} />
        {s.plannedKm}
      </span>
    </div>
  )
}

function StatTile({
  label,
  value,
  denominator,
  unit,
  footnote,
  testId,
}: {
  label: string
  value: number | null
  denominator?: number | null
  unit?: string
  footnote?: string
  testId?: string
}) {
  return (
    <GlassSurface variant="card" className="rounded-[16px] p-3" data-testid={testId}>
      <div className="truncate font-bold uppercase" style={{ fontSize: '10px', letterSpacing: '.14em', color: '#8d99a6' }}>
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-display font-bold tabular-nums text-foreground" style={{ fontSize: '21px' }}>
          {value !== null ? <AnimatedValue value={value} /> : '–'}
        </span>
        {denominator !== undefined && denominator !== null && (
          <span className="tabular-nums" style={{ fontSize: '13px', color: '#8d99a6' }}>
            / {denominator}
          </span>
        )}
        {unit && (
          <span style={{ fontSize: '10.5px', color: '#7d8896' }}>{unit}</span>
        )}
      </div>
      {footnote && (
        <div className="mt-0.5 truncate" style={{ fontSize: '10px', color: '#7d8896' }}>
          {footnote}
        </div>
      )}
    </GlassSurface>
  )
}

// Load, climb and easy/hard are the same class of fact - three totals for the
// week - so they read as one row of equal tiles instead of one full-width
// card (load, with its own progress bar) plus two numbers tacked on below it.
function WeekStatsTiles({
  summary,
  planned,
  typicalClimbM,
}: {
  summary: WeekSummary
  planned: PlannedWeek | null
  typicalClimbM: number | null
}) {
  const s = t.plan.weekSummary
  const target = planned?.estimatedLoad ?? 0
  const hardPct = summary.hardPct !== null ? Math.round(summary.hardPct) : null
  const easyPct = hardPct !== null ? 100 - hardPct : null

  return (
    <div className="grid grid-cols-3" style={{ gap: '8px' }}>
      <StatTile
        label={s.load}
        value={summary.totalTrimp}
        denominator={target > 0 ? target : null}
        unit={s.loadUnit}
        testId="stat-load"
      />
      <StatTile
        label={s.climb}
        value={summary.elevationGainM}
        denominator={typicalClimbM}
        unit={t.units.m}
        testId="stat-climb"
      />
      <StatTile
        label={s.easyHard}
        value={easyPct}
        denominator={hardPct}
        unit="%"
        footnote={s.easyHardTarget}
        testId="stat-easy-hard"
      />
    </div>
  )
}

interface Props {
  weekStart: Date
  activities: ActivitySummary[]
  byDate: Map<string, ActivitySummary[]>
  byDatePlanned: Map<string, PlannedWorkout>
  byDateCoach?: ReadonlyMap<string, PrescriptionView[]>
  coaching?: CoachingOverview | null
  onSelectDate?: (date: string) => void
  hrBounds?: HrBounds
  today: string
  atPresent: boolean
  onToday: () => void
  statusByDate: TrainingStatusCalendar
  planPhaseRanges: PlanPhaseRange[]
  nextRace?: UpcomingRace | null
  trainingZones?: TrainingZonesData | null
  planSpan?: PlanSpan | null
  initialSelectedDate?: string | null
}

export function WeekView({
  weekStart,
  activities,
  byDate,
  byDatePlanned,
  byDateCoach,
  coaching = null,
  onSelectDate,
  hrBounds,
  today,
  atPresent,
  onToday,
  statusByDate,
  planPhaseRanges,
  nextRace,
  trainingZones = null,
  planSpan = null,
  initialSelectedDate,
}: Props) {
  const days: Day[] = Array.from({ length: 7 }, (_, i) => {
    const date = isoDate(addDays(weekStart, i))
    return { date, acts: byDate.get(date) ?? [] }
  })
  const firstDay = days[0]!

  const [selectedDate, setSelectedDate] = useState(
    () =>
      days.find((d) => d.date === initialSelectedDate)?.date ??
      days.find((d) => d.date === today)?.date ??
      firstDay.date
  )
  const selected = days.find((d) => d.date === selectedDate) ?? firstDay
  const selectedPlan = byDatePlanned.get(selected.date)

  function activityTitle(a: ActivitySummary): string {
    if (a.description && a.description !== t.activityTypes[a.type]) return a.description
    return selectedPlan?.name ?? a.description ?? t.activityTypes[a.type]
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

  const nextWeekPlans = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => isoDate(addDays(new Date(today + 'T00:00:00'), i + 1)))
        .map((date) => byDatePlanned.get(date))
        .filter((p): p is PlannedWorkout => !!p && !byDateCoach?.has(p.date))
        .slice(0, 3),
    [today, byDatePlanned, byDateCoach]
  )

  const byWeekNumber = useMemo(() => {
    const map = new Map<number, ActivitySummary[]>()
    for (const a of activities) {
      const list = map.get(a.week) ?? []
      list.push(a)
      map.set(a.week, list)
    }
    return map
  }, [activities])

  const weekActs = useMemo(() => days.flatMap((d) => d.acts), [days])
  const summary = useMemo(() => summarizeWeek(weekActs, hrBounds), [weekActs, hrBounds])

  const trendWeekNumbers = useMemo(
    () => Array.from({ length: TREND_WEEKS }, (_, i) => isoWeekNumber(addDays(weekStart, (i - (TREND_WEEKS - 1)) * 7))),
    [weekStart]
  )
  const trendTotals = useMemo(
    () => weeklyTrimpTotals(trendWeekNumbers, byWeekNumber, hrBounds),
    [trendWeekNumbers, byWeekNumber, hrBounds]
  )
  const comparison = useMemo(() => compareWeekLoad(summary.totalTrimp, trendTotals.slice(0, -1)), [summary.totalTrimp, trendTotals])

  // Climb has no planned counterpart in the domain the way load does, so its
  // tile compares against the same trailing-8-week baseline the purpose
  // banner already uses for load, rather than inventing a "planned climb".
  const typicalClimbM = useMemo(() => {
    const priorWeeks = trendWeekNumbers.slice(0, -1)
    const totals = priorWeeks.map((week) => (byWeekNumber.get(week) ?? []).reduce((s, a) => s + (a.elevationGain ?? 0), 0))
    if (totals.filter((v) => v > 0).length < 3) return null
    const average = Math.round(totals.reduce((s, v) => s + v, 0) / totals.length)
    return average > 0 ? average : null
  }, [trendWeekNumbers, byWeekNumber])

  const adherence = useMemo(
    () =>
      computeWeekAdherence(
        days.map((d) => ({ date: d.date, planned: byDatePlanned.has(d.date), completed: d.acts.length > 0 }))
      ),
    [days, byDatePlanned]
  )

  const garminStatus = useMemo(
    () => weekTrainingStatus(days.map((d) => d.date), statusByDate),
    [days, statusByDate]
  )

  const planned = useMemo(() => {
    const workouts = days.map((d) => byDatePlanned.get(d.date)).filter((p) => p !== undefined)
    return workouts.length ? summarizePlannedWeek(workouts) : null
  }, [days, byDatePlanned])

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

  const comingUp = useMemo<PlanWorkoutView[]>(() => {
    const coach = (coaching?.workouts ?? [])
      .filter((v) => v.prescription.date > today && v.state !== 'cancelled')
      .slice(0, 3)
    if (coach.length > 0) {
      return coach.map((view) => coachWorkoutView(view, trainingZones, byDatePlanned.get(view.prescription.date) ?? null))
    }
    return nextWeekPlans.map((plan) => plannedWorkoutView(plan, trainingZones))
  }, [coaching, today, trainingZones, byDatePlanned, nextWeekPlans])

  const { footerRaces, footerSpan } = useMemo(() => {
    if (!coaching) {
      return { footerRaces: nextRace ? [{ race: nextRace }] : [], footerSpan: planSpan ?? null }
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
    return { footerRaces: upcoming.map(toRace), footerSpan: null }
  }, [coaching, nextRace, planSpan, today])

  const footerWeeks = useMemo(() => weeksInPlan(footerSpan, today), [footerSpan, today])

  const weekOver = days[days.length - 1]!.date < today
  const isCurrentWeek = !weekOver && firstDay.date <= today

  return (
    <div className="space-y-3">
      <WeekPurposeBanner
        over={weekOver}
        current={isCurrentWeek}
        level={comparison?.level ?? null}
        percent={comparison?.percent ?? null}
        adherence={adherence}
        garminStatus={garminStatus}
        planPhase={planPhase}
        planned={planned}
        planPhaseRanges={coaching ? coachPhaseRanges : planPhaseRanges}
        planSpan={planSpan}
        targetWeek={coaching ? macrocycleWeek(coaching.plan, today) : null}
        today={today}
      />

      <div className="px-0.5">
        {!atPresent && (
          <div className="mb-2.5 flex items-center justify-end gap-2">
            <InlineJumpButton onClick={onToday}>{t.plan.today}</InlineJumpButton>
          </div>
        )}

        <div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
                const isToday = d.date === today
                const isPast = d.date < today
                const completed = d.acts.length > 0
                const plan = byDatePlanned.get(d.date)
                const coach = byDateCoach?.get(d.date) ?? []
                const activeCoach = coach.find(view => view.state !== 'cancelled')
                const planned = !completed && (!!activeCoach || !!plan)
                const missed = isPast && planned
                const rest = !completed && !planned
                const primaryType: ActivityType | null = (d.acts[0]?.type ?? (activeCoach ? COACHING_TO_ACTIVITY_TYPE[activeCoach.prescription.type] : plan?.type)) ?? null
                const doneKm = d.acts.reduce((sum, a) => sum + a.distanceKm, 0)
                const plannedMeters = activeCoach
                  ? prescriptionDistanceMeters(activeCoach.prescription)
                  : (plan?.distanceM ?? null)
                const plannedKm = plannedMeters === null ? null : plannedMeters / 1000
                const chipKm = completed ? doneKm : plannedKm
                const label = rest
                  ? t.plan.restDay
                  : chipKm !== null && chipKm > 0
                    ? String(Math.round(chipKm))
                    : primaryType
                      ? t.plan.typeShort[primaryType]
                      : null
                const weekday = WEEKDAY_SHORT_INDEX[new Date(d.date + 'T00:00:00').getDay()]

                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => { setSelectedDate(d.date); onSelectDate?.(d.date) }}
                    aria-label={`${formatDate(d.date, { style: 'full' })}${coach.length ? ` · ${coach.map(view => `${view.prescription.title} · ${t.coaching.states[view.state]}`).join(', ')}` : ''}`}
                    aria-pressed={d.date === selectedDate}
                    {...(coach.length ? { 'data-testid': `coach-calendar-${d.date}` } : {})}
                    className={cn(
                      'min-w-0 flex flex-col items-center gap-1 rounded-lg py-0.5 transition-transform active:scale-95',
                      d.date === selectedDate && 'bg-foreground/[0.06]'
                    )}
                  >
                    <span
                      className="text-micro font-bold leading-none"
                      style={{ color: isToday ? TODAY_BORDER : 'var(--subtle)' }}
                    >
                      {weekday}
                    </span>

                    <div className="relative w-full">
                      <div
                        className="relative flex h-[52px] w-full flex-col items-center justify-center gap-0.5 rounded-[11px] border px-0.5 transition-colors"
                        style={{
                          ...(completed
                            ? { background: DONE_FILL, borderColor: DONE_BORDER }
                            : missed
                              ? { background: MISSED_10, borderColor: MISSED_25 }
                              : planned
                                ? { background: PLANNED_FILL, borderColor: FG_18 }
                                : { background: FG_05, borderColor: FG_07 }),
                          // Only today gets a ring, so the ring's existence marks the
                          // day and it is always the same green, regardless of the
                          // session underneath - the fill already carries that state.
                          ...(isToday ? { borderColor: TODAY_BORDER, borderWidth: 2 } : null),
                        }}
                      >
                        <span
                          className={cn(
                            'truncate text-center text-micro font-bold leading-tight',
                            rest && 'font-semibold opacity-40'
                          )}
                          style={{
                            color: missed
                              ? MISSED
                              : rest
                                ? 'var(--color-foreground)'
                                : completed
                                  ? DONE_TEXT
                                  : planned
                                    ? PLANNED_TEXT
                                    : 'var(--accent)',
                          }}
                        >
                          {label}
                        </span>

                        {missed && <X size={11} strokeWidth={3.4} style={{ color: MISSED }} />}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        <DayChipLegend />
      </div>

      <WeekStatsTiles summary={summary} planned={planned} typicalClimbM={typicalClimbM} />

      <div className="space-y-3 px-1">
        <p className="text-xs font-bold uppercase tracking-wide text-accent-text">
          {selected.date === today
            ? `${t.plan.today} · ${formatDate(selected.date)}`
            : formatDate(selected.date)}
        </p>

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
                t.plan.ranKm(a.distanceKm.toFixed(1)),
                plannedKm !== null ? t.plan.plannedKmLabel(plannedKm) : null,
                a.paceSecPerKm !== null ? formatPace(a.paceSecPerKm) : null,
                a.rpe !== null ? t.activities.row.rpeValue(a.rpe) : null,
              ]
                .filter(Boolean)
                .join(' · ')
              const zoneWord = EFFORT_ZONE_BY_TYPE[a.type] ?? null

              return (
              <Link
                key={a.id}
                href={`/activities/${a.id}`}
                aria-label={`${activityTitle(a)}, ${formatDate(a.date)}, ${t.plan.viewActivity}`}
                className="block w-full rounded-2xl border border-foreground/[0.08] bg-foreground/[0.04] p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate font-bold text-foreground" style={{ fontSize: '19px' }}>
                    {activityTitle(a)}
                  </span>
                  <span className="flex shrink-0 items-center" style={{ gap: '8px' }}>
                    <span
                      className="font-bold uppercase"
                      style={{
                        fontSize: '11px',
                        letterSpacing: '.06em',
                        color: '#9cc4ff',
                        background: 'rgba(90,151,245,.16)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                      }}
                    >
                      {t.plan.doneChip}
                    </span>
                    <ChevronRight size={19} style={{ color: '#6f7d8b' }} aria-hidden="true" />
                  </span>
                </div>
                <div className="block" style={{ fontSize: '13.5px', color: '#97a3b0', marginTop: '6px', lineHeight: 1.5 }}>
                  {detail}
                </div>
                <div className="mt-3.5">
                  <SessionStructureBar
                    steps={[]}
                    zoneWord={zoneWord}
                    totalSeconds={a.durationSeconds}
                    variant="done"
                  />
                </div>
              </Link>
              )
            })}
          </div>
        ) : selectedWorkouts.length > 0 ? (
          <div className="space-y-2">
            {selectedWorkouts.map((workout) => (
              <PlannedWorkoutRow key={workout.key} workout={workout} />
            ))}
          </div>
        ) : (
          <RestDayCard next={findNextPlanned(days, selected.date, byDatePlanned, byDateCoach)} />
        )}
      </div>

      {atPresent && comingUp.length > 0 && (
        <div className="px-1">
          <SectionDivider as="p" className="mb-2.5 flex items-center gap-2">
            {t.plan.comingUp}
          </SectionDivider>
          <div>
            {comingUp.map((workout, i) => (
              <ComingUpRow
                key={workout.key}
                workout={workout}
                onTap={() => setSelectedDate(workout.date)}
                isLast={i === comingUp.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {footerRaces.length > 0 && atPresent && (
        <div className="px-1">
          <SectionDivider as="p" className="mb-2.5 flex items-center justify-between gap-2">
            <span>{t.plan.races}</span>
            {footerWeeks && (
              <span>{t.plan.raceFooter.weeksIn(footerWeeks.done, footerWeeks.total)} {t.plan.raceFooter.weeksInLabel}</span>
            )}
          </SectionDivider>
          <RaceFooter races={footerRaces} today={today} />
        </div>
      )}

    </div>
  )
}
