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
export interface AreaTerritory extends MapTerritory {
  /** The area's km under the filters: the numerator of percentVolume. */
  km: number;
}

export function computeAreaTerritory(
  cluster: RouteCluster,
  routeMeta: RouteMeta[],
  routes: [number, number][][],
  filters: HeatFilters
): AreaTerritory | null {
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
    km: Math.round(clusterKm),
  };
}

export interface AreaRow {
  idx: number;
  runs: number;
  km: number;
  /** The area's share of all km under the filters - the card's basis too. */
  sharePercent: number;
}

/**
 * Every area with a run under the filters, busiest by km first: the area
 * list that replaced the world view (v4.8). One share basis, km, the same
 * one computeAreaTerritory states.
 */
export function areaRows(clusters: RouteCluster[], routeMeta: RouteMeta[], filters: HeatFilters): AreaRow[] {
  const perArea = clusters.map((c, idx) => {
    const indices = c.routeIndices.filter((i) => matchesFilters(routeMeta[i], filters));
    return { idx, runs: indices.length, km: indices.reduce((s, i) => s + (routeMeta[i]?.distanceKm ?? 0), 0) };
  });
  const totalKm = perArea.reduce((s, a) => s + a.km, 0);
  return perArea
    .filter((a) => a.runs > 0)
    .sort((a, b) => b.km - a.km)
    .map((a) => ({
      idx: a.idx,
      runs: a.runs,
      km: Math.round(a.km),
      sharePercent: totalKm > 0 ? round((a.km / totalKm) * 100, 0) : 0,
    }));
}

/** An area gets its own row in the list from this share of km; the rest fold into one. */
export const OWN_ROW_SHARE = 10;

// The area, type and year chips share one shape (v4.8). The area chip is
// always set, so an accent there would mean nothing: it is neutral with the
// name in text ink. Type and year take the accent only once they are set,
// with an ✕ to clear them.
export const MAP_CHIP_GEOMETRY = "flex h-[38px] items-center rounded-[12px] transition-colors";
export const MAP_CHIP_STYLE = { padding: "0 12px", fontSize: "14px" } as const;
export const MAP_CHIP_NEUTRAL = {
  background: "var(--segmented-track)",
  border: "1px solid var(--border)",
  color: "var(--muted-foreground)",
} as const;
export const MAP_CHIP_AREA = { ...MAP_CHIP_NEUTRAL, color: "var(--foreground)" } as const;
export const MAP_CHIP_ACTIVE = {
  background: "var(--accent)",
  border: "1px solid transparent",
  color: "var(--accent-foreground)",
} as const;
/** An open menu outlines its chip in text ink. */
export const MAP_CHIP_OPEN_BORDER = "1px solid var(--foreground)";
export const MAP_CHIP_COUNT_INK = "var(--muted-foreground)";
export const MAP_CHIP_CARET_INK = "var(--muted-foreground)";

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
