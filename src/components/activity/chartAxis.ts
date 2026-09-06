/**
 * Distance ticks for an activity chart's x-axis. The step widens with the run so
 * a 5 km and a marathon both land on a handful of round labels rather than one
 * being unreadably dense and the other bare. Shared by every distance-based
 * activity chart so their axes line up when stacked on the detail page.
 */
export function kmTicks(distanceKm: number): number[] {
  const step = distanceKm <= 3 ? 1 : distanceKm <= 20 ? 2 : distanceKm <= 50 ? 5 : 10
  return Array.from({ length: Math.floor(distanceKm / step) + 1 }, (_, i) => i * step)
}
