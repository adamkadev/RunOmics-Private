import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import type { ActivityType } from '@/domain/activity/types'
import { cn } from '@/lib/utils'

interface Props {
  type: ActivityType
  className?: string
}

export function ActivityTypeTag({ type, className }: Props) {
  const config = ACTIVITY_TYPE_CONFIG[type]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
        config.badgeClass,
        className
      )}
    >
      {config.label}
    </span>
  )
}
