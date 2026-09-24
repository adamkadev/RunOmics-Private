'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { SectionDivider } from '@/components/ui/SectionLabel'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ACTIVITY_TYPE_CONFIG, type ActivitySummary, type ActivityType, type PlannedWorkout, type ScheduledTimeOfDay } from '@/domain/activity/types'
import type { HrBounds } from '@/domain/training/trimp'
import { summarizeWeek, summarizePlannedWeek } from '@/domain/training/weekSummary'
import { weekPlanPhase } from '@/domain/training/weekPlanPhase'
import { EFFORT_ZONE_BY_TYPE } from '@/domain/training/workoutStructure'
import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'
import { SessionStructureBar } from './WorkoutStructure'
import { PlanPhaseTrack } from './PlanPhaseTrack'
import { PeriodNav } from '@/components/ui/PeriodNav'
import { RaceFooter, type FooterRace } from './RaceFooter'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { weeksInPlan, type PlanSpan } from '@/domain/training/planProgress'
import { addDays, isoDate } from '@/lib/calendarDate'
import { formatDate, formatDateRange, formatPace } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { PlanCoachingView, PlanPrescriptionView } from './planCoachingView'
import { COACHING_TO_ACTIVITY_TYPE } from '@/domain/coaching/types'
import {
  isKeyPrescription,
  macrocyclePhaseRanges,
  macrocycleWeek,
  prescriptionDistanceMeters,
  prescriptionDuration,
} from '@/components/coaching/presentation'
import {
  coachWorkoutView,
  formatPlanDuration,
  plannedWorkoutView,
  type PlanWorkoutView,
} from './planWorkoutView'

// The strip's second variable (after bar height = km) is activity type,
// drawn as hue - the same ACTIVITY_TYPE_CONFIG the "this week" bullets, the
// session card and Activity detail already read from, so a colour means the
// same thing everywhere it appears rather than each surface inventing its
// own bucketing.
// HSL lightness from sRGB - (max+min)/2, no need for full HSL conversion
// since only lightness is used here.
function lightness(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2
}

// Selection lightens a hue toward its own bright end - except a hue that's
// already light (Race's blue300, VO2Max's roRed) has nowhere left to go
// but white, and at 30% white it stops reading as its own colour and reads
// as lavender. Those darken slightly instead; the ring and the bold label
// still carry "this is selected" either way.
function brighten(hex: string): string {
  return lightness(hex) > 0.65
    ? `color-mix(in srgb, ${hex} 85%, black 15%)`
    : `color-mix(in srgb, ${hex} 70%, white 30%)`
}

const REST_STUB_FILL = 'rgba(148,178,220,.25)'
// The "done" chip's blue was a dark-theme hex, 1.5:1 on the light background.
// Each theme takes its own step of the same hue instead.
const DONE_INK = 'text-blue-700 dark:text-blue-300'

interface Day {
  date: string
  acts: ActivitySummary[]
}

// Hardest-first, matching ACTIVITY_TYPE_CONFIG's own declaration order - a
// day with more than one logged activity (or a race day) resolves to
// whichever one is hardest, not just whichever came first.
const RAMP_ORDER: ActivityType[] = ['Race', 'Sprint', 'Anaerobic', 'VO2Max', 'Threshold', 'Tempo', 'Base']

function hardestType(types: ActivityType[]): ActivityType {
  return types.reduce((hardest, type) =>
    RAMP_ORDER.indexOf(type) < RAMP_ORDER.indexOf(hardest) ? type : hardest
  )
}

function resolvePlannedType(
  date: string,
  byDatePlanned: Map<string, PlannedWorkout>,
  byDateCoach?: ReadonlyMap<string, PlanPrescriptionView[]>
): ActivityType | undefined {
  const coach = byDateCoach?.get(date)?.find((v) => v.state !== 'cancelled')
  if (coach) return COACHING_TO_ACTIVITY_TYPE[coach.prescription.type]
  return byDatePlanned.get(date)?.type
}

interface DayTypeResolution {
  type: ActivityType
  /** Set only when the day was run and it differs from what was planned. */
  planned?: ActivityType
}

// One source of truth for a day's colour: the week-strip bar and the "this
// week" bullet both call this rather than each resolving a planned or
// recorded type on their own - which is how the same day used to end up two
// different hues in two places. A day that was actually run always shows
// what happened, not what was scheduled.
function resolveDayType(acts: ActivitySummary[], plannedType: ActivityType | undefined): DayTypeResolution | null {
  if (acts.length > 0) {
    const recorded = hardestType(acts.map((a) => a.type))
    return recorded !== plannedType && plannedType ? { type: recorded, planned: plannedType } : { type: recorded }
  }
  return plannedType ? { type: plannedType } : null
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
  // band (the zone/type word, e.g. "Threshold") is dropped here - the title
  // already names the session, so this line only adds what the title
  // doesn't already say: how long, and at what pace.
  const detail = [formatPlanDuration(workout.duration), pace ? t.plan.targetPace(pace) : null]
    .filter(Boolean)
    .join(' · ') || t.plan.planned
  const zoneWord = band?.split(' ')[0] ?? null

  return (
    <GlassSurface
      variant="card"
      data-testid={`plan-workout-row-${workout.key}`}
      className="w-full rounded-2xl p-3.5"
    >
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-foreground" style={{ fontSize: '19px' }}>
            {workout.title}
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
      style={{ border: '1px dashed rgba(148,178,220,.2)' }}
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

// One row per session, divider-separated like the Activities list rather than
// a stack of two-line cards - three sessions used to cost ~190px and their
// distances never lined up. The dot reads ACTIVITY_TYPE_CONFIG, the same map
// the strip's bars use, so the two read as one vocabulary.
function WeekSessionRow({ workout, onTap, isLast }: { workout: WeekRowItem; onTap: () => void; isLast: boolean }) {
  const weekday = WEEKDAY_SHORT_INDEX[new Date(workout.date + 'T00:00:00').getDay()]
  const distanceKm = workout.distanceM ? Math.round(workout.distanceM / 1000) : null

  return (
    <button
      type="button"
      onClick={onTap}
      data-testid={`week-session-${workout.key}`}
      className="flex w-full items-center justify-between gap-3 text-left"
      style={{ padding: '13px 2px', borderBottom: isLast ? undefined : '1px solid rgba(148,178,220,.1)' }}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className="shrink-0 rounded-[4px]"
          style={{
            width: '8px',
            height: '8px',
            background: workout.type ? ACTIVITY_TYPE_CONFIG[workout.type].chartColor : 'var(--subtle-2)',
            // Same divergence the bar's cap shows: the fill is what was
            // recorded, this ring is what was planned - without it, a title
            // that names one thing and a dot that colours another look like
            // a bug instead of the known Garmin-mismatch case.
            boxShadow: workout.plannedType ? `0 0 0 1.5px ${ACTIVITY_TYPE_CONFIG[workout.plannedType].chartColor}` : undefined,
          }}
        />
        <span className="truncate font-bold text-foreground" style={{ fontSize: '15px' }}>
          {[weekday, workout.title].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="shrink-0" style={{ fontSize: '13px', color: 'var(--subtle)' }}>
        {distanceKm ? `${distanceKm} ${t.units.km}` : null}
      </span>
    </button>
  )
}

// The strip is the tab's navigation and carries two variables: bar height is
// planned/done km, hue is the day's activity type (ACTIVITY_TYPE_CONFIG) -
// so a week's shape (two hard days back to back, a base week that quietly
// turned into a threshold week) reads at a glance instead of needing the
// detail pane open. Selection can no longer be "the green one" now that
// green is Base's own colour, so it moves to a ring plus a brighter tint of
// that day's own hue.
function WeekStrip({
  days,
  selectedDate,
  today,
  byDatePlanned,
  byDateCoach,
  onSelect,
}: {
  days: Day[]
  selectedDate: string
  today: string
  byDatePlanned: Map<string, PlannedWorkout>
  byDateCoach?: ReadonlyMap<string, PlanPrescriptionView[]>
  onSelect: (date: string) => void
}) {
  const BAR_MAX = 56
  const REST_HEIGHT = 5

  const barDays = days.map((d) => {
    const plannedType = resolvePlannedType(d.date, byDatePlanned, byDateCoach)
    const resolved = resolveDayType(d.acts, plannedType)
    if (d.acts.length > 0) {
      return { km: d.acts.reduce((sum, a) => sum + a.distanceKm, 0), resolved }
    }
    const coach = byDateCoach?.get(d.date)?.find((v) => v.state !== 'cancelled')
    const plan = byDatePlanned.get(d.date)
    const meters = coach ? prescriptionDistanceMeters(coach.prescription) : (plan?.distanceM ?? null)
    return { km: meters === null ? null : meters / 1000, resolved }
  })
  const maxKm = Math.max(1, ...barDays.map((b) => b.km).filter((km): km is number => km !== null))

  return (
    <div className="grid grid-cols-7 gap-1.5 px-1">
      {days.map((d, i) => {
        const { km, resolved } = barDays[i]!
        const isRest = km === null
        const isSelected = d.date === selectedDate
        const isToday = d.date === today
        const hue = resolved ? ACTIVITY_TYPE_CONFIG[resolved.type].chartColor : ACTIVITY_TYPE_CONFIG.Base.chartColor
        const plannedHue = resolved?.planned ? ACTIVITY_TYPE_CONFIG[resolved.planned].chartColor : null
        // The tallest day in the week fills the track; a rest day gets a
        // fixed stub instead of a scaled height, so it reads as an absence
        // rather than as the smallest session.
        const height = isRest ? REST_HEIGHT : Math.max(2, Math.round((km / maxKm) * BAR_MAX))
        const weekday = WEEKDAY_SHORT_INDEX[new Date(d.date + 'T00:00:00').getDay()]
        const coach = byDateCoach?.get(d.date) ?? []

        return (
          <button
            key={d.date}
            type="button"
            onClick={() => onSelect(d.date)}
            aria-label={`${formatDate(d.date, { style: 'full' })}${coach.length ? ` · ${coach.map((view) => `${view.prescription.title} · ${t.coaching.states[view.state]}`).join(', ')}` : ''}`}
            aria-pressed={isSelected}
            {...(coach.length ? { 'data-testid': `coach-calendar-${d.date}` } : {})}
            className="flex flex-col items-center gap-1 rounded-lg py-0.5 transition-transform active:scale-95"
          >
            <span
              className="text-micro font-bold leading-none"
              style={{ color: isRest ? 'var(--subtle-2)' : isSelected ? brighten(hue) : 'var(--subtle)' }}
            >
              {isRest ? t.plan.restDay.toLowerCase() : Math.round(km)}
            </span>
            {/* Always rendered (hidden, not removed) on rest days - dropping this
                line shortened the column above the bar, which pulled the whole
                bar container up and left the rest stub floating off the
                baseline every other column's bar sits on. */}
            <span
              className="text-[9px] font-semibold leading-none"
              style={{ color: 'var(--subtle-2)', visibility: isRest ? 'hidden' : 'visible' }}
            >
              {t.units.km}
            </span>
            <div className="flex w-full items-end justify-center" style={{ height: BAR_MAX }}>
              <div
                className="relative w-full rounded-[6px] transition-[height,background,box-shadow] active:opacity-70"
                style={
                  isRest
                    ? { height, background: REST_STUB_FILL }
                    : {
                        height,
                        background: isSelected ? brighten(hue) : hue,
                        boxShadow: isSelected ? `0 0 0 2px ${hue}` : undefined,
                      }
                }
              >
                {/* The day was run, and it didn't match what was planned - the
                    fill is what happened; this cap is what was supposed to. */}
                {plannedHue && (
                  <div
                    className="absolute inset-x-0 top-0 rounded-t-[6px]"
                    style={{ height: '3px', background: plannedHue }}
                  />
                )}
              </div>
            </div>
            <span
              className="text-micro font-bold leading-none"
              style={{ color: isToday ? 'var(--accent-text)' : 'var(--subtle)' }}
            >
              {weekday}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Volume, load and easy/hard are the week's three totals, read as one line
// instead of three cards - each with its unit spelled out so a bare "158/368"
// or "80/20" never appears without saying what it counts.
function WeekSummaryLine({
  volumeKm,
  sessions,
  load,
  loadTarget,
  loadIsPlanned,
  easyPct,
  hardPct,
}: {
  volumeKm: number
  sessions: number
  load: number
  loadTarget: number | null
  loadIsPlanned: boolean
  easyPct: number | null
  hardPct: number | null
}) {
  const s = t.plan.weekSummary
  // A target next to a completed load of exactly 0 reads as "nothing
  // happened" even on a week with real sessions logged - usually a week
  // whose activities carry no HR data, so TRIMP has nothing to compute from.
  // The planned-load case is the one 0 that's honestly a target, not a gap.
  const hasTarget = loadTarget !== null && loadTarget > 0 && (loadIsPlanned || load > 0)
  const overTarget = hasTarget && load > loadTarget
  return (
    <div
      data-testid="week-summary"
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1"
      style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}
    >
      <span className="font-semibold text-foreground">
        {volumeKm} {t.units.km} · {s.sessionsCount(sessions)}
      </span>
      <span>
        <span className="font-semibold text-foreground">{s.load}</span>
        {' '}
        <span
          className={overTarget ? 'font-semibold tabular-nums' : 'tabular-nums'}
          style={overTarget ? { color: 'var(--delta-warn)' } : undefined}
        >
          {hasTarget ? `${load}/${loadTarget}` : load}
        </span>
        {' '}
        {s.loadUnit}
        {loadIsPlanned && <> {s.loadPlanned}</>}
      </span>
      {easyPct !== null && hardPct !== null && <span>{s.easyHardRatio(easyPct, hardPct)}</span>}
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
  hrBounds,
  today,
  atPresent,
  onToday,
  onPrevWeek,
  onNextWeek,
  canGoForward = false,
  planPhaseRanges,
  nextRace,
  trainingZones = null,
  planSpan = null,
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
          return coach.map((view) => ({ ...coachWorkoutView(view, trainingZones, coach.length === 1 ? plan : null), done: false }))
        }
        const plan = byDatePlanned.get(d.date)
        return plan ? [{ ...plannedWorkoutView(plan, trainingZones), done: false }] : []
      })
  }, [days, byDateCoach, byDatePlanned, trainingZones])

  const weekActs = useMemo(() => days.flatMap((d) => d.acts), [days])
  const summary = useMemo(() => summarizeWeek(weekActs, hrBounds), [weekActs, hrBounds])

  // Garmin's own plan is the only source with a load estimate, so it still
  // backs the load target denominator - but it's a partial view of the week
  // whenever a coach is active (only key sessions tend to sync back to it),
  // so volume/session-count/intensity below are read from the coach
  // prescriptions first, falling back to Garmin's plan only on days without one.
  const planned = useMemo(() => {
    const workouts = days.map((d) => byDatePlanned.get(d.date)).filter((p) => p !== undefined)
    return workouts.length ? summarizePlannedWeek(workouts) : null
  }, [days, byDatePlanned])

  // Same priority as resolveDayType and the strip: a day that was actually
  // run counts as what was run, regardless of whether a coach/Garmin entry
  // exists for it. Reading straight from the plan for every day - as this
  // used to - silently dropped any completed day the plan didn't cover,
  // undercounting volume and sessions against what the strip and "this week"
  // list both show for the same week.
  const weekSessions = useMemo(() => {
    return days.flatMap((d) => {
      if (d.acts.length > 0) {
        return d.acts.map((a) => ({
          key: a.type !== 'Base',
          distanceKm: a.distanceKm,
          seconds: a.durationSeconds,
        }))
      }
      const coach = (byDateCoach?.get(d.date) ?? []).filter((v) => v.state !== 'cancelled')
      if (coach.length > 0) {
        return coach.map((view) => ({
          key: isKeyPrescription(view.prescription),
          distanceKm: (prescriptionDistanceMeters(view.prescription) ?? 0) / 1000,
          seconds: prescriptionDuration(view.prescription)?.seconds ?? 0,
        }))
      }
      const plan = byDatePlanned.get(d.date)
      if (!plan) return []
      return [{
        key: !!plan.type && plan.type !== 'Base',
        distanceKm: (plan.distanceM ?? 0) / 1000,
        seconds: plan.durationSecs ?? 0,
      }]
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

  const volumeKm = weekSessions.length > 0
    ? Math.round(weekSessions.reduce((sum, w) => sum + w.distanceKm, 0))
    : Math.round(weekActs.reduce((sum, a) => sum + a.distanceKm, 0))
  const sessionsCount = weekSessions.length > 0 ? weekSessions.length : weekActs.length
  // Easy/long vs threshold/interval, weighted by duration rather than by
  // session count so one long run doesn't count the same as one set of
  // strides. weekSessions already reads completed days as what was actually
  // run (see above), so this is the recorded split for a week that's
  // happened and the planned one for a week that hasn't - never a mix of
  // the two within the same week.
  const weekSessionSeconds = weekSessions.reduce((sum, w) => sum + w.seconds, 0)
  const hardPct = weekSessionSeconds > 0
    ? Math.round((weekSessions.filter((w) => w.key).reduce((sum, w) => sum + w.seconds, 0) / weekSessionSeconds) * 100)
    : null
  const easyPct = hardPct !== null ? 100 - hardPct : null

  // Garmin's load is retrospective (completed-so-far against a weekly
  // target), which is honest for a week already underway but reads as a
  // meaningless "0" for a week that hasn't happened yet - a future week
  // states the plan's own prescribed load instead, with no "completed"
  // half to divide it by.
  const isFutureWeek = firstDay.date > today
  const loadIsPlanned = isFutureWeek && planned !== null
  const load = loadIsPlanned ? planned!.estimatedLoad : summary.totalTrimp
  const loadTarget = loadIsPlanned ? null : (planned?.estimatedLoad ?? null)

  return (
    <div className="space-y-3">
      <div className="px-1">
        {(phaseLabel || weekOfLabel || fallbackLabel) && (
          <p className="text-footnote font-semibold text-muted-foreground">
            {phaseLabel && <span>{phaseLabel}</span>}
            {phaseLabel && weekOfLabel && ' · '}
            {weekOfLabel && <span>{weekOfLabel}</span>}
            {!phaseLabel && !weekOfLabel && fallbackLabel && <span>{fallbackLabel}</span>}
          </p>
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

      <WeekStrip
        days={days}
        selectedDate={selected.date}
        today={today}
        byDatePlanned={byDatePlanned}
        byDateCoach={byDateCoach}
        onSelect={selectDate}
      />

      <WeekSummaryLine
        volumeKm={volumeKm}
        sessions={sessionsCount}
        load={load}
        loadTarget={loadTarget}
        loadIsPlanned={loadIsPlanned}
        easyPct={easyPct}
        hardPct={hardPct}
      />

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
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate font-bold text-foreground" style={{ fontSize: '19px' }}>
                    {activityTitle(a)}
                  </span>
                  <span className="flex shrink-0 items-center" style={{ gap: '8px' }}>
                    <span
                      className={cn('font-bold uppercase', DONE_INK)}
                      style={{
                        fontSize: '11px',
                        letterSpacing: '.06em',
                        background: 'rgba(90,151,245,.16)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                      }}
                    >
                      {t.plan.doneChip}
                    </span>
                    <ChevronRight size={19} style={{ color: 'var(--subtle-2)' }} aria-hidden="true" />
                  </span>
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

      {thisWeekSessions.length > 0 && (
        <div className="px-1">
          <SectionDivider as="p" className="mb-2.5 flex items-center gap-2">
            {t.plan.weekPurpose.thisWeek}
          </SectionDivider>
          <div>
            {thisWeekSessions.map((workout, i) => (
              <WeekSessionRow
                key={workout.key}
                workout={workout}
                onTap={() => selectDate(workout.date)}
                isLast={i === thisWeekSessions.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {footerRaces.length > 0 && (
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
