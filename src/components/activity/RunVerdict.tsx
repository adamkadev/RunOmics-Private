import type { ActivityDetailView } from './activityViews'
import { runVerdictTone } from '@/domain/activity/runVerdict'
import { GlassSurface } from '@/components/ui/GlassSurface'
import type { ReactNode } from 'react'
import { SessionStateChip } from '@/components/ui/SessionCard'
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
  /** How it felt - effort and the note - under a divider in the same card. */
  children?: ReactNode
}

/**
 * The verdict as its headline only, then the plan, effort and note in the
 * same card (H10, M9). The paragraph and the "Coach insight" label are gone;
 * the headline is the verdict.
 */
export function RunVerdict({ activity, aiVerdict, planRow, children }: Props) {
  const v = t.activity.verdict
  const tone = runVerdictTone(activity)
  const headline = aiVerdict?.headline ?? v.headline[tone](t.activityTypes[activity.type])

  return (
    <GlassSurface variant="card" className="overflow-hidden rounded-card-sm px-4" data-testid="run-verdict">
      <p className={cn('pt-3.5 font-display text-title3 font-bold leading-tight', TONE_TEXT_CLASS[tone])}>{headline}</p>
      {planRow && (
        <div className="flex items-center gap-2.5 pb-3 pt-2.5">
          <SessionStateChip state="done" label={planRow.chipLabel} />
          <span className="min-w-0 text-footnote text-muted-foreground">{planRow.summary}</span>
        </div>
      )}
      {children && <div className={cn('border-t border-border', !planRow && 'mt-3')}>{children}</div>}
    </GlassSurface>
  )
}
