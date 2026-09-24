import { Zap, Flame, Wind, TrendingUp, Clock, Footprints, Flag } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { isActivityType, type ActivityType } from '@/domain/activity/types'
import { HUE } from '@/lib/palette'

export interface ActivityTypeStyle {
  chartColor: string
  icon: LucideIcon
}

/**
 * One ramp, five hue families instead of seven: green for the aerobic base,
 * then amber, orange and red as the effort rises. Violet and fuchsia are off
 * the table on purpose - `violet600` is the literal `--accent-text` of the
 * endurance theme, so a type painted in either would read as the selection
 * accent on that theme (this happened once already: Anaerobic used to be
 * violet600).
 *
 * Tempo is `amber400` rather than a mid yellow - the app's dark, green-tinted
 * background desaturates a plain yellow toward olive/mustard, the least
 * legible step in the ramp.
 *
 * The red family holds the three types EFFORT_ZONE_BY_TYPE puts in Z5, at
 * three depths that stay bright enough to read as "hard" rather than
 * "disabled" against that same dark background: `red600` for Sprint, `red500`
 * for Anaerobic, and `roRed` - the lightest - for VO2Max, which is also the
 * `--zone-5` token itself, so a VO2Max dot and a zone-5 segment agree rather
 * than competing. Declared hardest first, in ACTIVITY_TYPES order, so the
 * object reads top to bottom as the ramp.
 *
 * `green600` is a shade cooler and darker than the accent/selection green
 * (both used to be `green500`, which read a Base dot as a selection
 * marker). Race sits outside the ramp entirely, in blue: it's an event, not
 * an intensity, and amber is already spoken for elsewhere as "nearest race
 * countdown" on the Plan screen - the collision that rule guards against is
 * Race painting itself amber, not Tempo.
 *
 * This lives with the components rather than in the domain: a colour and an
 * icon are how a screen draws a type, not what the type is.
 */
export const ACTIVITY_TYPE_STYLE: Record<ActivityType, ActivityTypeStyle> = {
  Sprint:    { chartColor: HUE.red600,    icon: Zap },
  Anaerobic: { chartColor: HUE.red500,    icon: Flame },
  VO2Max:    { chartColor: HUE.roRed,     icon: Wind },
  Threshold: { chartColor: HUE.orange500, icon: TrendingUp },
  Tempo:     { chartColor: HUE.amber400,  icon: Clock },
  Base:      { chartColor: HUE.green600,  icon: Footprints },
  Race:      { chartColor: HUE.blue300,   icon: Flag },
}

/**
 * How to draw a type read off disk. Activity JSON is cast rather than parsed,
 * so a type string the Python classifier starts emitting before this map
 * learns it arrives here unchecked. It draws as Base instead of throwing in
 * every list, calendar and chart that colours by type.
 */
export function activityTypeStyle(type: string | null | undefined): ActivityTypeStyle {
  return isActivityType(type) ? ACTIVITY_TYPE_STYLE[type] : ACTIVITY_TYPE_STYLE.Base
}
