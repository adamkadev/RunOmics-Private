import type { Feature, FeatureCollection } from "geojson";
import type { ActivityType } from "@/domain/activity/types";
import type { RouteMeta, RouteCluster } from "@/application/usecases/GetAllRoutes";
import type { MapTerritory } from "@/application/usecases/GetMapTerritory";
import { HEAT_ROUTE_COLORS } from "@/lib/colors";
import { routeCellKey } from "@/lib/routeMatch";
import { distanceKm, median, round } from "@/lib/math";

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

// The territory card follows whichever area is on the map, not a fixed
// all-time home base - so it recomputes from the same filtered route set the
// heatmap itself is drawing, scoped to the one cluster in view.
export function computeAreaTerritory(
  cluster: RouteCluster,
  routeMeta: RouteMeta[],
  routes: [number, number][][],
  filters: HeatFilters
): MapTerritory | null {
  const clusterIndices = cluster.routeIndices.filter((i) => matchesFilters(routeMeta[i], filters));
  if (clusterIndices.length === 0) return null;

  const clusterKm = clusterIndices.reduce((sum, i) => sum + (routeMeta[i]?.distanceKm ?? 0), 0);
  const totalKm = routeMeta.reduce((sum, m) => sum + (matchesFilters(m, filters) ? m.distanceKm : 0), 0);
  if (totalKm <= 0) return null;

  const radii = clusterIndices
    .map((i) => routes[i])
    .filter((coords): coords is [number, number][] => !!coords && coords.length > 0)
    .map((coords) => {
      const lons = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      const cLon = (Math.min(...lons) + Math.max(...lons)) / 2;
      const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      return distanceKm(cLon, cLat, cluster.center[0], cluster.center[1]);
    });
  if (!radii.length) return null;

  return {
    center: cluster.center,
    percentVolume: round((clusterKm / totalKm) * 100, 0),
    medianRadiusKm: round(median(radii), 1),
    routeCount: clusterIndices.length,
  };
}

export interface WorldTerritory {
  routeCount: number;
  areaCount: number;
  topAreaName: string;
  topSharePercent: number;
}

// At world zoom there is no single selected area, so the card states a fact
// true of the whole filtered set instead - the top area's share stands in for
// "median radius", which has no meaning once the map isn't centred on a place.
export function computeWorldTerritory(
  clusters: RouteCluster[],
  names: string[],
  routeMeta: RouteMeta[],
  filters: HeatFilters
): WorldTerritory | null {
  const perCluster = clusters.map((c, i) => ({
    name: names[i] ?? coordLabel(c),
    count: c.routeIndices.filter((idx) => matchesFilters(routeMeta[idx], filters)).length,
  }));
  const routeCount = perCluster.reduce((sum, c) => sum + c.count, 0);
  if (routeCount === 0) return null;

  const areaCount = perCluster.filter((c) => c.count > 0).length;
  const top = perCluster.reduce((a, b) => (b.count > a.count ? b : a));

  return {
    routeCount,
    areaCount,
    topAreaName: top.name,
    topSharePercent: round((top.count / routeCount) * 100, 0),
  };
}

// The area, type and year chips are one component in three states: the area
// is always "active" (some area is always selected), type/year start neutral
// and switch to the same active treatment once the athlete picks a value -
// never a lighter, bare-text style for the filter that's actually doing
// something.
export const MAP_CHIP_GEOMETRY = "flex h-[38px] items-center rounded-[12px] transition-colors";
export const MAP_CHIP_STYLE = { padding: "0 11px", fontSize: "13.5px" } as const;
// A filter chip is the segmented control's language: the track when idle,
// a solid accent fill when set (v4.3), in theme tokens.
export const MAP_CHIP_NEUTRAL = {
  background: "var(--segmented-track)",
  border: "1px solid var(--border)",
  color: "var(--muted-foreground)",
} as const;
export const MAP_CHIP_ACTIVE = {
  background: "var(--accent)",
  border: "1px solid transparent",
  color: "var(--accent-foreground)",
} as const;
export const MAP_CHIP_COUNT_INK = "var(--subtle)";
export const MAP_CHIP_CARET_INK = "var(--subtle)";

export function coordLabel(c: RouteCluster): string {
  const lat = `${Math.abs(c.center[1]).toFixed(1)}${c.center[1] >= 0 ? "°N" : "°S"}`;
  const lon = `${Math.abs(c.center[0]).toFixed(1)}${c.center[0] >= 0 ? "°E" : "°W"}`;
  return `${lat} ${lon}`;
}

export function buildHeatGeoJSON(
  routes: [number, number][][],
  indices: number[],
): { data: FeatureCollection; maxCount: number } {
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

  const features: Feature[] = [];
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
