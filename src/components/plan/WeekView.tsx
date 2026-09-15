'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronRight, Footprints, X } from 'lucide-react'
import { SectionDivider } from '@/components/ui/SectionLabel'
import type { ActivitySummary, ActivityType, PlannedWorkout } from '@/domain/activity/types'
import { ACTIVITY_TYPE_CONFIG, ACTIVITY_TYPE_ICONS } from '@/domain/activity/types'
import type { HrBounds } from '@/domain/training/trimp'
import {
  summarizeWeek,
  weeklyTrimpTotals,
  compareWeekLoad,
  computeWeekAdherence,
  summarizePlannedWeek,
} from '@/domain/training/weekSummary'
import { weekTrainingStatus } from '@/domain/training/weekStatus'
import { weekPlanPhase } from '@/domain/training/weekPlanPhase'
import type { TrainingStatusCalendar } from '@/application/usecases/GetTrainingStatusCalendar'
import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'
import { WorkoutStructureBars } from './WorkoutStructure'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ActivitySheet } from './ActivitySheet'
import { InlineJumpButton } from '@/components/ui/InlineJumpButton'
import { PlannedWorkoutSheet } from './PlannedWorkoutSheet'
import { WeekPurposeBanner } from './WeekPurposeBanner'
import { RaceFooter, type FooterRace } from './RaceFooter'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import type { PlanSpan } from '@/domain/training/planProgress'
import { addDays, isoDate, isoWeekNumber } from '@/lib/calendarDate'
import { formatDate, formatDateFull } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { CoachingOverview, PrescriptionView } from '@/application/coaching/GetCoachingView'
import { COACHING_TO_ACTIVITY_TYPE } from '@/domain/coaching/types'
import { macrocyclePhaseRanges, macrocycleWeek } from '@/components/coaching/presentation'
import {
  coachWorkoutView,
  formatPlanDuration,
  plannedWorkoutView,
  type PlanWorkoutView,
} from './planWorkoutView'

const MISSED = 'var(--color-missed)'
const TODAY_38 = 'color-mix(in srgb, var(--color-today) 38%, transparent)'
const MISSED_10 = 'color-mix(in srgb, var(--color-missed) 10%, transparent)'
const MISSED_25 = 'color-mix(in srgb, var(--color-missed) 25%, transparent)'
const ACCENT_15 = 'color-mix(in srgb, var(--accent) 15%, transparent)'
const ACCENT_30 = 'color-mix(in srgb, var(--accent) 30%, transparent)'
const FG_05 = 'color-mix(in srgb, var(--color-foreground) 5%, transparent)'
const FG_07 = 'color-mix(in srgb, var(--color-foreground) 7%, transparent)'
const FG_18 = 'color-mix(in srgb, var(--color-foreground) 18%, transparent)'

const TREND_WEEKS = 8

interface Day {
  date: string
  day: number
  acts: ActivitySummary[]
}

function PlannedWorkoutRow({
  workout,
  onTap,
}: {
  workout: PlanWorkoutView
  onTap: () => void
}) {
  const typeColor = workout.type ? ACTIVITY_TYPE_CONFIG[workout.type].chartColor : null
  const Icon = workout.type ? ACTIVITY_TYPE_ICONS[workout.type] : Footprints
  const title = [workout.title, formatPlanDuration(workout.duration)].filter(Boolean).join(' · ')

  return (
    <button
      type="button"
      onClick={onTap}
      data-testid={`plan-workout-row-${workout.key}`}
      className="w-full rounded-2xl border border-foreground/[0.08] bg-foreground/[0.04] p-3.5 text-left transition-colors hover:bg-foreground/[0.07]"
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            !typeColor && 'bg-accent/10'
          )}
          style={typeColor ? { background: `${typeColor}1f` } : undefined}
        >
          <Icon size={19} strokeWidth={2.2} className="text-foreground" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-foreground">{title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {[workout.scheduledTime ? t.plan.timeOfDay[workout.scheduledTime] : null, workout.effort]
              .filter(Boolean)
              .join(' · ') || t.plan.planned}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
      </div>
      {workout.structure && workout.structure.length > 1 && (
        <WorkoutStructureBars steps={workout.structure} className="mt-3 flex h-[18px] items-end gap-[2px]" />
      )}
    </button>
  )
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

function ComingUpRow({ workout, onTap }: { workout: PlanWorkoutView; onTap: () => void }) {
  const typeColor = workout.type ? ACTIVITY_TYPE_CONFIG[workout.type].chartColor : null
  const weekday = WEEKDAY_SHORT_INDEX[new Date(workout.date + 'T00:00:00').getDay()]
  const detail =
    formatPlanDuration(workout.duration) ??
    (workout.scheduledTime ? t.plan.timeOfDay[workout.scheduledTime] : undefined)
  const distanceKm = workout.distanceM ? Math.round(workout.distanceM / 1000) : null
  const tag = workout.isKey ? t.plan.keyTag : distanceKm ? `~${distanceKm} ${t.units.km}` : null

  return (
    <button
      type="button"
      onClick={onTap}
      data-testid={`coming-up-${workout.key}`}
      className="flex w-full items-center gap-2.5 rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-2.5 text-left transition-colors hover:bg-foreground/[0.07]"
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: typeColor ?? 'var(--accent)' }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-foreground">{workout.title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {[weekday, detail].filter(Boolean).join(' · ')}
        </span>
      </span>
      {tag && <span className="shrink-0 text-xs font-medium text-muted-foreground">{tag}</span>}
    </button>
  )
}

function SummaryStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <GlassSurface variant="card" className="rounded-[14px] px-3 py-3">
      <SectionDivider>{label}</SectionDivider>
      <div className="mt-1 font-display text-lg font-bold tabular-nums text-foreground">{value}</div>
    </GlassSurface>
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
    return { date, day: Number(date.slice(8)), acts: byDate.get(date) ?? [] }
  })
  const firstDay = days[0]!

  const [selectedDate, setSelectedDate] = useState(
    () =>
      days.find((d) => d.date === initialSelectedDate)?.date ??
      days.find((d) => d.date === today)?.date ??
      firstDay.date
  )
  const [sheetActivity, setSheetActivity] = useState<ActivitySummary | null>(null)
  const [sheetWorkout, setSheetWorkout] = useState<PlanWorkoutView | null>(null)

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
    return workouts.length ? summarizePlannedWeek(workouts.map((p) => p.type)) : null
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
                const typeColor = primaryType && !missed ? ACTIVITY_TYPE_CONFIG[primaryType].chartColor : null
                const label = primaryType ? t.plan.typeShort[primaryType] : rest ? t.plan.restDay : null
                const todayGlow = typeColor ?? 'var(--accent)'

                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => { setSelectedDate(d.date); onSelectDate?.(d.date) }}
                    aria-label={`${formatDateFull(d.date)}${coach.length ? ` · ${coach.map(view => `${view.prescription.title} · ${t.coaching.states[view.state]}`).join(', ')}` : ''}`}
                    aria-pressed={d.date === selectedDate}
                    {...(coach.length ? { 'data-testid': `coach-calendar-${d.date}` } : {})}
                    className={cn(
                      'min-w-0 flex flex-col items-center gap-1 rounded-lg py-0.5 transition-transform active:scale-95',
                      d.date === selectedDate && 'bg-foreground/[0.06]'
                    )}
                  >
                    <div className="relative w-full">
                      {isToday && rest && (
                        <div
                          className="pointer-events-none absolute -inset-0.5 rounded-[10px] border"
                          style={{
                            borderColor: TODAY_38,
                            animation: 'pulse-ring 2s ease-in-out infinite',
                          }}
                        />
                      )}

                      <div
                        className="relative flex h-[52px] w-full flex-col items-center justify-center gap-0.5 rounded-[11px] border px-0.5 transition-colors"
                        style={{
                          ...(completed
                            ? { background: typeColor ? `${typeColor}33` : ACCENT_15, borderColor: typeColor ? `${typeColor}80` : ACCENT_30 }
                            : missed
                              ? { background: MISSED_10, borderColor: MISSED_25 }
                              : planned
                                ? { background: typeColor ? `${typeColor}14` : FG_05, borderColor: typeColor ? `${typeColor}59` : FG_18 }
                                : { background: FG_05, borderColor: FG_07 }),
                          ...(isToday
                            ? {
                                borderColor: todayGlow,
                                borderWidth: 1.5,
                                boxShadow: `0 0 14px color-mix(in srgb, ${todayGlow} 35%, transparent)`,
                              }
                            : null),
                        }}
                      >
                        <span
                          className={cn(
                            'truncate text-center text-micro font-bold leading-tight',
                            rest && 'font-semibold opacity-40'
                          )}
                          style={{ color: missed ? MISSED : rest ? 'var(--color-foreground)' : (typeColor ?? 'var(--accent)') }}
                        >
                          {label}
                        </span>

                        {completed && (
                          <Check size={11} strokeWidth={3.4} style={{ color: typeColor ?? 'var(--accent)' }} />
                        )}
                        {missed && <X size={11} strokeWidth={3.4} style={{ color: MISSED }} />}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SummaryStat
          label={t.plan.weekSummary.easyHard}
          value={
            summary.hardPct !== null ? (
              <>
                <AnimatedValue value={100 - Math.round(summary.hardPct)} />/
                <AnimatedValue value={Math.round(summary.hardPct)} />
              </>
            ) : (
              '–'
            )
          }
        />
        <SummaryStat label={t.plan.weekSummary.load} value={<AnimatedValue value={summary.totalTrimp} />} />
        <SummaryStat
          label={t.plan.weekSummary.climb}
          value={
            <>
              <AnimatedValue value={summary.elevationGainM} /> {t.units.m}
            </>
          }
        />
      </div>

      <div className="space-y-3 px-1">
        <p className="text-xs font-bold uppercase tracking-wide text-accent-text">
          {selected.date === today
            ? `${t.plan.today} · ${formatDate(selected.date)}`
            : formatDateFull(selected.date)}
        </p>

        {selected.acts.length > 0 ? (
          <div className="space-y-2">
            {selected.acts.map((a) => {
              const ActIcon = ACTIVITY_TYPE_ICONS[a.type]
              return (
              <button
                key={a.id}
                type="button"
                onClick={() => setSheetActivity(a)}
                className="flex w-full items-center gap-3 rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-3 text-left transition-colors hover:bg-foreground/[0.07]"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                  style={{
                    background: `${ACTIVITY_TYPE_CONFIG[a.type].chartColor}1a`,
                    borderColor: `${ACTIVITY_TYPE_CONFIG[a.type].chartColor}44`,
                  }}
                >
                  <ActIcon size={16} strokeWidth={2.2} style={{ color: ACTIVITY_TYPE_CONFIG[a.type].chartColor }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {activityTitle(a)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t.activityTypes[a.type]} · {a.distanceKm.toFixed(1)} {t.units.km}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-foreground/30" />
              </button>
              )
            })}
          </div>
        ) : selectedWorkouts.length > 0 ? (
          <div className="space-y-2">
            {selectedWorkouts.map((workout) => (
              <PlannedWorkoutRow key={workout.key} workout={workout} onTap={() => setSheetWorkout(workout)} />
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-subtle">{t.plan.restDay}</p>
        )}
      </div>

      {atPresent && comingUp.length > 0 && (
        <div className="px-1">
          <SectionDivider as="p" className="mb-2.5 flex items-center gap-2">
            {t.plan.comingUp}
          </SectionDivider>
          <div className="space-y-2">
            {comingUp.map((workout) => (
              <ComingUpRow
                key={workout.key}
                workout={workout}
                onTap={() => setSelectedDate(workout.date)}
              />
            ))}
          </div>
        </div>
      )}

      {footerRaces.length > 0 && atPresent && (
        <RaceFooter races={footerRaces} planSpan={footerSpan} today={today} />
      )}

      {sheetActivity && (
        <ActivitySheet
          activity={sheetActivity}
          title={activityTitle(sheetActivity)}
          onClose={() => setSheetActivity(null)}
        />
      )}
      {sheetWorkout && <PlannedWorkoutSheet workout={sheetWorkout} onClose={() => setSheetWorkout(null)} />}
    </div>
  )
}
