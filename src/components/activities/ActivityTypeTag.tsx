import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import type { ActivityType } from '@/domain/activity/types'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  type: ActivityType
  className?: string
}

export function ActivityTypeTag({ type, className }: Props) {
  const config = ACTIVITY_TYPE_CONFIG[type]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        'border border-white/10 bg-white/5 backdrop-blur-md',
        config.badgeClass,
        className
      )}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: config.dotColor }}
      />
      <span className="leading-none">
        {t.activityTypes[type]}
      </span>
    </span>
  )
}