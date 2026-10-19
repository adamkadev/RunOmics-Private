import type { ActivityType } from "@/domain/activity/types";
import type { RouteMeta, RouteCluster } from "@/application/usecases/GetAllRoutes";
import { distanceKm, median, round } from "@/lib/math";
import { t } from "@/i18n";
import { formatDecimal, formatNumber } from "@/lib/formatters";

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
export interface AreaTerritory {
  /** Where the area's runs start: the median start point, [lon, lat]. */
  home: [number, number];
  /** The area's share of all km under the filters. */
  percentVolume: number;
  /** Half the runs never go further than this from home. */
  medianReachKm: number;
  routeCount: number;
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

  const traces = clusterIndices
    .map((i) => routes[i])
    .filter((coords): coords is [number, number][] => !!coords && coords.length > 0);
  if (!traces.length) return null;

  // Home is where the runs start, not the middle of where they go (v4.17):
  // a centre between two favourite loops can sit in a river.
  const home: [number, number] = [median(traces.map((c) => c[0]![0])), median(traces.map((c) => c[0]![1]))];
  // A run's reach is the furthest it got from home, so half the runs stay
  // inside the median reach - the ring the map draws.
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

/**
 * The median reach as an upper bound: half the runs stay within it, so it
 * rounds up - 1 for 0.6, 1.3 for 1.21 - and never reads 0. The ring is drawn
 * at this radius, so the map and the sentence state the same distance.
 */
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

// The area, type and year chips are the app's filter chips (v4.17): neutral
// while unset, inverted once set. The area is always set.
/** 44 pt tall, the minimum tap target (design review, Oct 2026: they were 31 pt). */
export const MAP_CHIP_GEOMETRY = "flex h-11 items-center rounded-full text-sm transition-colors";
export const MAP_CHIP_PADDING = "0 14px";
/** An open menu outlines its unset chip in text ink. */
export const MAP_CHIP_OPEN_BORDER = "1px solid var(--foreground)";
export const MAP_CHIP_CARET_INK = "var(--subtle)";

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

/**
 * Each run as one flat list of Mercator x, y pairs, ready to stroke. A GPS
 * jump (v5.6 #5) is a NaN pair: the pen lifts there, so no straight line
 * fans out where the watch lost its fix, and the run stays one stroke - a
 * run that crosses itself never counts twice.
 */
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

export interface HeatPass {
  /** The stroke as a multiple of the line width. */
  width: number;
  color: string;
}

/** `#rrggbb` at an alpha, as the canvas takes it. */
export function rgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * How the tracks are drawn (v4.17): every run stroked twice in the accent - a
 * wide faint glow and a thin core - because the tracks are the athlete's own
 * data. Where runs overlap they build up: added light on dark, multiplied ink
 * on light, so the most run streets burn brightest (dark) or deepest (light)
 * with no count behind them.
 */
export const HEAT_STYLE = {
  dark: {
    composite: "lighter",
    passes: [
      { width: 4, alpha: 0.035 },
      { width: 1, alpha: 0.16 },
    ],
  },
  light: {
    composite: "multiply",
    passes: [
      { width: 3, alpha: 0.05 },
      { width: 1, alpha: 0.2 },
    ],
  },
} as const satisfies Record<"dark" | "light", {
  composite: GlobalCompositeOperation;
  passes: readonly { width: number; alpha: number }[];
}>;

/** The two passes in the accent's colour. */
export function heatPasses(mode: "dark" | "light", accent: string): HeatPass[] {
  return HEAT_STYLE[mode].passes.map((pass) => ({ width: pass.width, color: rgba(accent, pass.alpha) }));
}

/**
 * The core line's width in px at a MapLibre zoom (v4.17): 1.2 px out to
 * zoom 12, 4 px from zoom 16, straight between.
 */
export function heatLineWidth(zoom: number): number {
  const t = Math.min(1, Math.max(0, (zoom - 12) / 4));
  return 1.2 + t * (4 - 1.2);
}

/** The home ring: a closed line `radiusKm` around `center`, [lon, lat]. */
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
