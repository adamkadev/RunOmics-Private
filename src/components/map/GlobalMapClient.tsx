"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import type {
  AllRoutesData,
  RouteCluster,
  RouteMeta,
} from "@/application/usecases/GetAllRoutes";
import { maptilerStyleUrl } from "@/lib/maptiler";
import { useAccentColor, useAccentColorLight } from "@/lib/useAccent";
import { t } from "@/i18n";

function matchesFilters(meta: RouteMeta, year: string | null): boolean {
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
  const [yearOpen, setYearOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const yearRef = useRef<HTMLDivElement>(null);
  const accentColor = useAccentColor();
  const accentColorLight = useAccentColorLight();
  const isDarkRef = useRef(false);

  const { routes, routeMeta, clusters } = data;
  const selected = clusters[selectedIdx];

  const clusterStats = useMemo(
    () =>
      clusters.map((c) => {
        const indices = c.routeIndices.filter((i) =>
          matchesFilters(routeMeta[i], selectedYear),
        );
        return {
          routeCount: indices.length,
          totalKm: Math.round(
            indices.reduce((s, i) => s + routeMeta[i].distanceKm, 0),
          ),
        };
      }),
    [clusters, routeMeta, selectedYear],
  );

  const visibleIndices = useMemo(
    () =>
      selected
        ? selected.routeIndices.filter((i) =>
            matchesFilters(routeMeta[i], selectedYear),
          )
        : [],
    [selected, routeMeta, selectedYear],
  );

  useEffect(() => {
    if (!yearOpen) return;
    function onOutside(e: MouseEvent) {
      if (!yearRef.current?.contains(e.target as Node)) setYearOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [yearOpen]);

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
      isDarkRef.current = isDark;
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

        // The light basemap is pale, so the raw accent swatch washes out at low
        // opacity - use the darker, contrast-safe variant there instead.
        const lineColor = isDark ? accentColor : accentColorLight;

        map.addLayer(
          {
            id: "routes-glow",
            type: "line",
            source: "routes",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": lineColor,
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
              "line-color": lineColor,
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
    const lineColor = isDarkRef.current ? accentColor : accentColorLight;
    if (map.getLayer("routes-glow")) map.setPaintProperty("routes-glow", "line-color", lineColor);
    if (map.getLayer("routes-line")) map.setPaintProperty("routes-line", "line-color", lineColor);
  }, [accentColor, accentColorLight, mapReady]);

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
        className="glass-map-chip absolute left-3 top-3 z-10 flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-muted"
      >
        <span className="text-xs font-semibold text-accent-text">
          {names[selectedIdx]}
        </span>
        <span className="text-caption text-subtle">
          {t.common.runs(clusterStats[selectedIdx]?.routeCount ?? 0)}
        </span>
        <ChevronDown
          size={16}
          className={[
            "text-muted-foreground transition-transform",
            panelOpen ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {/* Full panel */}
      {panelOpen && (
        <div className="glass-map-chip absolute left-3 top-12 z-10 w-52 overflow-hidden rounded-[10px]">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-xs font-semibold text-foreground/80">{t.pages.map.zones}</p>
            <button
              onClick={() => setPanelOpen(false)}
              className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {clusters.map((c, i) => (
              <li key={c.id}>
                <button
                  onClick={() => { setSelectedIdx(i); setPanelOpen(false); }}
                  className={[
                    "flex w-full flex-col gap-0.5 px-3 py-3 text-left transition-colors hover:bg-muted",
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
                  <span className="text-caption text-subtle">
                    {t.common.runs(clusterStats[i].routeCount)} · {clusterStats[i].totalKm} {t.units.km}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Year filter - top right */}
      <div ref={yearRef} className="absolute right-3 top-3 z-10">
        <button
          onClick={() => setYearOpen((o) => !o)}
          className="glass-map-chip flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-muted"
        >
          <span className="text-xs font-semibold text-foreground/80">
            {selectedYear ?? t.pages.map.allYears}
          </span>
          <ChevronDown
            size={16}
            className={[
              "text-muted-foreground transition-transform",
              yearOpen ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>

        {yearOpen && (
          <div className="glass-map-chip absolute right-0 top-full z-10 mt-1 w-36 max-h-[calc(100vh-8rem)] overflow-y-auto py-1">
            <button
              onClick={() => { setSelectedYear(null); setYearOpen(false); }}
              className={[
                "flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium transition-colors hover:bg-muted",
                selectedYear === null ? "text-accent-text" : "text-foreground",
              ].join(" ")}
            >
              {t.pages.map.allYears}
              {selectedYear === null && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />
              )}
            </button>
            {data.years.map((y) => (
              <button
                key={y}
                onClick={() => { setSelectedYear(y); setYearOpen(false); }}
                className={[
                  "flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium transition-colors hover:bg-muted",
                  selectedYear === y ? "text-accent-text" : "text-foreground",
                ].join(" ")}
              >
                {y}
                {selectedYear === y && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
