import type { ActivityType } from "@/domain/activity/types";
import type { RouteMeta, RouteCluster } from "@/application/usecases/GetAllRoutes";
import { HEAT_ROUTE_COLORS } from "@/lib/colors";
import { routeCellKey } from "@/lib/routeMatch";

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

export function buildHeatGeoJSON(
  routes: [number, number][][],
  indices: number[],
): { data: GeoJSON.FeatureCollection; maxCount: number } {
  const cellCounts = new Map<string, number>();

  for (const i of indices) {
    const coords = routes[i];
    if (!coords || coords.length < 2) continue;
    const seen = new Set<string>();
    for (const [lon, lat] of coords) seen.add(routeCellKey(lon, lat));
    for (const key of seen) cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
  }

  let maxCount = 1;
  for (const c of cellCounts.values()) if (c > maxCount) maxCount = c;

  const features: GeoJSON.Feature[] = [];
  for (const i of indices) {
    const coords = routes[i];
    if (!coords || coords.length < 2) continue;

    let runCoords: [number, number][] = [coords[0]!];
    let runCount = cellCounts.get(routeCellKey(coords[0]![0], coords[0]![1])) ?? 1;

    for (let p = 1; p < coords.length; p++) {
      const point = coords[p]!;
      const count = cellCounts.get(routeCellKey(point[0], point[1])) ?? 1;
      if (count !== runCount) {
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

const HEAT_COLORS = [
  HEAT_ROUTE_COLORS.rare,
  HEAT_ROUTE_COLORS.seldom,
  HEAT_ROUTE_COLORS.often,
  HEAT_ROUTE_COLORS.frequent,
];
const HEAT_FRACTIONS = [0, 0.35, 0.65, 1];

function heatBreakpoints(maxCount: number): number[] {
  const base = Math.max(2, maxCount);
  return HEAT_FRACTIONS.map((frac) => Math.pow(base, frac));
}

export function heatColorExpression(maxCount: number): unknown[] {
  const bp = heatBreakpoints(maxCount);
  const expr: unknown[] = ["interpolate", ["linear"], ["get", "count"]];
  bp.forEach((b, i) => expr.push(b, HEAT_COLORS[i]));
  return expr;
}

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

export function heatLegendSwatches(): string[] {
  return [...HEAT_COLORS];
}

const CLUSTER_BUBBLE_MIN_RADIUS = 14;
const CLUSTER_BUBBLE_MAX_RADIUS = 32;

export function clusterBubbleRadius(count: number, maxCount: number): number {
  if (maxCount <= 0 || count <= 0) return CLUSTER_BUBBLE_MIN_RADIUS;
  const ratio = Math.sqrt(Math.min(count, maxCount) / maxCount);
  return CLUSTER_BUBBLE_MIN_RADIUS + ratio * (CLUSTER_BUBBLE_MAX_RADIUS - CLUSTER_BUBBLE_MIN_RADIUS);
}
