import type { Activity } from '@/domain/activity/types'
import { runVerdictTone } from '@/domain/activity/runVerdict'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { STATUS } from '@/lib/statusColors'
import { formatClock } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const TONE_TEXT_CLASS = {
  positive: STATUS.success.text,
  neutral: 'text-foreground',
  caution: STATUS.warning.text,
} as const

interface Props {
  activity: Activity
  heatAdjustSeconds: number
}

export function RunVerdict({ activity, heatAdjustSeconds }: Props) {
  const v = t.activity.verdict
  const tone = runVerdictTone(activity.rpe, activity.aerTrainingEffect)
  const typeLabel = t.activityTypes[activity.type]
  const inHeat = heatAdjustSeconds > 0

  const headline = v.headline[tone](typeLabel) + (inHeat ? v.heatSuffix : '')

  const bodyParts = [
    inHeat && activity.paceSecPerKm && activity.avgTemperature != null
      ? v.heatClause(formatClock(activity.paceSecPerKm), heatAdjustSeconds, activity.avgTemperature)
      : null,
    activity.rpe !== null ? v.effortClause(t.rpeLabels[activity.rpe] ?? '', activity.rpe) : null,
  ].filter((part): part is string => !!part)

  return (
    <GlassSurface variant="card" className="p-5">
      {activity.avgTemperature != null && (
        <span className="mb-2 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium text-muted-foreground backdrop-blur-md">
          🌡 {activity.avgTemperature}°C
        </span>
      )}
      <p className="widget-label text-muted-foreground">{v.title}</p>
      <h2 className={cn('mt-1 text-lg font-bold leading-snug', TONE_TEXT_CLASS[tone])}>{headline}</h2>
      {bodyParts.length > 0 && (
        <p className="mt-1 text-sm leading-snug text-muted-foreground">{bodyParts.join(' ')}</p>
      )}
    </GlassSurface>
  )
}
