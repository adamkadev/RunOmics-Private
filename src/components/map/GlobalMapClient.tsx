"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import type {
  AllRoutesData,
  RouteCluster,
} from "@/application/usecases/GetAllRoutes";

const STYLE_LIGHT = "streets-v2";
const STYLE_DARK = "backdrop-v4-dark";

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
  try {
    const res = await fetch(
      `https://api.maptiler.com/geocoding/${lon.toFixed(4)},${lat.toFixed(4)}.json?key=${token}`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const features: GeoFeature[] = json.features ?? [];
    if (!features.length) return null;

    for (const type of ["municipality", "locality"]) {
      const match = features.find((f) => f.place_type?.includes(type));
      if (match) return match.text;
    }

    const ctx = features[0].context ?? [];
    return (
      ctx.find((c) => c.id.startsWith("region."))?.text ??
      ctx.find((c) => c.id.startsWith("county."))?.text ??
      features[0].text ??
      null
    );
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

  const { routes, clusters } = data;
  const selected = clusters[selectedIdx];

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
      const styleUrl = `https://api.maptiler.com/maps/${isDark ? STYLE_DARK : STYLE_LIGHT}/style.json?key=${token}`;

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
      map.addControl(new mgl.AttributionControl({ compact: true }));
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
              "line-color": "#10b981",
              "line-width": 10,
              "line-opacity": 0.05,
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
              "line-color": "#10b981",
              "line-width": 2,
              "line-opacity": 0.25,
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
    if (!mapReady || !mapRef.current || !selected)
      return; // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mapRef.current.getSource("routes") as any)?.setData(
      buildGeoJSON(routes, selected.routeIndices),
    );

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

      {/* Badge — always visible */}
      <button
        onClick={() => setPanelOpen((o) => !o)}
        className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 shadow-card backdrop-blur-sm transition-colors hover:bg-muted"
      >
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {names[selectedIdx]}
        </span>
        <span className="text-[11px] text-subtle">
          {selected?.routeCount} run{selected?.routeCount !== 1 ? "s" : ""}
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
            <p className="text-xs font-semibold text-foreground/80">Zones</p>
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
                    i === selectedIdx ? "bg-emerald-500/10" : "",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "text-xs font-medium",
                      i === selectedIdx
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-foreground",
                    ].join(" ")}
                  >
                    {names[i]}
                  </span>
                  <span className="text-[11px] text-subtle">
                    {c.routeCount} run{c.routeCount !== 1 ? "s" : ""} · {c.totalKm} km
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
