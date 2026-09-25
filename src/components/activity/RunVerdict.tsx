import type { ActivityDetailView } from './activityViews'
import { runVerdictTone } from '@/domain/activity/runVerdict'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { SessionCard } from '@/components/ui/SessionCard'
import { STATUS } from '@/lib/statusColors'
import type { Insight } from '@/lib/gemini'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { ActivityPlanRow } from './activityPlan'

const TONE_TEXT_CLASS = {
  positive: STATUS.success.text,
  neutral: 'text-foreground',
  caution: STATUS.warning.text,
} as const

interface Props {
  activity: ActivityDetailView
  aiVerdict: Insight | null
  /** Planned against ran, when the plan had a session that day. */
  planRow?: ActivityPlanRow | null
}

/**
 * The AI run verdict (or its offline fallback), with the "vs plan" row under
 * it: what the coach makes of the run, and how it compares with the plan, in
 * one card straight after the run's own numbers.
 */
export function RunVerdict({ activity, aiVerdict, planRow }: Props) {
  const v = t.activity.verdict
  const tone = runVerdictTone(activity)

  const headline = aiVerdict?.headline ?? v.headline[tone](t.activityTypes[activity.type])
  const body =
    aiVerdict?.body ??
    (activity.rpe !== null ? v.effortClause(t.rpeLabels[activity.rpe] ?? '', activity.rpe) : null)

  return (
    <GlassSurface variant="card" className="overflow-hidden rounded-card-sm">
      <div className="px-4 pt-3 pb-2.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-caption font-semibold uppercase tracking-[0.06em] text-subtle">{v.title}</h2>
          {aiVerdict && <span className="text-caption text-subtle">{t.sessionCard.coachInsight}</span>}
        </div>
        <p className={cn('mt-1 font-display text-lg font-semibold leading-tight', TONE_TEXT_CLASS[tone])}>{headline}</p>
        {body && <p className="mt-1 text-footnote leading-snug text-muted-foreground">{body}</p>}
      </div>
      {planRow && (
        <SessionCard
          state="done"
          chipLabel={planRow.chipLabel}
          title={planRow.title}
          detail={planRow.detail}
          className="border-t border-border px-4 py-2.5"
        />
      )}
    </GlassSurface>
  )
}
