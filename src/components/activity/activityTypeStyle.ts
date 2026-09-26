import { Zap, Flame, Wind, TrendingUp, Clock, Footprints, Flag } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { isActivityType, type ActivityType } from '@/domain/activity/types'
import { sessionZone, zoneColor } from '@/lib/colors'

export interface ActivityTypeStyle {
  chartColor: string
  icon: LucideIcon
}

/**
 * A type's colour is its session zone's token (v4.3.2), the one the dots,
 * bars and tiles already wear: this map used to keep its own ramp, which left
 * a fixed green on Base runs that no token owns any more. The icon is the
 * type's own.
 *
 * This lives with the components rather than in the domain: a colour and an
 * icon are how a screen draws a type, not what the type is.
 */
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

/**
 * How to draw a type read off disk. Activity JSON is cast rather than parsed,
 * so a type string the Python classifier starts emitting before this map
 * learns it arrives here unchecked. It draws as Base instead of throwing in
 * every list, calendar and chart that colours by type.
 */
export function activityTypeStyle(type: string | null | undefined): ActivityTypeStyle {
  return isActivityType(type) ? ACTIVITY_TYPE_STYLE[type] : ACTIVITY_TYPE_STYLE.Base
}
