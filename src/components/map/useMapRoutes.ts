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
import { loadMapLibre } from "@/lib/maplibre";
import { t } from "@/i18n";

const REVEAL_STEPS = 16;
const REVEAL_STEP_MS = 45;

// Every cluster gets its name now, not just the ones whose bubble happens to
// be wide enough to hold it inline - the small ones used to look unresolved
// next to Metz's labelled circle. The name sits below the circle instead, so
// it fits at any bubble size. One fixed treatment regardless of map theme:
// world zoom always sits on dark tiles.
function mkClusterMarker(count: number, radius: number, name: string, label: string): HTMLDivElement {
  const size = radius * 2;
  const wrapper = document.createElement("div");
  wrapper.setAttribute("role", "button");
  wrapper.setAttribute("tabindex", "0");
  wrapper.setAttribute("aria-label", label);
  wrapper.title = label;
  Object.assign(wrapper.style, {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "3px",
    cursor: "pointer",
  });

  const circle = document.createElement("div");
  Object.assign(circle.style, {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    backgroundColor: "#3b82f6",
    border: "2px solid rgba(255,255,255,.28)",
    boxShadow: MAP_COLORS.markerShadow,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: MAP_COLORS.markerLabel,
    fontWeight: "700",
    fontSize: size > 44 ? "14px" : "12px",
  });
  circle.textContent = String(count);
  wrapper.appendChild(circle);

  if (name) {
    const nameEl = document.createElement("span");
    nameEl.textContent = name;
    Object.assign(nameEl.style, {
      fontSize: "11px",
      fontWeight: "700",
      lineHeight: "1.1",
      color: "#e9eff7",
      textShadow: "0 1px 3px #05090f",
      maxWidth: `${Math.max(size + 24, 64)}px`,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    });
    wrapper.appendChild(nameEl);
  }

  return wrapper;
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
      const mgl = await loadMapLibre();
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
        // The licence-required attribution now lives in its own row below the
        // map (GlobalMapClient), not as an in-map control - drawing both
        // printed "© MapTiler" twice.
        attributionControl: false,
      });
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
    // Building the map tears down and recreates the MapLibre instance, so it
    // keys off `data` alone; the routes, clusters and marker cleanup it reads
    // are all derived from that same `data`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // `selected` is `routes[selectedIdx]`: keying off the index avoids
    // re-flying the camera whenever the routes array is rebuilt unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdx, mapReady, worldView]);

  useEffect(() => {
    const map = mapRef.current;
    const mgl = mglRef.current;
    if (!mapReady || !map || !mgl) return;

    if (map.getLayer("heat-line")) {
      map.setLayoutProperty("heat-line", "visibility", worldView ? "none" : "visible");
    }

    // The bubbles are the labels at world zoom - the basemap's own city names
    // would just print underneath them and on top of each other. Bring the
    // style's own labels back below world zoom.
    const style = map.getStyle() as (StyleSpecification & { layers: { id: string; type: string }[] }) | undefined;
    for (const layer of style?.layers ?? []) {
      if (layer.type === "symbol" && map.getLayer(layer.id)) {
        map.setLayoutProperty(layer.id, "visibility", worldView ? "none" : "visible");
      }
    }

    clearClusterMarkers();
    if (!worldView) return;

    const maxCount = Math.max(1, ...clusterCounts);

    let bounds: InstanceType<typeof mgl.LngLatBounds> | null = null;
    for (const c of clusters) {
      const cb: [[number, number], [number, number]] = [
        [c.bounds.minLon, c.bounds.minLat],
        [c.bounds.maxLon, c.bounds.maxLat],
      ];
      bounds = bounds ? bounds.extend(cb) : new mgl.LngLatBounds(cb[0], cb[1]);
    }
    if (bounds) {
      map.fitBounds(bounds, { padding: 40, maxZoom: 11, duration: 800 });
    }

    // Two bubbles that would overlap on screen merge into one instead of
    // stacking - the merge is recomputed on every pan/zoom because whether
    // two clusters' bubbles overlap depends on the current projection, not a
    // fixed geographic distance. The collision check pads each circle's
    // radius by the name label's footprint (it hangs below the circle, wider
    // than the circle itself), so a label can't visually clash with a
    // neighbouring bubble even when the bare circles wouldn't touch.
    const LABEL_BUFFER = 20;
    function renderMarkers() {
      if (!map) return;
      clearClusterMarkers();

      type Group = { indices: number[]; count: number; center: [number, number]; anchorName: string };
      const candidates: Group[] = clusters
        .map((c, i) => ({ c, i, count: clusterCounts[i] ?? 0 }))
        .filter((g) => g.count > 0)
        .sort((a, b) => b.count - a.count)
        .map(({ c, i, count }) => ({ indices: [i], count, center: c.center, anchorName: clusterNames[i] ?? "" }));

      const placed: (Group & { radius: number; point: { x: number; y: number } })[] = [];
      for (const group of candidates) {
        const point = map.project(group.center);
        const radius = clusterBubbleRadius(group.count, maxCount);
        const overlap = placed.find((p) => {
          const dx = p.point.x - point.x;
          const dy = p.point.y - point.y;
          return Math.hypot(dx, dy) < p.radius + LABEL_BUFFER + radius + LABEL_BUFFER;
        });
        if (overlap) {
          overlap.count += group.count;
          overlap.indices.push(...group.indices);
        } else {
          placed.push({ ...group, radius, point });
        }
      }

      for (const group of placed) {
        const radius = clusterBubbleRadius(group.count, maxCount);
        const extra = group.indices.length - 1;
        const name = extra > 0 ? t.pages.map.areasRemainder(group.anchorName, extra) : group.anchorName;
        const label = `${name} · ${group.count}`.trim();
        const el = mkClusterMarker(group.count, radius, name, label);
        const primaryIdx = group.indices[0]!;
        el.addEventListener("click", () => onSelectClusterRef.current(primaryIdx));
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectClusterRef.current(primaryIdx);
          }
        });

        // The label now hangs below the circle, so the wrapper's own centre
        // is no longer the circle's centre - anchor the marker to the top of
        // the wrapper and pull it up by the circle's radius so the circle
        // itself, not the label-extended box, sits over the cluster's point.
        const marker = new mgl!.Marker({ element: el, anchor: "top", offset: [0, -radius] })
          .setLngLat(group.center)
          .addTo(map);
        clusterMarkersRef.current.push(marker);
      }
    }

    renderMarkers();
    map.on("moveend", renderMarkers);
    return () => {
      map.off("moveend", renderMarkers);
    };
    // clearClusterMarkers is stable for the life of the hook and is called
    // here as teardown, not as an input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldView, mapReady, clusters, clusterCounts, clusterNames]);

  const resize = useCallback(() => {
    mapRef.current?.resize();
  }, []);

  return { containerRef, resize };
}
