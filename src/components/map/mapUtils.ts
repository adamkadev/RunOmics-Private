import type { RouteMeta, RouteCluster } from "@/application/usecases/GetAllRoutes";

export function matchesFilters(meta: RouteMeta, year: string | null): boolean {
  return !year || meta.year === year;
}

export function coordLabel(c: RouteCluster): string {
  const lat = `${Math.abs(c.center[1]).toFixed(1)}${c.center[1] >= 0 ? "°N" : "°S"}`;
  const lon = `${Math.abs(c.center[0]).toFixed(1)}${c.center[0] >= 0 ? "°E" : "°W"}`;
  return `${lat} ${lon}`;
}

export function buildGeoJSON(
  routes: [number, number][][],
  indices: number[],
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: indices.map((i) => ({
      type: "Feature" as const,
      id: i,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: routes[i] },
    })),
  };
}
