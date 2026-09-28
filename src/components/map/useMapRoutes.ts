"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { MapShellData } from "@/application/usecases/GetAllRoutes";
import { maptilerStyleUrl } from "@/lib/maptiler";
import { percentileBounds, type LngLatBounds } from "@/lib/routeFrame";
import { firstSymbolLayerId, isPlaceLabelLayer, loadMapLibre, styleRunMapLabels } from "@/lib/maplibre";
import { addEdgeFence } from "@/lib/runMapLayers";
import { SURFACES } from "@/lib/themeTokens";
import { addHeatLayer, type HeatLayer } from "./heatLayer";
import { HEAT_STYLE, buildHeatTracks, ringCoordinates } from "./mapUtils";

/** The routes' breathing room inside the map (v4.17). */
export const FIT_PADDING = 36;
const FIT_MAX_ZOOM = 14;
const FIT_MS = 800;

const RING_SOURCE = "home-ring";
const DOT_SOURCE = "home-dot";
const DIM_LAYER = "heat-dim";

/** The ring around home: what the card's sentence names. */
export interface HomeRing {
  center: [number, number];
  radiusKm: number;
}

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

function ringData(ring: HomeRing | null): { ring: FeatureCollection; dot: FeatureCollection } {
  if (!ring) return { ring: EMPTY, dot: EMPTY };
  return {
    ring: {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: ringCoordinates(ring.center, ring.radiusKm) } }],
    },
    dot: {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: ring.center } }],
    },
  };
}

const boundsArray = (b: LngLatBounds): [[number, number], [number, number]] => [
  [b.minLon, b.minLat],
  [b.maxLon, b.maxLat],
];

export function useMapRoutes(
  data: MapShellData,
  routes: [number, number][][],
  selectedIdx: number,
  visibleIndices: number[],
  ring: HomeRing | null,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const heatRef = useRef<HeatLayer | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const { clusters } = data;
  const selected = clusters[selectedIdx];

  // The view follows the runs on the map: the area's own frame until its
  // routes arrive, then the frame of the ones the filters keep - the same
  // box, until a filter narrows it.
  const frame = useMemo(() => {
    const loaded = visibleIndices.map((i) => routes[i]).filter((coords): coords is [number, number][] => !!coords);
    return (loaded.length ? percentileBounds(loaded) : null) ?? selected?.frame ?? null;
  }, [routes, visibleIndices, selected]);
  const frameKey = frame ? [frame.minLon, frame.minLat, frame.maxLon, frame.maxLat].map((v) => v.toFixed(5)).join() : "";

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

      heatRef.current?.remove();
      heatRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);

      const first = clusters[data.defaultClusterIdx];
      if (!first) return;
      const mode = isDark ? "dark" : "light";
      const map = new mgl.Map({
        container: containerRef.current!,
        style: maptilerStyleUrl(isDark, token),
        bounds: boundsArray(first.frame),
        fitBoundsOptions: { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM },
        // The licence-required attribution is the map's own line of text
        // (GlobalMapClient), not an in-map control - drawing both printed
        // "© MapTiler" twice.
        attributionControl: false,
        // North stays up: the heat canvas is drawn for a flat, unrotated view.
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        maxPitch: 0,
      });
      map.touchZoomRotate.disableRotation();
      map.keyboard.disableRotation();
      mapRef.current = map;

      map.on("load", () => {
        if (cancelled) return;
        const surface = SURFACES[mode];
        const heat = HEAT_STYLE[mode];
        const accent = getComputedStyle(containerRef.current ?? document.documentElement).getPropertyValue("--accent").trim() || surface.text;

        // The Activity map's label rules (v4.10) - towns over the tracks with
        // a halo, nothing cut at the edge - quieter here (v4.17).
        styleRunMapLabels(map, { halo: surface.card, town: surface.text2, neighbourhood: surface.text3 });
        for (const layer of map.getStyle().layers) {
          if (isPlaceLabelLayer(layer as { id: string; type: string })) map.setPaintProperty(layer.id, "text-opacity", heat.labelOpacity);
        }
        const firstSymbolId = firstSymbolLayerId(map);

        // The basemap a step back: the page ground laid thinly over it.
        if (heat.baseDim > 0) {
          map.addLayer(
            { id: DIM_LAYER, type: "background", paint: { "background-color": surface.background, "background-opacity": heat.baseDim } },
            firstSymbolId,
          );
        }

        heatRef.current = addHeatLayer(map, mode, firstSymbolId);

        map.addSource(RING_SOURCE, { type: "geojson", data: EMPTY });
        map.addLayer(
          {
            id: RING_SOURCE,
            type: "line",
            source: RING_SOURCE,
            layout: { "line-join": "round", "line-cap": "round" },
            // 4 px dashes, 6 px apart: the dash array counts line widths.
            paint: { "line-color": accent, "line-width": 1.2, "line-opacity": 0.75, "line-dasharray": [4 / 1.2, 6 / 1.2] },
          },
          firstSymbolId,
        );
        map.addSource(DOT_SOURCE, { type: "geojson", data: EMPTY });
        map.addLayer(
          {
            id: DOT_SOURCE,
            type: "circle",
            source: DOT_SOURCE,
            paint: {
              "circle-radius": 3,
              "circle-color": heat.dot ?? accent,
              "circle-stroke-width": 2,
              "circle-stroke-color": heat.dotEdge,
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
      heatRef.current?.remove();
      heatRef.current = null;
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
    if (!mapReady) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heatRef.current?.setTracks(buildHeatTracks(routes, visibleIndices), !reduceMotion);
  }, [visibleIndices, mapReady, routes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const { ring: ringLine, dot } = ringData(ring);
    (map.getSource(RING_SOURCE) as GeoJSONSource | undefined)?.setData(ringLine);
    (map.getSource(DOT_SOURCE) as GeoJSONSource | undefined)?.setData(dot);
  }, [ring, mapReady]);

  // The first fit on a new map lands at once; later ones - another area, a
  // filter - fly there. Keyed on the frame's numbers, so a routes array
  // rebuilt unchanged doesn't move the camera.
  const fittedOnce = useRef(false);
  useEffect(() => {
    if (!mapReady) {
      fittedOnce.current = false;
      return;
    }
    if (!mapRef.current || !frame) return;
    mapRef.current.fitBounds(boundsArray(frame), {
      padding: FIT_PADDING,
      maxZoom: FIT_MAX_ZOOM,
      duration: fittedOnce.current ? FIT_MS : 0,
    });
    fittedOnce.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey, mapReady]);

  const resize = useCallback(() => {
    mapRef.current?.resize();
  }, []);

  return { containerRef, resize };
}
