import type { ActivityType } from "@/domain/activity/types";
import type { RouteMeta, RouteCluster } from "@/application/usecases/GetAllRoutes";
import { distanceKm, median, round } from "@/lib/math";
import { rampDark, rampLight, rgbCss } from "@/lib/heatRamp";
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
 * How busy a route is, 0 to 1 (Wave 4, App Fixes 4d): runs over it on a log
 * scale against the busiest street, so one run and two read apart but fifty
 * and sixty do not. One run everywhere is still the faint end, not the full one.
 */
/**
 * Frequency by rank (Wave 5 B): log/max put almost every street near the
 * top. `t` is a count's mid-rank among every cell in view, scaled so the
 * busiest is 1, then raised to 1.8, so only about the top 15 % go past 0.6.
 */
export const HEAT_RANK_EXPONENT = 1.8;
export function heatRankScale(counts: Iterable<number>): (count: number) => number {
  const sorted = [...counts].sort((a, b) => a - b);
  const n = sorted.length;
  if (!n) return () => 0;
  const rank = new Map<number, number>();
  for (let i = 0; i < n; ) {
    let j = i;
    while (j < n && sorted[j] === sorted[i]) j++;
    rank.set(sorted[i]!, (i + (j - i) / 2) / n);
    i = j;
  }
  const top = rank.get(sorted[n - 1]!)!;
  return (count) => Math.min(1, Math.max(0, ((rank.get(count) ?? 0) / top) ** HEAT_RANK_EXPONENT));
}

export function heatFrequency(count: number, maxCount: number): number {
  const t = Math.log1p(count) / Math.log1p(Math.max(2, maxCount));
  return Math.min(1, Math.max(0, t));
}

/** Frequencies drawn as this many steps: one canvas path each. */
export const HEAT_LEVELS = 16;
/** A street's width, for counting: runs within it share one count. */
export const HEAT_CELL_M = 25;
const EARTH_M = 40_075_016.686;

/** The `t` a level is drawn at. */
export function heatLevelT(level: number): number {
  return level / (HEAT_LEVELS - 1);
}

/** Cell keys as numbers: a column times this, plus a row, stays exact. */
const ROW_SPAN = 4_194_304;

/** Latitude of a Mercator y (0 to 1). */
function mercatorLat(y: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
}

/**
 * The tracks as segments by frequency (Wave 4, App Fixes 4d): each level a
 * single path, NaN-broken, rarest first. Every 25 m cell counts the runs that
 * crossed it; a segment takes the lower count of its two ends, so a side
 * street leaving a busy one stays rare. Each piece of street is drawn once,
 * by the first run over it, so overlapping runs never stack into ink: the
 * frequency, not the overlap, sets the colour.
 */
export function buildHeatLevels(tracks: Float64Array[]): Float64Array[] {
  const levels: number[][] = Array.from({ length: HEAT_LEVELS }, () => []);
  const first = tracks.find((tr) => tr.length >= 2 && !Number.isNaN(tr[1]!));
  if (!first) return levels.map(() => new Float64Array());
  const cell = HEAT_CELL_M / (EARTH_M * Math.cos((mercatorLat(first[1]!) * Math.PI) / 180));
  const key = (x: number, y: number) => Math.floor(x / cell) * ROW_SPAN + Math.floor(y / cell);

  const counts = new Map<number, number>();
  for (const track of tracks) {
    const seen = new Set<number>();
    for (let p = 0; p < track.length; p += 2) {
      const x = track[p]!;
      if (Number.isNaN(x)) continue;
      seen.add(key(x, track[p + 1]!));
    }
    for (const k of seen) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const rankOf = heatRankScale(counts.values());
  const levelOf = (k: number) => Math.round(rankOf(counts.get(k) ?? 1) * (HEAT_LEVELS - 1));

  const cellOwner = new Map<number, number>();
  const edgeOwner = new Map<string, number>();
  tracks.forEach((track, owner) => {
    let open = -1; // the level of the polyline being built, or -1
    for (let p = 2; p < track.length; p += 2) {
      const x0 = track[p - 2]!;
      const x1 = track[p]!;
      if (Number.isNaN(x0) || Number.isNaN(x1)) {
        if (open >= 0) levels[open]!.push(NaN, NaN);
        open = -1;
        continue;
      }
      const y0 = track[p - 1]!;
      const y1 = track[p + 1]!;
      const a = key(x0, y0);
      const b = key(x1, y1);
      let mine: boolean;
      if (a === b) {
        const o = cellOwner.get(a);
        if (o === undefined) cellOwner.set(a, owner);
        mine = o === undefined || o === owner;
      } else {
        const e = a < b ? `${a}_${b}` : `${b}_${a}`;
        const o = edgeOwner.get(e);
        if (o === undefined) edgeOwner.set(e, owner);
        mine = o === undefined || o === owner;
      }
      if (!mine) {
        if (open >= 0) levels[open]!.push(NaN, NaN);
        open = -1;
        continue;
      }
      const level = Math.min(levelOf(a), levelOf(b));
      if (level !== open) {
        if (open >= 0) levels[open]!.push(NaN, NaN);
        levels[level]!.push(x0, y0);
        open = level;
      }
      levels[level]!.push(x1, y1);
    }
    if (open >= 0) levels[open]!.push(NaN, NaN);
  });
  return levels.map((points) => Float64Array.from(points));
}

/** One stroke of a level: its width in px, colour (and its parts), and the halo's blur. */
export interface HeatStroke {
  width: number;
  color: string;
  rgb: readonly [number, number, number];
  alpha: number;
  blur: number;
}

/**
 * The halo's blur as stacked strokes, not a canvas filter (Wave 4): Safari
 * scales `ctx.filter` blur with the canvas transform, so at 3x it drew a
 * halo three times as wide and the city turned to fog. Three concentric
 * strokes - wider than the halo, as a blur spreads, down to inside it - at a third of the
 * opacity each build the same soft falloff in every browser.
 */
export const HEAT_HALO_RINGS = [1.6, 1.15, 0.7] as const;

/**
 * The two layers each level is drawn in (Wave 4, App Fixes 4d): a blurred
 * halo, then a sharp core. Light multiplies, dark screens. The halo in light
 * stays in the tint-to-accent half of the ramp, so it glows and never inks.
 */
export const HEAT_STYLE = {
  light: { composite: "multiply", haloOpacity: [0.12, 0.48] },
  dark: { composite: "screen", haloOpacity: [0.14, 0.61] },
} as const satisfies Record<"dark" | "light", { composite: GlobalCompositeOperation; haloOpacity: readonly [number, number] }>;

/** The halo's blur at the mockup's 354 px map width. */
export const HEAT_HALO_BLUR = 3.2;

/** Under this `t` a street has no halo at all (Wave 5 B): rare streets stay thin lines. */
export const HEAT_HALO_MIN_T = 0.35;

export function heatHalo(mode: "dark" | "light", accent: string, t: number): HeatStroke | null {
  if (t < HEAT_HALO_MIN_T) return null;
  const [base, span] = HEAT_STYLE[mode].haloOpacity;
  const rgb = mode === "light" ? rampLight(accent, t * 0.45) : rampDark(accent, t);
  const alpha = base + span * t;
  // 6 to 13 px over the haloed range only.
  const width = 6 + (7 * (t - HEAT_HALO_MIN_T)) / (1 - HEAT_HALO_MIN_T);
  return { width, color: rgbCss(rgb, alpha), rgb, alpha, blur: HEAT_HALO_BLUR };
}

export function heatCore(mode: "dark" | "light", accent: string, t: number): HeatStroke {
  const rgb = mode === "light" ? rampLight(accent, t) : rampDark(accent, t);
  const alpha = 0.43 + 0.57 * t;
  return { width: 1.2 + 2.1 * t, color: rgbCss(rgb, alpha), rgb, alpha, blur: 0 };
}

/**
 * The strokes' scale with zoom: 1 at the city view the mockup draws (about
 * zoom 12), thicker as the map closes in on a street, thinner out of town.
 */
export function heatZoomScale(zoom: number): number {
  return Math.min(1.6, Math.max(0.6, 2 ** ((zoom - 12.5) / 2)));
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
