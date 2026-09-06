"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker, StyleSpecification } from "maplibre-gl";
import type { MapShellData } from "@/application/usecases/GetAllRoutes";
import { maptilerStyleUrl } from "@/lib/maptiler";
import {
  buildHeatGeoJSON,
  clusterBubbleRadius,
  heatColorExpression,
  heatWidthExpression,
} from "./mapUtils";
import { MAP_COLORS } from "@/lib/colors";

const LABELED_BUBBLE_SIZE = 44;

const REVEAL_STEPS = 16;
const REVEAL_STEP_MS = 45;

function mkClusterMarker(count: number, radius: number, name: string, label: string, isDark: boolean): HTMLDivElement {
  const size = radius * 2;
  const el = document.createElement("div");
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "0");
  el.setAttribute("aria-label", label);
  el.title = label;
  Object.assign(el.style, {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    backgroundColor: "color-mix(in srgb, var(--accent) 80%, transparent)",
    border: `2px solid ${isDark ? MAP_COLORS.markerRingDark : MAP_COLORS.markerRingLight}`,
    boxShadow: MAP_COLORS.markerShadow,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: MAP_COLORS.markerLabel,
    fontWeight: "700",
    fontSize: size > LABELED_BUBBLE_SIZE ? "14px" : "12px",
    cursor: "pointer",
    textAlign: "center",
    lineHeight: "1.1",
  });

  const countEl = document.createElement("span");
  countEl.textContent = String(count);
  el.appendChild(countEl);

  if (size > LABELED_BUBBLE_SIZE && name) {
    const nameEl = document.createElement("span");
    nameEl.textContent = name;
    Object.assign(nameEl.style, {
      fontSize: "9px",
      fontWeight: "500",
      opacity: "0.85",
      maxWidth: `${size - 8}px`,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    });
    el.appendChild(nameEl);
  }

  return el;
}

export function useMapRoutes(
  data: MapShellData,
  routes: [number, number][][],
  selectedIdx: number,
  visibleIndices: number[],
  worldView: boolean,
  clusterCounts: number[],
  clusterNames: string[],
  onSelectCluster: (idx: number) => void,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mglRef = useRef<typeof import("maplibre-gl") | null>(null);
  const clusterMarkersRef = useRef<Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  const onSelectClusterRef = useRef(onSelectCluster);
  useEffect(() => {
    onSelectClusterRef.current = onSelectCluster;
  }, [onSelectCluster]);

  const { clusters } = data;
  const selected = clusters[selectedIdx];

  const clearClusterMarkers = useCallback(() => {
    clusterMarkersRef.current.forEach((m) => m.remove());
    clusterMarkersRef.current = [];
  }, []);

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

      clearClusterMarkers();
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);

      const first = clusters[data.defaultClusterIdx];
      if (!first) return;
      const map = new mgl.Map({
        container: containerRef.current!,
        style: maptilerStyleUrl(isDark, token),
        bounds: [
          [first.bounds.minLon, first.bounds.minLat],
          [first.bounds.maxLon, first.bounds.maxLat],
        ],
        fitBoundsOptions: { padding: 60, maxZoom: 14 },
        attributionControl: false,
      });
      map.addControl(
        new mgl.AttributionControl({ compact: true, customAttribution: "© MapTiler · OSM" }),
        "bottom-left",
      );
      mapRef.current = map;
      mglRef.current = mgl;

      map.on("load", () => {
        if (cancelled) return;

        const style = map.getStyle() as StyleSpecification & {
          layers: { id: string; type: string }[];
        };
        const firstSymbolId = style.layers.find((l) => l.type === "symbol")?.id;

        const { data: heat, maxCount } = buildHeatGeoJSON(routes, first.routeIndices);

        map.addSource("heat", { type: "geojson", data: heat });

        map.addLayer(
          {
            id: "heat-line",
            type: "line",
            source: "heat",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": heatColorExpression(maxCount) as never,
              "line-width": heatWidthExpression(maxCount) as never,
              "line-opacity": 0.85,
            },
          },
          firstSymbolId,
        );

        setMapReady(true);
      });
    }

    initMap(document.documentElement.classList.contains("dark"));

    const observer = new MutationObserver(() => {
      if (!cancelled) initMap(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      cancelled = true;
      observer.disconnect();
      clearClusterMarkers();
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [data]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("heat") as GeoJSONSource | undefined;
    if (!mapReady || !map || !source) return;

    const { data: heat, maxCount } = buildHeatGeoJSON(routes, visibleIndices);
    if (map.getLayer("heat-line")) {
      map.setPaintProperty("heat-line", "line-color", heatColorExpression(maxCount) as never);
      map.setPaintProperty("heat-line", "line-width", heatWidthExpression(maxCount) as never);
    }

    const features = heat.features;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || features.length === 0) {
      source.setData(heat);
      return;
    }

    let step = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function reveal() {
      step += 1;
      const count = Math.ceil((features.length * step) / REVEAL_STEPS);
      source!.setData({ type: "FeatureCollection", features: features.slice(0, count) });
      if (step < REVEAL_STEPS) timeoutId = setTimeout(reveal, REVEAL_STEP_MS);
    }
    reveal();

    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [visibleIndices, mapReady, routes]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selected || worldView) return;
    mapRef.current.fitBounds(
      [
        [selected.bounds.minLon, selected.bounds.minLat],
        [selected.bounds.maxLon, selected.bounds.maxLat],
      ],
      { padding: 60, maxZoom: 14, duration: 800 },
    );
  }, [selectedIdx, mapReady, worldView]);

  useEffect(() => {
    const map = mapRef.current;
    const mgl = mglRef.current;
    if (!mapReady || !map || !mgl) return;

    if (map.getLayer("heat-line")) {
      map.setLayoutProperty("heat-line", "visibility", worldView ? "none" : "visible");
    }

    clearClusterMarkers();

    if (worldView) {
      const isDark = document.documentElement.classList.contains("dark");
      const maxCount = Math.max(1, ...clusterCounts);
      let bounds: InstanceType<typeof mgl.LngLatBounds> | null = null;

      const zOrder = clusters.map((_, i) => i).sort((a, b) => (clusterCounts[a] ?? 0) - (clusterCounts[b] ?? 0));

      for (const i of zOrder) {
        const c = clusters[i];
        const count = clusterCounts[i] ?? 0;
        if (!c || count <= 0) continue;

        const radius = clusterBubbleRadius(count, maxCount);
        const name = clusterNames[i] ?? "";
        const label = `${name} · ${count}`.trim();
        const el = mkClusterMarker(count, radius, name, label, isDark);
        el.addEventListener("click", () => onSelectClusterRef.current(i));
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectClusterRef.current(i);
          }
        });

        const marker = new mgl.Marker({ element: el }).setLngLat(c.center).addTo(map);
        clusterMarkersRef.current.push(marker);

        const cb: [[number, number], [number, number]] = [
          [c.bounds.minLon, c.bounds.minLat],
          [c.bounds.maxLon, c.bounds.maxLat],
        ];
        bounds = bounds ? bounds.extend(cb) : new mgl.LngLatBounds(cb[0], cb[1]);
      }

      if (bounds) {
        map.fitBounds(bounds, { padding: 70, maxZoom: 11, duration: 800 });
      }
    }
  }, [worldView, mapReady, clusters, clusterCounts, clusterNames]);

  const resize = useCallback(() => {
    mapRef.current?.resize();
  }, []);

  return { containerRef, resize };
}
