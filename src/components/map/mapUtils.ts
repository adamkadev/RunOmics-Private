import type { ActivityType } from "@/domain/activity/types";
import type { RouteMeta, RouteCluster } from "@/application/usecases/GetAllRoutes";
import { distanceKm, median, round } from "@/lib/math";
import { t } from "@/i18n";
import { formatDecimal, formatNumber } from "@/lib/formatters";

/** None ticked is "All". */
export interface HeatFilters {
  years: readonly string[];
  types: readonly ActivityType[];
}

export const NO_HEAT_FILTERS: HeatFilters = { years: [], types: [] };

export function matchesFilters(meta: RouteMeta | undefined, filters: HeatFilters): boolean {
  if (!meta) return false;
  if (filters.years.length > 0 && !filters.years.includes(meta.year)) return false;
  if (filters.types.length > 0 && !filters.types.includes(meta.type)) return false;
  return true;
}

export function activeFilterCount(filters: HeatFilters): number {
  return (filters.types.length > 0 ? 1 : 0) + (filters.years.length > 0 ? 1 : 0);
}

export interface AreaTerritory {
  home: [number, number];
  percentVolume: number;
  medianReachKm: number;
  routeCount: number;
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

  const traces = clusterIndices
    .map((i) => routes[i])
    .filter((coords): coords is [number, number][] => !!coords && coords.length > 0);
  if (!traces.length) return null;

  // Where the runs start, not their middle: a centre between two favourite
  // loops can sit in a river.
  const home: [number, number] = [median(traces.map((c) => c[0]![0])), median(traces.map((c) => c[0]![1]))];
  const reaches = traces.map((coords) =>
    coords.reduce((far, [lon, lat]) => Math.max(far, distanceKm(lon, lat, home[0], home[1])), 0)
  );

  return {
    home,
    percentVolume: round((clusterKm / totalKm) * 100, 0),
    medianReachKm: round(median(reaches), 1),
    routeCount: clusterIndices.length,
    km: Math.round(clusterKm),
  };
}

export function reachKm(km: number): number {
  return km <= 1 ? 1 : Math.ceil(km * 10) / 10;
}

export function reachLabel(km: number): string {
  return `${formatNumber(reachKm(km))} ${t.units.km}`;
}

export interface AreaRow {
  idx: number;
  runs: number;
  km: number;
  sharePercent: number;
}

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

/** % of km from which an area gets its own row in the list. */
export const OWN_ROW_SHARE = 10;


export function coordLabel(c: RouteCluster): string {
  const lat = `${formatDecimal(Math.abs(c.center[1]), 1)}${c.center[1] >= 0 ? "°N" : "°S"}`;
  const lon = `${formatDecimal(Math.abs(c.center[0]), 1)}°${c.center[0] >= 0 ? "E" : t.units.west}`;
  return `${lat} ${lon}`;
}

/** Consecutive points further apart than this are a lost fix, not a run. */
export const MAX_GPS_STEP_M = 150;

/** Web Mercator, 0 to 1 across the world: MapLibre's own projection. */
export function mercatorX(lon: number): number {
  return (lon + 180) / 360;
}

export function mercatorY(lat: number): number {
  return (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360;
}

export function buildHeatTracks(routes: [number, number][][], indices: number[]): Float64Array[] {
  const tracks: Float64Array[] = [];
  for (const i of indices) {
    const coords = routes[i];
    if (!coords || coords.length < 2) continue;
    const out: number[] = [];
    for (let p = 0; p < coords.length; p++) {
      const [lon, lat] = coords[p]!;
      const prev = coords[p - 1];
      if (prev && distanceKm(prev[0], prev[1], lon, lat) * 1000 > MAX_GPS_STEP_M) out.push(NaN, NaN);
      out.push(mercatorX(lon), mercatorY(lat));
    }
    tracks.push(Float64Array.from(out));
  }
  return tracks;
}

/**
 * Log scale, so one run and two read apart but fifty and sixty do not; the
 * floor of 2 keeps one run everywhere the faint end.
 */
export function heatFrequency(count: number, maxCount: number): number {
  const t = Math.log1p(count) / Math.log1p(Math.max(2, maxCount));
  return Math.min(1, Math.max(0, t));
}

export const HEAT_DARK = {
  composite: "lighter",
  passes: [
    { width: 4, alpha: 0.025 },
    { width: 1, alpha: 0.07 }, // 1 run ≈ 7 %, 5 runs ≈ 35 %, 14+ saturate
  ],
} as const satisfies { composite: GlobalCompositeOperation; passes: readonly { width: number; alpha: number }[] };

export function heatLineWidth(zoom: number): number {
  const t = Math.min(1, Math.max(0, (zoom - 12) / 4));
  return 1.2 + t * (4 - 1.2);
}

export function ringCoordinates(center: [number, number], radiusKm: number, steps = 96): [number, number][] {
  const [lon, lat] = center;
  const dLat = radiusKm / 111.32;
  const dLon = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const ring = Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return [lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)] as [number, number];
  });
  return [...ring, ring[0]!];
}
