"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import type { FeatureCollection } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { MapShellData } from "@/application/usecases/GetAllRoutes";
import { heatBasemapStyle, maptilerStyle } from "@/lib/maptiler";
import { percentileBounds, type CameraPadding, type LngLatBounds } from "@/lib/routeFrame";
import { firstSymbolLayerId, loadMapLibre } from "@/lib/maplibre";
import { EDGE_FENCE_LAYER, EDGE_FENCE_SOURCE, addEdgeFence } from "@/lib/runMapLayers";
import { heatAccent, hexToRgb, rgbCss, scale } from "@/lib/heatRamp";
import { parseAccent } from "@/lib/accent";
import { HEAT_LAYER, HEAT_SOURCE, addHeatLayer, type HeatLayer } from "./heatLayer";
import { buildHeatTracks, ringCoordinates } from "./mapUtils";
import { MAP_PADDING } from "@/lib/routeFrame";
import { watchMapMoving } from "@/lib/mapMoving";

export function fitPadding(fullscreen: boolean) {
  return fullscreen ? MAP_PADDING.fullscreen : MAP_PADDING.card;
}
const FIT_MAX_ZOOM = 14;
const FIT_MS = 800;

const RING_SOURCE = "home-ring";
/** 4 px dashes 6 px apart: a dash array counts in line widths. */
const RING = { width: 1.2, opacity: 0.8, dash: [4 / 1.2, 6 / 1.2] } as const;
/** The accent itself reads too pale on the light ground. */
const RING_LIGHT_SHADE = 0.55;
const DOT_SOURCE = "home-dot";

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

/**
 * Added after the run layers on every style load and accent change, and
 * removed before them, so a swap redraws them in the same order.
 */
export interface MapOverlay {
  add(map: MapLibreMap, ctx: { dark: boolean }): void;
  remove(map: MapLibreMap): void;
}

export interface MapRoutesOptions {
  /** May change identity; the hook swaps it in place. */
  overlay?: MapOverlay;
  fitOverride?: LngLatBounds | null;
  /** Defaults to the frame's own padding. */
  fitOverridePadding?: CameraPadding;
}

const boundsKey = (b: LngLatBounds | null | undefined) =>
  b ? [b.minLon, b.minLat, b.maxLon, b.maxLat].map((v) => v.toFixed(5)).join() : "";
const paddingKey = (p: CameraPadding | undefined) => (p ? [p.top, p.right, p.bottom, p.left].join() : "");

const isDarkPage = () => document.documentElement.classList.contains("dark");

/** An overlay's failure never takes the heat down with it. */
function drawOverlay(overlay: MapOverlay, map: MapLibreMap): boolean {
  try {
    overlay.add(map, { dark: isDarkPage() });
    return true;
  } catch (err) {
    console.warn("Map overlay failed to draw", err);
    return false;
  }
}

function eraseOverlay(overlay: MapOverlay | null, map: MapLibreMap): void {
  try {
    overlay?.remove(map);
  } catch (err) {
    console.warn("Map overlay failed to clear", err);
  }
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
  { overlay, fitOverride, fitOverridePadding }: MapRoutesOptions = {},
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
  const overlayRef = useRef<MapOverlay | undefined>(overlay);
  const drawnOverlayRef = useRef<MapOverlay | null>(null);
  // False from a theme swap's setStyle until its style.load: no layer can be added meanwhile.
  const styleLoadedRef = useRef(false);
  useLayoutEffect(() => {
    overlayRef.current = overlay;
  }, [overlay]);

  const { clusters } = data;
  const selected = clusters[selectedIdx];

  const frame = useMemo(() => {
    const loaded = visibleIndices.map((i) => routes[i]).filter((coords): coords is [number, number][] => !!coords);
    // Every run of the area shown: the server's frame is the same one, already worked out.
    if (selected && loaded.length === selected.routeIndices.length && visibleIndices.length === selected.routeIndices.length) return selected.frame;
    return (loaded.length ? percentileBounds(loaded) : null) ?? selected?.frame ?? null;
  }, [routes, visibleIndices, selected]);
  const frameKey = boundsKey(frame);
  const fitTarget = fitOverride ?? frame;
  const fitKey = fitOverride ? `override:${boundsKey(fitOverride)}:${paddingKey(fitOverridePadding)}` : frameKey;

  // Kept so a new style or accent can redraw them.
  const tracksRef = useRef<Float64Array[]>([]);
  const ringRef = useRef<HomeRing | null>(ring);

  useEffect(() => {
    if (!containerRef.current || !clusters.length) return;
    let cancelled = false;
    let fenceCleanup: (() => void) | null = null;
    const isDark = isDarkPage;
    // The accent's full colour in both modes, not the darker light-mode UI accent.
    const readAccent = () => heatAccent(parseAccent(document.documentElement.getAttribute("data-accent")));

    function removeRunLayers(map: MapLibreMap) {
      eraseOverlay(drawnOverlayRef.current, map);
      drawnOverlayRef.current = null;
      heatRef.current?.remove();
      heatRef.current = null;
      fenceCleanup?.();
      fenceCleanup = null;
      for (const id of [DOT_SOURCE, RING_SOURCE, HEAT_LAYER, EDGE_FENCE_LAYER]) if (map.getLayer(id)) map.removeLayer(id);
      for (const id of [DOT_SOURCE, RING_SOURCE, HEAT_SOURCE, EDGE_FENCE_SOURCE]) if (map.getSource(id)) map.removeSource(id);
    }

    // A new style wipes the run layers and a new accent repaints them: both
    // call this again with what is on screen.
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
            "circle-radius": 3,
            "circle-color": accent,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        },
        firstSymbolId,
      );

      fenceCleanup = addEdgeFence(map);

      const extra = overlayRef.current;
      if (extra && drawOverlay(extra, map)) drawnOverlayRef.current = extra;
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
        // The licence-required attribution is MapAttribution's line of text:
        // an in-map control too printed "© MapTiler" twice.
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
      // Cheaper glass over the canvas while it moves.
      watchMapMoving(map);

      const swapTheme = () => {
        dark = isDark();
        accent = readAccent();
        styleLoadedRef.current = false;
        removeRunLayers(map);
        map.setStyle(heatBasemapStyle(maptilerStyle(dark, token), dark), { diff: false });
      };

      // iOS draws its app switcher snapshots in both appearances: a flip back
      // while this style loaded went unseen, so the theme is checked again.
      map.on("style.load", () => {
        if (cancelled) return;
        addRunLayers(map);
        styleLoadedRef.current = true;
        setMapReady(true);
        if (isDark() !== dark) swapTheme();
      });

      // Not map.isStyleLoaded(): it stays false while tiles load, long after style.load, and a flip then went unseen.
      const observer = new MutationObserver(() => {
        if (cancelled || !styleLoadedRef.current) return;
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
      drawnOverlayRef.current = null;
      styleLoadedRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // Keyed on `data` alone: the routes and clusters it reads all derive from it.
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

  // During a theme swap, the next style.load draws whichever overlay is
  // current then.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !styleLoadedRef.current) return;
    if (drawnOverlayRef.current === (overlay ?? null)) return;
    eraseOverlay(drawnOverlayRef.current, map);
    drawnOverlayRef.current = null;
    if (overlay && drawOverlay(overlay, map)) drawnOverlayRef.current = overlay;
  }, [overlay, mapReady]);

  // Keyed on the frame's numbers, so a routes array rebuilt unchanged doesn't
  // move the camera.
  const fittedOnce = useRef(false);
  useEffect(() => {
    if (!mapReady) {
      fittedOnce.current = false;
      return;
    }
    if (!mapRef.current || !fitTarget) return;
    // The box may just have gone fullscreen or back.
    mapRef.current.resize();
    mapRef.current.fitBounds(boundsArray(fitTarget), {
      padding: (fitOverride && fitOverridePadding) || fitPadding(fullscreen),
      maxZoom: FIT_MAX_ZOOM,
      duration: fittedOnce.current ? FIT_MS : 0,
    });
    fittedOnce.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, mapReady, fullscreen]);

  const resize = useCallback(() => {
    mapRef.current?.resize();
  }, []);

  return { containerRef, resize, mapRef, mapReady };
}
