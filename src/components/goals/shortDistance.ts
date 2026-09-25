const SHORT: Record<string, string> = { 'Half-Marathon': 'HM' }

/** A race distance as the goals page labels it where space is tight. */
export function shortDist(distance: string): string {
  return SHORT[distance] ?? distance
}
