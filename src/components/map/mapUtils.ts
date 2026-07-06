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

// Grid cell size in degrees (~20m). Snapping every trace vertex to this grid lets
// runs down the same street collapse onto shared segments despite GPS jitter, so we
// can count how many times each stretch was actually run - the basis of the heatmap.
export const HEAT_GRID = 0.0002;

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
const HEAT_STOPS: [number, string][] = [
  [0, HEAT_ROUTE_COLORS.rare],
  [0.35, HEAT_ROUTE_COLORS.seldom],
  [0.65, HEAT_ROUTE_COLORS.often],
  [1, HEAT_ROUTE_COLORS.frequent],
];

/**
 * MapLibre `interpolate` color expression over `count`, with stops scaled to the
 * actual max frequency so the ramp always spans the data present.
 */
export function heatColorExpression(maxCount: number): unknown[] {
  const span = Math.max(1, maxCount - 1);
  const expr: unknown[] = ["interpolate", ["linear"], ["get", "count"]];
  for (const [t, color] of HEAT_STOPS) {
    expr.push(1 + t * span, color);
  }
  return expr;
}

/** Width grows with frequency and zoom so busy stretches read as thicker arteries. */
export function heatWidthExpression(maxCount: number): unknown[] {
  const span = Math.max(1, maxCount - 1);
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    9,
    ["interpolate", ["linear"], ["get", "count"], 1, 0.8, 1 + span, 2.2],
    14,
    ["interpolate", ["linear"], ["get", "count"], 1, 1.6, 1 + span, 5],
  ];
}

/** Discrete swatches + labels for the on-map legend. */
export function heatLegendSwatches(): string[] {
  return HEAT_STOPS.map(([, color]) => color);
}
