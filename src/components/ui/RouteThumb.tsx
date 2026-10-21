import { ROUTE_THUMB_BOX } from '@/domain/activity/routeThumb'
import { sessionZone, zoneColor } from '@/lib/colors'

interface Props {
  /** The stored path from routeThumbPath; null draws the neutral tile. */
  path: string | null | undefined
  /** The run's type: the stroke is its session zone. */
  type: string | null | undefined
  /** 44-48 in list rows (v4.17), 52-56 elsewhere. */
  size?: 44 | 48 | 52 | 56
}

/** A 400 m track: the neutral tile for a run with no GPS. */
const TRACK = 'M20 16 H36 A12 12 0 0 1 36 40 H20 A12 12 0 0 1 20 16 Z'

/**
 * The run's route, a static polyline in its zone colour on a rounded tile
 * (H06, H09). A treadmill run gets the neutral tile, never a blank.
 */
export function RouteThumb({ path, type, size = 52 }: Props) {
  return (
    <div
      // The inset-tile recipe (Liquid Glass v3, G9): r12 on the page ground.
      className="inset-tile shrink-0 overflow-hidden rounded-[12px]"
      style={{ width: size, height: size }}
      data-testid="route-thumb"
      data-neutral={path ? undefined : 'true'}
      aria-hidden
    >
      <svg width={size} height={size} viewBox={`0 0 ${ROUTE_THUMB_BOX} ${ROUTE_THUMB_BOX}`}>
        {path ? (
          <path d={path} fill="none" stroke={zoneColor(sessionZone({ type }))} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        ) : (
          <path d={TRACK} fill="none" stroke="var(--muted-foreground)" strokeOpacity={0.45} strokeWidth={2} />
        )}
      </svg>
    </div>
  )
}
