"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { MapShellData } from "@/application/usecases/GetAllRoutes";
import { maptilerStyleUrl } from "@/lib/maptiler";
import { buildHeatGeoJSON, heatColorExpression, heatWidthExpression } from "./mapUtils";
import { firstSymbolLayerId, loadMapLibre, styleRunMapLabels } from "@/lib/maplibre";
import { addEdgeFence } from "@/lib/runMapLayers";
import { SURFACES } from "@/lib/themeTokens";

const REVEAL_STEPS = 16;
const REVEAL_STEP_MS = 45;

/** The routes' breathing room inside the map: 24 pt (v4.8), so an area isn't cut at the top. */
export const FIT_PADDING = 24;

export function useMapRoutes(
  data: MapShellData,
  routes: [number, number][][],
  selectedIdx: number,
  visibleIndices: number[],
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const { clusters } = data;
  const selected = clusters[selectedIdx];

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
        fitBoundsOptions: { padding: FIT_PADDING, maxZoom: 14 },
        // The licence-required attribution now lives in its own row below the
        // map (GlobalMapClient), not as an in-map control - drawing both
        // printed "© MapTiler" twice.
        attributionControl: false,
      });
      mapRef.current = map;

      map.on("load", () => {
        if (cancelled) return;

        // The Activity map's label rules (v4.10): towns over the heat lines
        // with a halo, neighbourhoods from zoom 14, nothing cut at the edge.
        const surface = SURFACES[isDark ? "dark" : "light"];
        styleRunMapLabels(map, { halo: surface.card, town: surface.text2, neighbourhood: surface.text3 });
        const firstSymbolId = firstSymbolLayerId(map);

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

        addEdgeFence(map);
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
    // Building the map tears down and recreates the MapLibre instance, so it
    // keys off `data` alone; the routes and clusters it reads are all
    // derived from that same `data`.
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
    if (!mapReady || !mapRef.current || !selected) return;
    mapRef.current.fitBounds(
      [
        [selected.bounds.minLon, selected.bounds.minLat],
        [selected.bounds.maxLon, selected.bounds.maxLat],
      ],
      { padding: FIT_PADDING, maxZoom: 14, duration: 800 },
    );
    // `selected` is `routes[selectedIdx]`: keying off the index avoids
    // re-flying the camera whenever the routes array is rebuilt unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdx, mapReady]);

  const resize = useCallback(() => {
    mapRef.current?.resize();
  }, []);

  return { containerRef, resize };
}
