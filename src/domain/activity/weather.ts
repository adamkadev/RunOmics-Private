export type CompassPoint = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

const COMPASS_POINTS: CompassPoint[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']

export function compassPoint(degrees: number): CompassPoint {
  const normalized = ((degrees % 360) + 360) % 360
  return COMPASS_POINTS[Math.round(normalized / 45) % 8] ?? 'n'
}
