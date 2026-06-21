"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Filter, X } from "lucide-react";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import type {
  AllRoutesData,
  RouteCluster,
  RouteMeta,
} from "@/application/usecases/GetAllRoutes";
import { ActivityTypeTag } from "@/components/activities/ActivityTypeTag";
import { ACTIVITY_TYPE_CONFIG } from "@/domain/activity/types";
import type { ActivityType } from "@/domain/activity/types";
import { maptilerStyleUrl } from "@/lib/maptiler";
import { useAccentColor } from "@/lib/useAccent";
import { t } from "@/i18n";

const ALL_TYPES = Object.keys(ACTIVITY_TYPE_CONFIG) as ActivityType[];

function matchesFilters(
  meta: RouteMeta,
  types: ActivityType[],
  year: string | null,
): boolean {
  if (types.length && !types.includes(meta.type)) return false;
  if (year && meta.year !== year) return false;
  return true;
}

function coordLabel(c: RouteCluster): string {
  const lat =
    Math.abs(c.center[1]).toFixed(1) + (c.center[1] >= 0 ? "°N" : "°S");
  const lon =
    Math.abs(c.center[0]).toFixed(1) + (c.center[0] >= 0 ? "°E" : "°W");
  return `${lat} ${lon}`;
}

function buildGeoJSON(
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

type GeoFeature = {
  text: string;
  place_type?: string[];
  context?: Array<{ id: string; text: string }>;
};

async function reverseGeocode(
  lon: number,
  lat: number,
  token: string,
): Promise<string | null> {
  const key = `reverse_geocode:${lon.toFixed(4)},${lat.toFixed(4)}`;
  const TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

  try {
    // Try localStorage cache first
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { ts: number; value: string | null };
          if (Date.now() - parsed.ts < TTL_MS) return parsed.value;
        } catch {
          // ignore parse errors and continue to fetch
        }
      }
    }

    const res = await fetch(
      `https://api.maptiler.com/geocoding/${lon.toFixed(4)},${lat.toFixed(4)}.json?key=${token}`,
    );
    if (!res.ok) {
      // Cache negative result briefly to avoid repeated failing requests
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          localStorage.setItem(key, JSON.stringify({ ts: Date.now(), value: null }));
        } catch {}
      }
      return null;
    }

    const json = await res.json();
    const features: GeoFeature[] = json.features ?? [];
    if (!features.length) {
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          localStorage.setItem(key, JSON.stringify({ ts: Date.now(), value: null }));
        } catch {}
      }
      return null;
    }

    let result: string | null = null;
    for (const type of ["municipality", "locality"]) {
      const match = features.find((f) => f.place_type?.includes(type));
      if (match) {
        result = match.text;
        break;
      }
    }

    if (result === null) {
      const ctx = features[0].context ?? [];
      result =
        ctx.find((c) => c.id.startsWith("region."))?.text ??
        ctx.find((c) => c.id.startsWith("county."))?.text ??
        features[0].text ??
        null;
    }

    // Store in cache
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        localStorage.setItem(key, JSON.stringify({ ts: Date.now(), value: result }));
      } catch {
        // ignore quota errors
      }
    }

    return result;
  } catch {
    return null;
  }
}

interface Props {
  data: AllRoutesData;
}

export function GlobalMapClient({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(data.defaultClusterIdx);
  const [names, setNames] = useState<string[]>(() =>
    data.clusters.map(coordLabel),
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<ActivityType[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const accentColor = useAccentColor();

  const { routes, routeMeta, clusters } = data;
  const selected = clusters[selectedIdx];
  const activeFilterCount = selectedTypes.length + (selectedYear ? 1 : 0);

  const clusterStats = useMemo(
    () =>
      clusters.map((c) => {
        const indices = c.routeIndices.filter((i) =>
          matchesFilters(routeMeta[i], selectedTypes, selectedYear),
        );
        return {
          routeCount: indices.length,
          totalKm: Math.round(
            indices.reduce((s, i) => s + routeMeta[i].distanceKm, 0),
          ),
        };
      }),
    [clusters, routeMeta, selectedTypes, selectedYear],
  );

  const visibleIndices = useMemo(
    () =>
      selected
        ? selected.routeIndices.filter((i) =>
            matchesFilters(routeMeta[i], selectedTypes, selectedYear),
          )
        : [],
    [selected, routeMeta, selectedTypes, selectedYear],
  );

  function toggleType(type: ActivityType) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((x) => x !== type) : [...prev, type],
    );
  }

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPTILER_TOKEN;
    if (!token) return;
    let cancelled = false;

    Promise.all(
      clusters.map((c) => reverseGeocode(c.center[0], c.center[1], token)),
    ).then((results) => {
      if (cancelled) return;
      setNames(clusters.map((c, i) => results[i] ?? coordLabel(c)));
    });

    return () => {
      cancelled = true;
    };
  }, [clusters]);

  useEffect(() => {
    if (!containerRef.current || !clusters.length) return;
    let cancelled = false;

    async function initMap(isDark: boolean) {
      const mgl = await import("maplibre-gl");
      await import("maplibre-gl/dist/maplibre-gl.css");
      if (cancelled) return;

      const token = process.env.NEXT_PUBLIC_MAPTILER_TOKEN;
      if (!token) {
        console.warn("NEXT_PUBLIC_MAPTILER_TOKEN not set");
        return;
      }

      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);

      const first = clusters[data.defaultClusterIdx];
      const styleUrl = maptilerStyleUrl(isDark, token);

      const map = new mgl.Map({
        container: containerRef.current!,
        style: styleUrl,
        bounds: [
          [first.bounds.minLon, first.bounds.minLat],
          [first.bounds.maxLon, first.bounds.maxLat],
        ],
        fitBoundsOptions: { padding: 60, maxZoom: 14 },
        attributionControl: false,
      });
      map.addControl(new mgl.AttributionControl({ compact: true }), 'bottom-right');
      mapRef.current = map;

      map.on("load", () => {
        if (cancelled) return;

        const style = map.getStyle() as StyleSpecification & {
          layers: { id: string; type: string }[];
        };
        const firstSymbolId = style.layers.find((l) => l.type === "symbol")?.id;

        map.addSource("routes", {
          type: "geojson",
          data: buildGeoJSON(routes, first.routeIndices),
        });

        map.addLayer(
          {
            id: "routes-glow",
            type: "line",
            source: "routes",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": accentColor,
              // Thinner halo, scaling a touch with zoom, so popular overlapping
              // routes do not stack into a fat bright band.
              "line-width": [
                "interpolate", ["linear"], ["zoom"],
                9, 2.5,
                14, 5,
              ],
              "line-opacity": 0.04,
            },
          },
          firstSymbolId,
        );

        map.addLayer(
          {
            id: "routes-line",
            type: "line",
            source: "routes",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": accentColor,
              "line-width": [
                "interpolate", ["linear"], ["zoom"],
                9, 1,
                14, 1.6,
              ],
              "line-opacity": 0.22,
            },
          },
          firstSymbolId,
        );

        setMapReady(true);
      });
    }

    initMap(document.documentElement.classList.contains("dark"));

    const observer = new MutationObserver(() => {
      if (!cancelled)
        initMap(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      cancelled = true;
      observer.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    if (map.getLayer("routes-glow")) map.setPaintProperty("routes-glow", "line-color", accentColor);
    if (map.getLayer("routes-line")) map.setPaintProperty("routes-line", "line-color", accentColor);
  }, [accentColor, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current)
      return; // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mapRef.current.getSource("routes") as any)?.setData(
      buildGeoJSON(routes, visibleIndices),
    );
  }, [visibleIndices, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selected) return;
    mapRef.current.fitBounds(
      [
        [selected.bounds.minLon, selected.bounds.minLat],
        [selected.bounds.maxLon, selected.bounds.maxLat],
      ],
      { padding: 60, maxZoom: 14, duration: 800 },
    );
  }, [selectedIdx, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Badge - always visible */}
      <button
        onClick={() => setPanelOpen((o) => !o)}
        className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 shadow-card backdrop-blur-sm transition-colors hover:bg-muted"
      >
        <span className="text-xs font-semibold text-accent-text">
          {names[selectedIdx]}
        </span>
        <span className="text-[11px] text-subtle">
          {t.common.runs(clusterStats[selectedIdx]?.routeCount ?? 0)}
        </span>
        <ChevronDown
          size={12}
          className={[
            "text-muted-foreground transition-transform",
            panelOpen ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {/* Full panel */}
      {panelOpen && (
        <div className="absolute left-3 top-12 z-10 w-52 overflow-hidden rounded-xl border border-border bg-card/90 shadow-card backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-xs font-semibold text-foreground/80">{t.pages.map.zones}</p>
            <button onClick={() => setPanelOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X size={12} />
            </button>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {clusters.map((c, i) => (
              <li key={c.id}>
                <button
                  onClick={() => { setSelectedIdx(i); setPanelOpen(false); }}
                  className={[
                    "flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-muted",
                    i === selectedIdx ? "bg-accent/10" : "",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "text-xs font-medium",
                      i === selectedIdx
                        ? "text-accent-text"
                        : "text-foreground",
                    ].join(" ")}
                  >
                    {names[i]}
                  </span>
                  <span className="text-[11px] text-subtle">
                    {t.common.runs(clusterStats[i].routeCount)} · {clusterStats[i].totalKm} {t.units.km}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filters button - top right */}
      <button
        onClick={() => setFiltersOpen((o) => !o)}
        className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 shadow-card backdrop-blur-sm transition-colors hover:bg-muted"
      >
        <Filter size={12} className="text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground/80">
          {t.pages.map.filters}
        </span>
        {activeFilterCount > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Filters panel */}
      {filtersOpen && (
        <div className="absolute right-3 top-12 z-10 w-60 overflow-hidden rounded-xl border border-border bg-card/90 shadow-card backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-xs font-semibold text-foreground/80">{t.pages.map.filters}</p>
            <button onClick={() => setFiltersOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X size={12} />
            </button>
          </div>
          <div className="space-y-3 p-3">
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-subtle">{t.pages.map.type}</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedTypes([])}
                  className={[
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    selectedTypes.length === 0
                      ? "bg-accent-subtle text-accent-text"
                      : "bg-muted text-muted-foreground hover:bg-muted/70",
                  ].join(" ")}
                >
                  {t.activities.all}
                </button>
                {ALL_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className="transition-opacity"
                    style={{ opacity: selectedTypes.length && !selectedTypes.includes(type) ? 0.5 : 1 }}
                  >
                    <ActivityTypeTag type={type} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-medium text-subtle">{t.pages.map.year}</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedYear(null)}
                  className={[
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    selectedYear === null
                      ? "bg-accent-subtle text-accent-text"
                      : "bg-muted text-muted-foreground hover:bg-muted/70",
                  ].join(" ")}
                >
                  {t.pages.map.allYears}
                </button>
                {data.years.map((y) => (
                  <button
                    key={y}
                    onClick={() => setSelectedYear(selectedYear === y ? null : y)}
                    className={[
                      "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                      selectedYear === y
                        ? "bg-accent-subtle text-accent-text"
                        : "bg-muted text-muted-foreground hover:bg-muted/70",
                    ].join(" ")}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
