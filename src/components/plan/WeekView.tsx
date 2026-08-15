'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronRight, Footprints, X } from 'lucide-react'
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
import { parseWorkoutStructure } from '@/domain/training/workoutStructure'
import { WorkoutStructureBars } from './WorkoutStructure'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ActivitySheet } from './ActivitySheet'
import { InlineJumpButton } from '@/components/ui/InlineJumpButton'
import { PlannedWorkoutSheet } from './PlannedWorkoutSheet'
import { WeekPurposeBanner } from './WeekPurposeBanner'
import { RaceFooter } from './RaceFooter'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { paceZoneKeyFor } from '@/domain/training/typePaceZone'
import type { PlanSpan } from '@/domain/training/planProgress'
import type { Insight } from '@/lib/gemini'
import { addDays, isoDate, isoWeekNumber } from '@/lib/calendarDate'
import { formatDate, formatDateFull, formatDurationWords, formatPaceRange } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const MISSED = 'var(--color-missed)'
// alpha variants via color-mix (supported Safari 16.2+, all modern browsers)
const TODAY_38 = 'color-mix(in srgb, var(--color-today) 38%, transparent)'
const MISSED_10 = 'color-mix(in srgb, var(--color-missed) 10%, transparent)'
const MISSED_25 = 'color-mix(in srgb, var(--color-missed) 25%, transparent)'
const ACCENT_15 = 'color-mix(in srgb, var(--accent) 15%, transparent)'
const ACCENT_30 = 'color-mix(in srgb, var(--accent) 30%, transparent)'
// foreground-tinted neutrals so planned/rest cells stay visible in light mode
// (previously hardcoded rgba(255,255,255,...) - white on white in light)
const FG_05 = 'color-mix(in srgb, var(--color-foreground) 5%, transparent)'
const FG_07 = 'color-mix(in srgb, var(--color-foreground) 7%, transparent)'
const FG_18 = 'color-mix(in srgb, var(--color-foreground) 18%, transparent)'

const TREND_WEEKS = 8

interface Day {
  date: string
  day: number
  acts: ActivitySummary[]
}

// The card itself stays a neutral surface and only the icon tile carries the
// session's colour - a fully tinted card competes with the week strip above it,
// where colour is what distinguishes the days.
function PlannedWorkoutRow({
  plan,
  zones,
  onTap,
}: {
  plan: PlannedWorkout
  zones: TrainingZonesData | null
  onTap: () => void
}) {
  const typeColor = plan.type ? ACTIVITY_TYPE_CONFIG[plan.type as ActivityType].chartColor : null
  const Icon = plan.type ? ACTIVITY_TYPE_ICONS[plan.type as ActivityType] : Footprints
  const structure = plan.steps ?? parseWorkoutStructure(plan.name, plan.durationSecs)

  // Target pace for the steady-effort types, straight off the athlete's own
  // threshold-derived zones. Interval types have no single range, so they
  // simply keep the type name.
  const zoneKey = paceZoneKeyFor(plan.type as ActivityType | undefined)
  const zone = zoneKey ? zones?.zones.find((z) => z.key === zoneKey) ?? null : null
  const title = [
    plan.name,
    plan.durationSecs ? formatDurationWords(plan.durationSecs) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button
      type="button"
      onClick={onTap}
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
          <Icon
            size={19}
            strokeWidth={2.2}
            style={typeColor ? { color: typeColor } : undefined}
            className={!typeColor ? 'text-accent' : undefined}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-foreground">{title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {[
              plan.scheduledTime ? t.plan.timeOfDay[plan.scheduledTime] : null,
              zone ? (zone.key === 'easy' ? t.plan.easyEffortLabel : zone.label) : plan.type ? t.activityTypes[plan.type as ActivityType] : null,
              zone ? formatPaceRange([zone.paceMinSecPerKm, zone.paceMaxSecPerKm]) : null,
            ]
              .filter(Boolean)
              .join(' · ') || t.plan.planned}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
      </div>
      {/* A single continuous block (e.g. an easy run) has no interval shape to
          show - one 100%-height bar would just be visual noise. */}
      {structure && structure.length > 1 && (
        <WorkoutStructureBars steps={structure} className="mt-3 flex h-[18px] items-end gap-[2px]" />
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

// Same easy/hard split the week's stat tiles use: anything but Base counts as
// a key session, tagged accordingly instead of repeating its distance.
const KEY_SESSION_TYPES = new Set<ActivityType>(['Threshold', 'Sprint', 'Tempo'])

/** Compact row for the coming-up list: a color dot, the workout name, weekday +
 * a short detail below it, and a right-aligned tag (key session, or distance). */
function NextWeekPlanRow({ plan, onTap }: { plan: PlannedWorkout; onTap: () => void }) {
  const typeColor = plan.type ? ACTIVITY_TYPE_CONFIG[plan.type as ActivityType].chartColor : null
  const weekday = WEEKDAY_SHORT_INDEX[new Date(plan.date + 'T00:00:00').getDay()]
  const detail = plan.durationSecs
    ? formatDurationWords(plan.durationSecs)
    : plan.scheduledTime
      ? t.plan.timeOfDay[plan.scheduledTime]
      : undefined
  const isKey = plan.type ? KEY_SESSION_TYPES.has(plan.type as ActivityType) : false
  const distanceKm = plan.distanceM ? Math.round(plan.distanceM / 1000) : null
  const tag = isKey ? t.plan.keyTag : distanceKm ? `~${distanceKm} ${t.units.km}` : null

  return (
    <button
      type="button"
      onClick={onTap}
      className="flex w-full items-center gap-2.5 rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-2.5 text-left transition-colors hover:bg-foreground/[0.07]"
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: typeColor ?? 'var(--accent)' }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-foreground">{plan.name}</span>
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
      <div className="text-micro font-bold uppercase tracking-[0.05em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-lg font-bold tabular-nums text-foreground">{value}</div>
    </GlassSurface>
  )
}

interface Props {
  weekStart: Date
  activities: ActivitySummary[]
  byDate: Map<string, ActivitySummary[]>
  byDatePlanned: Map<string, PlannedWorkout>
  hrBounds?: HrBounds
  today: string
  atPresent: boolean
  onToday: () => void
  /** Garmin's daily training status, keyed by date - empty when the watch has never synced it. */
  statusByDate: TrainingStatusCalendar
  /** The current Garmin Coach plan's phases - empty when the athlete has none active. */
  planPhaseRanges: PlanPhaseRange[]
  /** The next upcoming race, for the plan's build-toward footer. */
  nextRace?: UpcomingRace | null
  /** Athlete pace zones, so a planned session can state its target pace. */
  trainingZones?: TrainingZonesData | null
  /** The plan's own start/end, for the week-of-block count. */
  planSpan?: PlanSpan | null
  /** Pre-selects this day when landing from the month view (component remounts per navigation). */
  initialSelectedDate?: string | null
  /** Generated line for the week in progress - only ever rendered on that week. */
  weekPurposeTake?: Insight | null
}

export function WeekView({
  weekStart,
  activities,
  byDate,
  byDatePlanned,
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
  weekPurposeTake = null,
}: Props) {
  const days: Day[] = Array.from({ length: 7 }, (_, i) => {
    const date = isoDate(addDays(weekStart, i))
    return { date, day: Number(date.slice(8)), acts: byDate.get(date) ?? [] }
  })
  // Array.from({ length: 7 }) is always non-empty.
  const firstDay = days[0]!

  const [selectedDate, setSelectedDate] = useState(
    () =>
      days.find((d) => d.date === initialSelectedDate)?.date ??
      days.find((d) => d.date === today)?.date ??
      firstDay.date
  )
  const [sheetActivity, setSheetActivity] = useState<ActivitySummary | null>(null)
  const [sheetPlan, setSheetPlan] = useState<PlannedWorkout | null>(null)

  const selected = days.find((d) => d.date === selectedDate) ?? firstDay
  const selectedPlan = byDatePlanned.get(selected.date)

  function activityTitle(a: ActivitySummary): string {
    if (a.description && a.description !== t.activityTypes[a.type]) return a.description
    return selectedPlan?.name ?? a.description ?? t.activityTypes[a.type]
  }

  // "Coming up" is the next sessions from now, not just next week - it catches
  // this week's remaining key days too (the mockup's Thu/Sun). Scans the two
  // weeks after today and keeps the soonest few; only meaningful on the present
  // week, so the render gates on atPresent.
  const nextWeekPlans = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => isoDate(addDays(new Date(today + 'T00:00:00'), i + 1)))
        .map((date) => byDatePlanned.get(date))
        .filter((p): p is PlannedWorkout => !!p)
        .slice(0, 3),
    [today, byDatePlanned]
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

  const planPhase = useMemo(
    () => weekPlanPhase(days.map((d) => d.date), planPhaseRanges),
    [days, planPhaseRanges]
  )

  const planned = useMemo(() => {
    // Untyped planned sessions still count, so map the workouts, not the types.
    const workouts = days.map((d) => byDatePlanned.get(d.date)).filter((p) => p !== undefined)
    return workouts.length ? summarizePlannedWeek(workouts.map((p) => p.type)) : null
  }, [days, byDatePlanned])

  // days[6] exists (fixed-length 7 array); the last day gone means the week is judgeable.
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
        planPhaseRanges={planPhaseRanges}
        planSpan={planSpan}
        today={today}
        aiTake={isCurrentWeek ? (weekPurposeTake ?? null) : null}
      />

      {/* Week strip, bare on the background as in the mockup: the day tiles are
          themselves the framed objects, so a card around them double-frames. */}
      <div className="px-0.5">
        {!atPresent && (
          <div className="mb-2.5 flex items-center justify-end gap-2">
            <InlineJumpButton onClick={onToday}>{t.plan.today}</InlineJumpButton>
          </div>
        )}

        <div>
          {/* Day cells: colored, type-labeled blocks (rest/missed keep a distinct, non-typed look) */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
                const isToday = d.date === today
                const isPast = d.date < today
                const completed = d.acts.length > 0
                const plan = byDatePlanned.get(d.date)
                const planned = !completed && !!plan
                const missed = isPast && planned
                const rest = !completed && !planned
                const primaryType: ActivityType | null = (d.acts[0]?.type ?? plan?.type) ?? null
                const typeColor = primaryType && !missed ? ACTIVITY_TYPE_CONFIG[primaryType].chartColor : null
                const label = primaryType ? t.plan.typeShort[primaryType] : rest ? t.plan.restDay : null
                // Today's ring/glow takes the session's own type color (Tempo amber,
                // VO2 red, ...) rather than the theme accent - a rest day has no
                // session, so it falls back to the accent.
                const todayGlow = typeColor ?? 'var(--accent)'

                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setSelectedDate(d.date)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg py-0.5 transition-transform active:scale-95',
                      d.date === selectedDate && 'bg-foreground/[0.06]'
                    )}
                  >
                    <div className="relative w-full">
                      {/* Pulse ring for today: opacity-only animation, not scale+fade */}
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
                          // Solid borders everywhere, as in the mockup - the
                          // dashed planned/missed cells read as broken tiles.
                          ...(completed
                            ? { background: typeColor ? `${typeColor}33` : ACCENT_15, borderColor: typeColor ? `${typeColor}80` : ACCENT_30 }
                            : missed
                              ? { background: MISSED_10, borderColor: MISSED_25 }
                              : planned
                                ? { background: typeColor ? `${typeColor}14` : FG_05, borderColor: typeColor ? `${typeColor}59` : FG_18 }
                                : { background: FG_05, borderColor: FG_07 }),
                          // Today is ringed and lit whatever it holds, rather
                          // than only when it happens to be a rest day.
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

                        {/* Stacked under the type, not pinned to the corner:
                            the mockup reads type-then-outcome top to bottom. */}
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

      {/* Decisional header: easy/hard, load, climb - standalone dark tiles, not a card */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryStat
          label={t.plan.weekSummary.easyHard}
          value={
            summary.hardPct !== null ? (
              <>
                {/* Easy derived from rounded hard so they sum to 100 and match Today/Activities. */}
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
        {/* Left-aligned section eyebrow, "Today · Wed, Jul 22" - the mockup
            leads with what the day is, then dates it. */}
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
        ) : selectedPlan ? (
          <PlannedWorkoutRow plan={selectedPlan} zones={trainingZones} onTap={() => setSheetPlan(selectedPlan)} />
        ) : (
          <p className="text-center text-sm text-subtle">{t.plan.restDay}</p>
        )}
      </div>

      {/* A section, not a card: the rows are already surfaces, so boxing them
          again nests a card inside a card. Muted eyebrow like the mockup. */}
      {atPresent && nextWeekPlans.length > 0 && (
        <div className="px-1">
          <p className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {t.plan.comingUp}
          </p>
          <div className="space-y-2">
            {nextWeekPlans.map((plan) => (
              <NextWeekPlanRow key={plan.date} plan={plan} onTap={() => setSheetPlan(plan)} />
            ))}
          </div>
        </div>
      )}

      {nextRace && atPresent && (
        <RaceFooter race={nextRace} planSpan={planSpan} today={today} />
      )}

      {sheetActivity && (
        <ActivitySheet
          activity={sheetActivity}
          title={activityTitle(sheetActivity)}
          onClose={() => setSheetActivity(null)}
        />
      )}
      {sheetPlan && <PlannedWorkoutSheet workout={sheetPlan} onClose={() => setSheetPlan(null)} />}
    </div>
  )
}
