import { Zap, Flame, Wind, TrendingUp, Clock, Footprints, Flag } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { isActivityType, type ActivityType } from '@/domain/activity/types'
import { sessionZone, zoneColor } from '@/lib/colors'

export interface ActivityTypeStyle {
  chartColor: string
  icon: LucideIcon
}

/** This lives with the components rather than in the domain: a colour and an icon are how a screen draws a type, not what it is. */
const ICONS: Record<ActivityType, LucideIcon> = {
  Sprint: Zap,
  Anaerobic: Flame,
  VO2Max: Wind,
  Threshold: TrendingUp,
  Tempo: Clock,
  Base: Footprints,
  Race: Flag,
}

export const ACTIVITY_TYPE_STYLE: Record<ActivityType, ActivityTypeStyle> = Object.fromEntries(
  (Object.keys(ICONS) as ActivityType[]).map((type) => [type, { chartColor: zoneColor(sessionZone({ type })), icon: ICONS[type] }]),
) as Record<ActivityType, ActivityTypeStyle>

/** Activity JSON is cast rather than parsed, so a type the Python classifier emits before this map learns it arrives unchecked. */
export function activityTypeStyle(type: string | null | undefined): ActivityTypeStyle {
  return isActivityType(type) ? ACTIVITY_TYPE_STYLE[type] : ACTIVITY_TYPE_STYLE.Base
}
