import type { Activity } from '@/domain/activity/types'
import { runVerdictTone } from '@/domain/activity/runVerdict'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { STATUS } from '@/lib/statusColors'
import type { Insight } from '@/lib/gemini'
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
}

export function RunVerdict({ activity, aiVerdict }: Props) {
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
    </GlassSurface>
  )
}
