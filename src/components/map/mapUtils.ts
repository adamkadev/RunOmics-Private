import type { ActivityType } from "@/domain/activity/types";
import type { RouteMeta, RouteCluster } from "@/application/usecases/GetAllRoutes";
import { HEAT_ROUTE_COLORS } from "@/lib/colors";

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

// Per-route lines, keyed by their route index. Used for the transparent hit-test
// layer that powers tap-to-inspect (feature.id maps back to the route/meta).
export function buildGeoJSON(
  routes: [number, number][][],
  indices: number[],
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: indices.flatMap((i) => {
      const coordinates = routes[i];
      if (!coordinates) return [];
      return [{
        type: "Feature" as const,
        id: i,
        properties: {},
        geometry: { type: "LineString" as const, coordinates },
      }];
    }),
  };
}

// Grid cell size in degrees (~30m). Snapping every trace vertex to this grid lets
// runs down the same street collapse onto shared segments despite GPS jitter, so we
// can count how many times each stretch was actually run - the basis of the heatmap.
// Kept wider than raw GPS noise (~5-15m) so repeated passes merge into one high-count
// segment instead of scattering into parallel low-count threads (which would pin the
// whole map at the "rare" end of the ramp).
export const HEAT_GRID = 0.0003;

function snap(v: number): number {
  return Math.round(v / HEAT_GRID) * HEAT_GRID;
}

function nodeKey(lon: number, lat: number): string {
  return `${Math.round(lon / HEAT_GRID)}:${Math.round(lat / HEAT_GRID)}`;
}

/**
 * Aggregate all visible routes into unique grid-snapped segments carrying a `count`
 * of how many times that stretch was run. Overlapping passes merge into one segment,
 * so intensity comes from a real frequency value instead of stacked line opacity.
 */
export function buildHeatGeoJSON(
  routes: [number, number][][],
  indices: number[],
): { data: GeoJSON.FeatureCollection; maxCount: number } {
  const segments = new Map<string, { coords: [number, number][]; count: number }>();

  for (const i of indices) {
    const coords = routes[i];
    if (!coords || coords.length < 2) continue;

    let prevLon = snap(coords[0]![0]);
    let prevLat = snap(coords[0]![1]);
    let prevKey = nodeKey(coords[0]![0], coords[0]![1]);

    for (let p = 1; p < coords.length; p++) {
      const lon = snap(coords[p]![0]);
      const lat = snap(coords[p]![1]);
      const key = nodeKey(coords[p]![0], coords[p]![1]);

      if (key !== prevKey) {
        // Order-independent key so both travel directions share one segment.
        const segKey = prevKey < key ? `${prevKey}|${key}` : `${key}|${prevKey}`;
        const existing = segments.get(segKey);
        if (existing) {
          existing.count += 1;
        } else {
          segments.set(segKey, {
            coords: [[prevLon, prevLat], [lon, lat]],
            count: 1,
          });
        }
        prevLon = lon;
        prevLat = lat;
        prevKey = key;
      }
    }
  }

  let maxCount = 1;
  const features: GeoJSON.Feature[] = [];
  for (const seg of segments.values()) {
    if (seg.count > maxCount) maxCount = seg.count;
    features.push({
      type: "Feature",
      properties: { count: seg.count },
      geometry: { type: "LineString", coordinates: seg.coords },
    });
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
