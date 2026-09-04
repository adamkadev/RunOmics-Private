import type { Activity } from '@/domain/activity/types'
import { runVerdictTone } from '@/domain/activity/runVerdict'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { STATUS } from '@/lib/statusColors'
import type { Insight } from '@/lib/gemini'
import type { ActivityCoachingView } from '@/application/coaching/GetCoachingView'
import { formatClock, formatDistance, formatDurationShort } from '@/lib/formatters'
import { StatusPill } from '@/components/ui/StatusPill'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const TONE_TEXT_CLASS = {
  positive: STATUS.success.text,
  neutral: 'text-foreground',
  caution: STATUS.warning.text,
} as const

interface Props {
  activity: Activity
  /** Generated copy for the same tone; falls back to the rules-based copy when absent. */
  aiVerdict: Insight | null
  coaching: ActivityCoachingView | null
}

function Comparison({ coaching }: { coaching: ActivityCoachingView }) {
  const comparison = coaching.evaluation.matchStatus === 'matched' ? coaching.evaluation.comparison : undefined
  if (!comparison) return null
  const rows = [
    comparison.plannedDistanceMeters !== undefined && comparison.actualDistanceMeters !== undefined
      ? [t.coaching.distance, `${formatDistance(comparison.plannedDistanceMeters / 1_000)} / ${formatDistance(comparison.actualDistanceMeters / 1_000)} ${t.units.km}`]
      : null,
    comparison.plannedDurationSeconds !== undefined && comparison.actualDurationSeconds !== undefined
      ? [t.activity.stats.duration, `${formatDurationShort(comparison.plannedDurationSeconds)} / ${formatDurationShort(comparison.actualDurationSeconds)}`]
      : null,
    comparison.plannedPaceSecPerKm !== undefined && comparison.actualPaceSecPerKm !== undefined
      ? [t.coaching.pace, `${formatClock(comparison.plannedPaceSecPerKm.min)}–${formatClock(comparison.plannedPaceSecPerKm.max)} / ${formatClock(comparison.actualPaceSecPerKm)} ${t.units.perKm}`]
      : null,
    comparison.plannedHrBpm !== undefined && comparison.actualAvgHrBpm !== undefined
      ? [t.coaching.heartRate, `${comparison.plannedHrBpm.min}–${comparison.plannedHrBpm.max} / ${comparison.actualAvgHrBpm} ${t.units.bpm}`]
      : null,
  ].filter((row): row is string[] => row !== null)
  if (rows.length === 0) return null
  return (
    <div className="mt-3 grid gap-1.5 border-t border-foreground/[0.08] pt-3 text-left">
      <div className="mb-0.5 flex justify-end gap-3 text-micro font-bold uppercase tracking-[0.06em] text-muted-foreground">
        <span>{t.coaching.planned}</span><span>/</span><span>{t.coaching.actual}</span>
      </div>
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">{label}</span><span className="font-mono font-semibold text-foreground">{value}</span>
        </div>
      ))}
    </div>
  )
}

function PlanChanges({ coaching }: { coaching: ActivityCoachingView }) {
  const changes = coaching.decision?.changes ?? []
  if (changes.length === 0) return <p className="mt-1 text-xs text-muted-foreground">{t.coaching.noPlanChange}</p>
  const descriptions = changes.map((change) => {
    if (change.kind === 'cancel_workout') return t.coaching.cancelledSession(change.before.title)
    if (change.kind === 'upsert_workout') return t.coaching.updatedSession(change.after.title)
    const count = change.afterWeeks.flatMap((week) => week.workouts).length
    return t.coaching.futureSessionsChanged(count)
  })
  return (
    <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
      {descriptions.map((description) => <li key={description}>• {description}</li>)}
    </ul>
  )
}

export function RunVerdict({ activity, aiVerdict, coaching }: Props) {
  const v = t.activity.verdict
  const tone = runVerdictTone(activity)

  const headline = aiVerdict?.headline ?? v.headline[tone](t.activityTypes[activity.type])
  const body =
    aiVerdict?.body ??
    (activity.rpe !== null ? v.effortClause(t.rpeLabels[activity.rpe] ?? '', activity.rpe) : null)

  return (
    <GlassSurface variant="card" className="p-5 text-center">
      <p className="widget-label text-accent-text">{v.title}</p>
      <h2 className={cn('mt-1 font-display text-lg font-bold leading-snug', TONE_TEXT_CLASS[tone])}>{headline}</h2>
      {body && <p className="mt-1 text-sm leading-snug text-muted-foreground">{body}</p>}
      {coaching && (
        <div className="mt-3 rounded-xl bg-accent/[0.07] p-3 text-left">
          <div className="flex items-center gap-2">
            <span className="widget-label text-accent-text">{t.coaching.evaluation}</span>
            {coaching.decision && (
              <StatusPill tone={coaching.decision.outcome === 'KEEP' ? 'emerald' : 'amber'} className="ml-auto">
                {t.coaching.outcomes[coaching.decision.outcome]}
              </StatusPill>
            )}
          </div>
          <p className="mt-1.5 text-sm leading-snug text-foreground">{coaching.evaluation.summary}</p>
          {coaching.decision && <PlanChanges coaching={coaching} />}
          <Comparison coaching={coaching} />
        </div>
      )}
    </GlassSurface>
  )
}
