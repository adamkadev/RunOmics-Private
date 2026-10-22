"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import type { FeatureCollection } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { MapShellData } from "@/application/usecases/GetAllRoutes";
import { heatBasemapStyle, maptilerStyle } from "@/lib/maptiler";
import { percentileBounds, type LngLatBounds } from "@/lib/routeFrame";
import { firstSymbolLayerId, loadMapLibre } from "@/lib/maplibre";
import { EDGE_FENCE_LAYER, EDGE_FENCE_SOURCE, addEdgeFence } from "@/lib/runMapLayers";
import { heatAccent, hexToRgb, rgbCss, scale } from "@/lib/heatRamp";
import { parseAccent } from "@/lib/accent";
import { HEAT_LAYER, HEAT_SOURCE, addHeatLayer, type HeatLayer } from "./heatLayer";
import { buildHeatTracks, ringCoordinates } from "./mapUtils";
import { MAP_PADDING } from "@/lib/routeFrame";
import { watchMapMoving } from "@/lib/mapMoving";

/**
 * The routes' breathing room inside the map: clear of the glass over it, in
 * the map card or in fullscreen (Liquid Glass v3, README §6.12.1).
 */
export function fitPadding(fullscreen: boolean) {
  return fullscreen ? MAP_PADDING.fullscreen : MAP_PADDING.card;
}
const FIT_MAX_ZOOM = 14;
const FIT_MS = 800;

const RING_SOURCE = "home-ring";
/**
 * The home ring, as 3.1.0 drew it in dark: 4 px dashes 6 px apart (a dash
 * array counts line widths), 1.2 px wide, at 0.8. Light takes the same ring
 * in scale(accent, 0.55) - rgb(25,117,92) for mint - which reads on the
 * light ground where the accent itself was too pale.
 */
const RING = { width: 1.2, opacity: 0.8, dash: [4 / 1.2, 6 / 1.2] } as const;
const RING_LIGHT_SHADE = 0.55;
const DOT_SOURCE = "home-dot";

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
  fullscreen = false,
) {
  // Read when the map is made; the fit below follows it.
  const fullscreenRef = useRef(fullscreen);
  useLayoutEffect(() => {
    fullscreenRef.current = fullscreen;
  }, [fullscreen]);
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

  // What the run layers draw, kept so a new style or accent can redraw it.
  const tracksRef = useRef<Float64Array[]>([]);
  const ringRef = useRef<HomeRing | null>(ring);

  useEffect(() => {
    if (!containerRef.current || !clusters.length) return;
    let cancelled = false;
    let fenceCleanup: (() => void) | null = null;
    const isDark = () => document.documentElement.classList.contains("dark");
    // The heat ramps start from the accent's full colour in both modes
    // (App Fixes 4d), not the darker light-mode UI accent.
    const readAccent = () => heatAccent(parseAccent(document.documentElement.getAttribute("data-accent")));

    function removeRunLayers(map: MapLibreMap) {
      heatRef.current?.remove();
      heatRef.current = null;
      fenceCleanup?.();
      fenceCleanup = null;
      for (const id of [DOT_SOURCE, RING_SOURCE, HEAT_LAYER, EDGE_FENCE_LAYER]) if (map.getLayer(id)) map.removeLayer(id);
      for (const id of [DOT_SOURCE, RING_SOURCE, HEAT_SOURCE, EDGE_FENCE_SOURCE]) if (map.getSource(id)) map.removeSource(id);
    }

    // The heat, the home ring and its dot, under the place names, in the
    // accent: the athlete's own data. A new style wipes them, and a new
    // accent repaints them, so both call this again with what is on screen.
    function addRunLayers(map: MapLibreMap) {
      removeRunLayers(map);
      const accent = readAccent();
      const firstSymbolId = firstSymbolLayerId(map);

      heatRef.current = addHeatLayer(map, isDark() ? "dark" : "light", accent, firstSymbolId);
      heatRef.current.setTracks(tracksRef.current, false);

      const { ring: ringLine, dot } = ringData(ringRef.current);
      map.addSource(RING_SOURCE, { type: "geojson", data: ringLine });
      map.addLayer(
        {
          id: RING_SOURCE,
          type: "line",
          source: RING_SOURCE,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": isDark() ? accent : rgbCss(scale(hexToRgb(accent), RING_LIGHT_SHADE)),
            "line-width": RING.width,
            "line-opacity": RING.opacity,
            "line-dasharray": [...RING.dash],
          },
        },
        firstSymbolId,
      );
      map.addSource(DOT_SOURCE, { type: "geojson", data: dot });
      map.addLayer(
        {
          id: DOT_SOURCE,
          type: "circle",
          source: DOT_SOURCE,
          paint: {
            // Home: the accent in a 2 px white ring, 10 px across, as 3.1.0 drew it.
            "circle-radius": 3,
            "circle-color": accent,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        },
        firstSymbolId,
      );

      fenceCleanup = addEdgeFence(map);
    }

    async function initMap() {
      const mgl = await loadMapLibre();
      if (cancelled) return;

      const token = process.env.NEXT_PUBLIC_MAPTILER_TOKEN;
      if (!token) {
        console.warn("NEXT_PUBLIC_MAPTILER_TOKEN not set");
        return;
      }

      const first = clusters[data.defaultClusterIdx];
      if (!first) return;
      let dark = isDark();
      let accent = readAccent();
      const map = new mgl.Map({
        container: containerRef.current!,
        style: heatBasemapStyle(maptilerStyle(dark, token), dark),
        bounds: boundsArray(first.frame),
        fitBoundsOptions: { padding: fitPadding(fullscreenRef.current), maxZoom: FIT_MAX_ZOOM },
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
      // Cheaper glass over the canvas while it moves (README §6.12.2).
      watchMapMoving(map);

      // A theme swaps the whole style in place.
      const swapTheme = () => {
        dark = isDark();
        accent = readAccent();
        removeRunLayers(map);
        map.setStyle(heatBasemapStyle(maptilerStyle(dark, token), dark), { diff: false });
      };

      // The first style and every one after it (v4.17): the camera stays,
      // the run layers come back. Then the theme again (round 2): leaving
      // the app, iOS draws its switcher snapshots in both appearances, and a
      // flip back that came while this style loaded went unseen, leaving a
      // light map on a dark page.
      map.on("style.load", () => {
        if (cancelled) return;
        addRunLayers(map);
        setMapReady(true);
        if (isDark() !== dark) swapTheme();
      });

      // A theme swaps the whole style in place; an accent only repaints the
      // run layers.
      const observer = new MutationObserver(() => {
        if (cancelled || !map.isStyleLoaded()) return;
        if (isDark() !== dark) {
          swapTheme();
        } else if (readAccent() !== accent) {
          accent = readAccent();
          addRunLayers(map);
        }
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-accent"] });
      stopObserving = () => observer.disconnect();
    }

    let stopObserving: (() => void) | null = null;
    initMap();

    return () => {
      cancelled = true;
      stopObserving?.();
      heatRef.current?.remove();
      heatRef.current = null;
      fenceCleanup?.();
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // Building the map creates the MapLibre instance, so it keys off `data`
    // alone; the routes and clusters it reads are all derived from that
    // same `data`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    tracksRef.current = buildHeatTracks(routes, visibleIndices);
    if (!mapReady) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heatRef.current?.setTracks(tracksRef.current, !reduceMotion);
  }, [visibleIndices, mapReady, routes]);

  useEffect(() => {
    ringRef.current = ring;
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
    // Sized to the box it is in now (fullscreen or not) before it fits.
    mapRef.current.resize();
    mapRef.current.fitBounds(boundsArray(frame), {
      padding: fitPadding(fullscreen),
      maxZoom: FIT_MAX_ZOOM,
      duration: fittedOnce.current ? FIT_MS : 0,
    });
    fittedOnce.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey, mapReady, fullscreen]);

  const resize = useCallback(() => {
    mapRef.current?.resize();
  }, []);

  return { containerRef, resize };
}
