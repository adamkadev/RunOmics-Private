import type { ActivityDetailView } from './activityViews'
import { runVerdictTone } from '@/domain/activity/runVerdict'
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
  activity: ActivityDetailView
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
    <div className="px-1">
      <h2 className={cn('font-display text-subhead font-semibold leading-snug', TONE_TEXT_CLASS[tone])}>
        <span className="sr-only">{v.title}</span>
        {headline}
      </h2>
      {body && <p className="mt-0.5 text-caption leading-snug text-muted-foreground">{body}</p>}
    </div>
  )
}
