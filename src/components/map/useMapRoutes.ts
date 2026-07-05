"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import type { AllRoutesData } from "@/application/usecases/GetAllRoutes";
import { maptilerStyleUrl } from "@/lib/maptiler";
import { useAccentColor, useAccentColorLight } from "@/lib/useAccent";
import { buildGeoJSON } from "./mapUtils";

export function useMapRoutes(
  data: AllRoutesData,
  selectedIdx: number,
  visibleIndices: number[],
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const isDarkRef = useRef(false);
  const accentColor = useAccentColor();
  const accentColorLight = useAccentColorLight();

  const { routes, clusters } = data;
  const selected = clusters[selectedIdx];

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

        // The light basemap is pale, so the raw accent swatch washes out at low
        // opacity - use the darker, contrast-safe variant there instead.
        const lineColor = isDark ? accentColor : accentColorLight;

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
              "line-color": lineColor,
              // Thinner halo, scaling a touch with zoom, so popular overlapping
              // routes do not stack into a fat bright band.
              "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2.5, 14, 5],
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
              "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1, 14, 1.6],
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

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const lineColor = isDarkRef.current ? accentColor : accentColorLight;
    if (map.getLayer("routes-glow")) map.setPaintProperty("routes-glow", "line-color", lineColor);
    if (map.getLayer("routes-line")) map.setPaintProperty("routes-line", "line-color", lineColor);
  }, [accentColor, accentColorLight, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mapRef.current.getSource("routes") as any)?.setData(buildGeoJSON(routes, visibleIndices));
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

  const resize = useCallback(() => {
    mapRef.current?.resize();
  }, []);

  return { containerRef, resize };
}
