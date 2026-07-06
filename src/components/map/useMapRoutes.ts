"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, MapGeoJSONFeature, StyleSpecification } from "maplibre-gl";
import type { AllRoutesData } from "@/application/usecases/GetAllRoutes";
import { maptilerStyleUrl } from "@/lib/maptiler";
import { HEAT_SELECTED_COLOR } from "@/lib/colors";
import {
  buildGeoJSON,
  buildHeatGeoJSON,
  heatColorExpression,
  heatWidthExpression,
} from "./mapUtils";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function useMapRoutes(
  data: AllRoutesData,
  selectedIdx: number,
  visibleIndices: number[],
  selectedRouteIdx: number | null,
  onSelectRoute: (idx: number | null) => void,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Keep the newest select handler reachable from map events without re-init.
  const onSelectRef = useRef(onSelectRoute);
  useEffect(() => {
    onSelectRef.current = onSelectRoute;
  }, [onSelectRoute]);

  const { routes, clusters } = data;
  const selected = clusters[selectedIdx];

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
      map.addControl(new mgl.AttributionControl({ compact: true }), "bottom-right");
      mapRef.current = map;

      map.on("load", () => {
        if (cancelled) return;

        const style = map.getStyle() as StyleSpecification & {
          layers: { id: string; type: string }[];
        };
        const firstSymbolId = style.layers.find((l) => l.type === "symbol")?.id;

        const { data: heat, maxCount } = buildHeatGeoJSON(routes, first.routeIndices);

        map.addSource("heat", { type: "geojson", data: heat });
        map.addSource("selected", { type: "geojson", data: EMPTY });
        map.addSource("hit", {
          type: "geojson",
          data: buildGeoJSON(routes, first.routeIndices),
        });

        // Intensity layer: color + width driven by how often each stretch was run.
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

        // Bright highlight for a tapped run, drawn above the heat but under labels.
        map.addLayer(
          {
            id: "selected-line",
            type: "line",
            source: "selected",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": HEAT_SELECTED_COLOR,
              "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2.5, 14, 4],
              "line-opacity": 1,
            },
          },
          firstSymbolId,
        );

        // Fully transparent, wide per-route layer on top purely for tap/hover
        // hit-testing. Must be opacity 0 (not a low non-zero value): this layer is
        // NOT frequency-merged, so on heavily overlapped stretches even 0.01 alpha
        // stacks into an opaque black smear that buries the heat colours.
        // queryRenderedFeatures still returns features from a 0-opacity layer.
        map.addLayer({
          id: "hit-line",
          type: "line",
          source: "hit",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#000000", "line-width": 16, "line-opacity": 0 },
        });

        map.on("mouseenter", "hit-line", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "hit-line", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("click", (e) => {
          const hits = map.queryRenderedFeatures(e.point, { layers: ["hit-line"] });
          const feat = hits[0] as MapGeoJSONFeature | undefined;
          onSelectRef.current(feat?.id != null ? Number(feat.id) : null);
        });

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
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rebuild heat + hit geometry (and rescale the ramp) whenever the filters change.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const { data: heat, maxCount } = buildHeatGeoJSON(routes, visibleIndices);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (map.getSource("heat") as any)?.setData(heat);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (map.getSource("hit") as any)?.setData(buildGeoJSON(routes, visibleIndices));
    if (map.getLayer("heat-line")) {
      map.setPaintProperty("heat-line", "line-color", heatColorExpression(maxCount) as never);
      map.setPaintProperty("heat-line", "line-width", heatWidthExpression(maxCount) as never);
    }
  }, [visibleIndices, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Highlight the currently inspected run.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const geo =
      selectedRouteIdx != null ? buildGeoJSON(routes, [selectedRouteIdx]) : EMPTY;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (map.getSource("selected") as any)?.setData(geo);
  }, [selectedRouteIdx, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const resize = useCallback(() => {
    mapRef.current?.resize();
  }, []);

  return { containerRef, resize };
}
