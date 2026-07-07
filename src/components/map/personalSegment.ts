import type { RouteMeta } from "@/application/usecases/GetAllRoutes";
import {
  buildRouteCellSet,
  isSimilarDistance,
  routeSimilarity,
  SIMILAR_ROUTE_MIN_SIMILARITY,
  type RouteCellSet,
} from "@/lib/routeMatch";

export interface SegmentEntry {
  activityId: string;
  date: string;
  paceSecPerKm: number;
  rank: number;
  isSelected: boolean;
}

export interface PersonalSegment {
  passes: number;
  bestPaceSecPerKm: number;
  // Mean pace of the last 90 days vs the passes before them (negative = getting
  // faster). Null until both windows have at least one pass.
  trendDeltaSecPerKm: number | null;
  // Podium by pace, plus the tapped run when it sits outside it.
  entries: SegmentEntry[];
}

const MIN_PASSES = 3;
const TREND_WINDOW_DAYS = 90;
const PODIUM_SIZE = 3;

// Coordinate arrays are stable references held in the map client's state, so
// cell sets can be memoized per array instead of rebuilt on every tap.
const cellSetCache = new WeakMap<[number, number][], RouteCellSet>();

function cellSetFor(coords: [number, number][]): RouteCellSet {
  let cellSet = cellSetCache.get(coords);
  if (!cellSet) {
    cellSet = buildRouteCellSet(coords);
    cellSetCache.set(coords, cellSet);
  }
  return cellSet;
}

export function buildPersonalSegment(
  targetIdx: number,
  candidateIndices: number[],
  routes: [number, number][][],
  routeMeta: RouteMeta[],
): PersonalSegment | null {
  const targetCoords = routes[targetIdx];
  const targetMeta = routeMeta[targetIdx];
  if (!targetCoords || targetCoords.length < 2 || !targetMeta || targetMeta.paceSecPerKm == null) {
    return null;
  }

  const targetCells = cellSetFor(targetCoords);

  const matched = candidateIndices.filter((i) => {
    if (i === targetIdx) return true;
    const coords = routes[i];
    const meta = routeMeta[i];
    if (!coords || coords.length < 2 || !meta || meta.paceSecPerKm == null) return false;
    if (!isSimilarDistance(meta.distanceKm, targetMeta.distanceKm)) return false;
    return routeSimilarity(cellSetFor(coords), targetCells) >= SIMILAR_ROUTE_MIN_SIMILARITY;
  });

  if (matched.length < MIN_PASSES) return null;

  const byPace = [...matched].sort(
    (a, b) => routeMeta[a]!.paceSecPerKm! - routeMeta[b]!.paceSecPerKm!,
  );

  const cutoff = new Date(Date.now() - TREND_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const recent = matched.filter((i) => routeMeta[i]!.date >= cutoff);
  const older = matched.filter((i) => routeMeta[i]!.date < cutoff);
  const mean = (indices: number[]) =>
    indices.reduce((sum, i) => sum + routeMeta[i]!.paceSecPerKm!, 0) / indices.length;
  const trendDeltaSecPerKm =
    recent.length > 0 && older.length > 0 ? Math.round(mean(recent) - mean(older)) : null;

  const podium = byPace.slice(0, PODIUM_SIZE);
  if (!podium.includes(targetIdx)) podium[podium.length - 1] = targetIdx;

  return {
    passes: matched.length,
    bestPaceSecPerKm: routeMeta[byPace[0]!]!.paceSecPerKm!,
    trendDeltaSecPerKm,
    entries: podium.map((i) => ({
      activityId: routeMeta[i]!.id,
      date: routeMeta[i]!.date,
      paceSecPerKm: routeMeta[i]!.paceSecPerKm!,
      rank: byPace.indexOf(i) + 1,
      isSelected: i === targetIdx,
    })),
  };
}
