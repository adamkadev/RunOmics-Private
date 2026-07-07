import type { ActivityType } from "@/domain/activity/types";
import type { RouteMeta, RouteCluster } from "@/application/usecases/GetAllRoutes";
import { HEAT_ROUTE_COLORS } from "@/lib/colors";
import { ROUTE_GRID, routeCellKey } from "@/lib/routeMatch";

export interface HeatFilters {
  year: string | null;
  type: ActivityType | null;
}

export function matchesFilters(meta: RouteMeta | undefined, filters: HeatFilters): boolean {
  if (!meta) return false;
  if (filters.year && meta.year !== filters.year) return false;
  if (filters.type && meta.type !== filters.type) return false;
  return true;
}

export function coordLabel(c: RouteCluster): string {
  const lat = `${Math.abs(c.center[1]).toFixed(1)}${c.center[1] >= 0 ? "°N" : "°S"}`;
  const lon = `${Math.abs(c.center[0]).toFixed(1)}${c.center[0] >= 0 ? "°E" : "°W"}`;
  return `${lat} ${lon}`;
}

// Binning only - never moves a coordinate. Shared with route matching (similar
// runs, personal segments) so "same street" means the same thing everywhere.
export const HEAT_GRID = ROUTE_GRID;
const cellKey = routeCellKey;

/**
 * Aggregate all visible routes into a heat-coloured trace. Frequency is counted per
 * grid cell (how many distinct runs pass through that ~30m area), but the rendered
 * geometry is the ORIGINAL, unsnapped GPS trace - so the line still follows the real
 * road instead of zig-zagging between grid nodes, matching the smooth look of the
 * single-activity map. A route is split into a new feature only where it crosses
 * into a cell with a different count, so color/width follow real density instead of
 * alternating between overlapping "rare" and "frequent" copies of the same street.
 */
export function buildHeatGeoJSON(
  routes: [number, number][][],
  indices: number[],
): { data: GeoJSON.FeatureCollection; maxCount: number } {
  const cellCounts = new Map<string, number>();

  // Pass 1: how many distinct runs touch each cell. Dedup within a route first so a
  // slow, densely-sampled stretch of a single run doesn't inflate its own count.
  for (const i of indices) {
    const coords = routes[i];
    if (!coords || coords.length < 2) continue;
    const seen = new Set<string>();
    for (const [lon, lat] of coords) seen.add(cellKey(lon, lat));
    for (const key of seen) cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
  }

  let maxCount = 1;
  for (const c of cellCounts.values()) if (c > maxCount) maxCount = c;

  // Pass 2: walk each route's real coordinates, tagging runs of vertices that share
  // a cell count into one LineString feature.
  const features: GeoJSON.Feature[] = [];
  for (const i of indices) {
    const coords = routes[i];
    if (!coords || coords.length < 2) continue;

    let runCoords: [number, number][] = [coords[0]!];
    let runCount = cellCounts.get(cellKey(coords[0]![0], coords[0]![1])) ?? 1;

    for (let p = 1; p < coords.length; p++) {
      const point = coords[p]!;
      const count = cellCounts.get(cellKey(point[0], point[1])) ?? 1;
      if (count !== runCount) {
        // Close the old run on this same point (so the two features touch, no gap),
        // then start the new run from it too.
        runCoords.push(point);
        features.push({
          type: "Feature",
          properties: { count: runCount },
          geometry: { type: "LineString", coordinates: runCoords },
        });
        runCoords = [point];
        runCount = count;
      } else {
        runCoords.push(point);
      }
    }
    if (runCoords.length > 1) {
      features.push({
        type: "Feature",
        properties: { count: runCount },
        geometry: { type: "LineString", coordinates: runCoords },
      });
    }
  }

  return { data: { type: "FeatureCollection", features }, maxCount };
}

// Cool -> hot ramp for run frequency, from the shared, accent-independent heat
// palette (defined in lib/colors alongside the pace-route and temperature ramps).
const HEAT_COLORS = [
  HEAT_ROUTE_COLORS.rare,
  HEAT_ROUTE_COLORS.seldom,
  HEAT_ROUTE_COLORS.often,
  HEAT_ROUTE_COLORS.frequent,
];
// Fractions of the (logarithmic) frequency range each colour anchors at.
const HEAT_FRACTIONS = [0, 0.35, 0.65, 1];

/**
 * Count breakpoints for the ramp, spaced *geometrically* (i.e. a log scale) between
 * 1 and the max frequency. Run frequency is heavily right-skewed - a handful of
 * home streets are run 100+ times while most stretches are run once or twice - so a
 * linear scale would leave almost everything pinned at the cool "rare" end. Log
 * spacing spreads the mid colours across the counts that actually occur.
 * Always strictly ascending (base >= 2), so the interpolate expression is valid even
 * with no overlaps.
 */
function heatBreakpoints(maxCount: number): number[] {
  const base = Math.max(2, maxCount);
  return HEAT_FRACTIONS.map((frac) => Math.pow(base, frac));
}

/** MapLibre `interpolate` colour expression over `count`, on the log breakpoints. */
export function heatColorExpression(maxCount: number): unknown[] {
  const bp = heatBreakpoints(maxCount);
  const expr: unknown[] = ["interpolate", ["linear"], ["get", "count"]];
  bp.forEach((b, i) => expr.push(b, HEAT_COLORS[i]));
  return expr;
}

/** Width grows with frequency (log-spaced) and zoom so busy stretches read as thicker arteries. */
export function heatWidthExpression(maxCount: number): unknown[] {
  const bp = heatBreakpoints(maxCount);
  const widthsLow = [0.8, 1.2, 1.8, 2.6];
  const widthsHigh = [1.4, 2.4, 3.8, 5];
  const byCount = (widths: number[]): unknown[] => {
    const expr: unknown[] = ["interpolate", ["linear"], ["get", "count"]];
    bp.forEach((b, i) => expr.push(b, widths[i]));
    return expr;
  };
  return ["interpolate", ["linear"], ["zoom"], 9, byCount(widthsLow), 14, byCount(widthsHigh)];
}

/** Discrete swatches for the on-map legend. */
export function heatLegendSwatches(): string[] {
  return [...HEAT_COLORS];
}

// World-view bubble sizing: humans read bubble charts by AREA, so radius scales with
// sqrt(count) rather than count itself - a zone with 4x the runs should look ~4x the
// "weight", not 4x the diameter. A floor keeps single-route zones big enough to tap.
const CLUSTER_BUBBLE_MIN_RADIUS = 14;
const CLUSTER_BUBBLE_MAX_RADIUS = 32;

export function clusterBubbleRadius(count: number, maxCount: number): number {
  if (maxCount <= 0 || count <= 0) return CLUSTER_BUBBLE_MIN_RADIUS;
  const ratio = Math.sqrt(Math.min(count, maxCount) / maxCount);
  return CLUSTER_BUBBLE_MIN_RADIUS + ratio * (CLUSTER_BUBBLE_MAX_RADIUS - CLUSTER_BUBBLE_MIN_RADIUS);
}
