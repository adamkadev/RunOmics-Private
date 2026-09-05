import { GlassSurface } from '@/components/ui/GlassSurface'
import { cn } from '@/lib/utils'
import type { PlannedWeek, WeekAdherence, WeekLoadLevel } from '@/domain/training/weekSummary'
import type { TrainingStatusType } from '@/application/usecases/GetTrainingStatus'
import type { PlanPhaseRange, TrainingPlanPhase } from '@/application/usecases/GetTrainingPlan'
import { TRAINING_STATUS_COLORS, TRAINING_PLAN_PHASE_COLORS } from '@/lib/colors'
import { PlanPhaseTrack } from './PlanPhaseTrack'
import { weeksInPlan, type PlanSpan } from '@/domain/training/planProgress'
import { t } from '@/i18n'

const TONE_CLASS: Record<WeekLoadLevel, { border: string; text: string; from: string }> = {
  low:    { border: 'border-blue-500/30',   text: 'text-blue-600 dark:text-blue-400',   from: 'from-blue-500/10' },
  normal: { border: 'border-accent/30',     text: 'text-accent-text',                   from: 'from-accent/10' },
  high:   { border: 'border-amber-500/30',  text: 'text-amber-600 dark:text-amber-400', from: 'from-amber-500/10' },
}

const PURPOSE_LABEL: Record<WeekLoadLevel, string> = {
  low: t.plan.weekPurpose.recovery,
  normal: t.plan.weekPurpose.steady,
  high: t.plan.weekPurpose.build,
}

interface Props {
  /** Whether the week is over: a running week is described by its plan, a finished one by what it turned out to be. */
  over: boolean
  current: boolean
  level: WeekLoadLevel | null
  percent: number | null
  adherence: WeekAdherence | null
  /** Garmin's verdict on the week, when the watch rated enough of its days. */
  garminStatus: TrainingStatusType | null
  /** Garmin Coach's own phase for the week (build/peak/taper/race day), when a plan covers it. */
  planPhase: TrainingPlanPhase | null
  planned: PlannedWeek | null
  /** The current Garmin Coach plan's phase ranges, rendered as a track inside
   *  this same card - the block banner and its progress are one visual unit. */
  planPhaseRanges: PlanPhaseRange[]
  /** The plan's own start/end - the phases omit the base weeks. */
  planSpan: PlanSpan | null
  /** Where today sits in the coaching block, when one is active - it counts the
   *  plan's own weeks rather than the Monday rows a span happens to touch. */
  blockWeek?: { done: number; total: number } | null
  /** Position in the macrocycle toward the primary target, when coaching is active. */
  targetWeek?: { done: number; total: number } | null
  today: string
}

// A week gets named from what it is, in this order:
//
//   - over, and rated by the watch: Garmin's own verdict (productive, recovery,
//     detraining...) wins outright - a reading of what happened beats any
//     intent. A week the plan called "build" but that was run as recovery
//     ends up labelled recovery, and updates the moment Garmin revises it;
//   - not over yet, and covered by a Garmin Coach plan: the plan's own phase
//     name (build/peak/taper/race day) - what the plan intends for the week,
//     which is a fact from Garmin, not a guess;
//   - not over yet, no known phase: judging a week on the load logged so far
//     always reads low (a partial total against the full 8-week typical), so
//     this falls back to a plain "this/upcoming week" rather than a fabricated
//     "recovery week";
//   - over, unrated, no phase: our TRIMP load level, the pre-Garmin fallback.
//
// Nothing here invents a mesocycle position ("3 of 4") - only what Garmin
// itself states, either as a plan phase or as a status reading.
export function WeekPurposeBanner({
  over,
  current,
  level,
  percent,
  adherence,
  garminStatus,
  planPhase,
  planned,
  planPhaseRanges,
  planSpan,
  blockWeek: blockWeekOverride = null,
  targetWeek = null,
  today,
}: Props) {
  const verdict = over ? garminStatus : null
  const phase = over ? null : planPhase
  // A block with published phases always has its track to show.
  if (planPhaseRanges.length < 2) {
    if (!over && !phase && !planned && adherence === null) return null
    if (over && level === null && adherence === null && verdict === null) return null
  }

  const tone = TONE_CLASS[level ?? 'normal']
  const blockWeek = blockWeekOverride ?? weeksInPlan(planSpan, today)
  const accentColor = verdict ? TRAINING_STATUS_COLORS[verdict] : phase ? TRAINING_PLAN_PHASE_COLORS[phase] : null
  const title = verdict
    ? t.trainingStatus.status[verdict]
    : phase
      ? t.plan.weekPurpose.planPhase[phase]
      : !over
        ? current
          ? t.plan.weekPurpose.thisWeek
          : t.plan.weekPurpose.upcoming
        : level
          ? PURPOSE_LABEL[level]
          : t.plan.weekPurpose.thisWeek

  return (
    <GlassSurface
      variant="card"
      className={cn(
        'rounded-card-sm bg-gradient-to-br to-transparent p-3.5',
        !accentColor && tone.border,
        !accentColor && tone.from,
      )}
      style={
        accentColor
          ? {
              borderColor: `${accentColor}4d`,
              backgroundImage: `linear-gradient(to bottom right, ${accentColor}1a, transparent)`,
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div
            className={cn('font-display text-lg font-bold leading-tight', !accentColor && tone.text)}
            style={accentColor ? { color: accentColor } : undefined}
          >
            {title}
          </div>
          {/* A running week shows what is planned; a finished one, how its load
              landed. The load percent is meaningless mid-week (partial total). */}
          {!over && (planned || blockWeek) && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {[
                planned ? t.plan.weekPurpose.plannedSessions(planned.total, planned.key) : null,
                blockWeek ? t.plan.weekPurpose.weekOfBlock(blockWeek.done, blockWeek.total) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
          {over && percent !== null && (
            <div className="mt-0.5 text-xs text-muted-foreground">{t.plan.weekSummary.vsTypical(percent)}</div>
          )}
        </div>
        {targetWeek ? (
          <div className="shrink-0 text-right">
            <div className="font-display text-subhead font-bold leading-none text-accent-text">
              {t.plan.weekPurpose.weekOfTarget(targetWeek.done, targetWeek.total)}
            </div>
          </div>
        ) : adherence && (
          <div className="shrink-0 text-right">
            <div
              className={cn('font-display text-title2 font-bold leading-none tabular-nums', !accentColor && tone.text)}
              style={accentColor ? { color: accentColor } : undefined}
            >
              {adherence.percent}%
            </div>
            <div className="text-micro text-muted-foreground">
              {t.plan.weekPurpose.adherence(adherence.done, adherence.planned)}
            </div>
          </div>
        )}
      </div>

      {/* Base->Build->Peak->Taper progress, inside the same card as the
          banner - one visual unit, not two stacked cards. */}
      <PlanPhaseTrack ranges={planPhaseRanges} today={today} />

    </GlassSurface>
  )
}
