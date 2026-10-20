"use client";

import type { CanvasSource, Coordinates, Map as MapLibreMap } from "maplibre-gl";
import {
  HEAT_HALO_RINGS,
  HEAT_LEVELS,
  HEAT_STYLE,
  buildHeatLevels,
  heatCore,
  heatHalo,
  heatLevelT,
  heatZoomScale,
  mercatorX,
  mercatorY,
  type HeatStroke,
} from "./mapUtils";
import { rgbCss } from "@/lib/heatRamp";

export const HEAT_SOURCE = "heat";
export const HEAT_LAYER = "heat";

/** A new set of routes fades in over this long. */
const REVEAL_MS = 600;

/** Canvas drawn past each edge, a quarter of the view, so a pan shows tracks before the redraw. */
const MARGIN = 0.25;
/** The canvas is uploaded as a texture on every redraw: at most this many pixels, and 4096 a side. */
const MAX_PIXELS = 8_000_000;
const MAX_SIDE = 4096;
/** MapLibre's zoom 0 is one 512 px tile. */
const TILE_SIZE = 512;

export interface HeatLayer {
  /** Replace the tracks drawn, fading them in unless `reveal` is false. */
  setTracks(tracks: Float64Array[], reveal: boolean): void;
  remove(): void;
}

/**
 * The heat tracks as a canvas the map georeferences (v4.17). Additive and
 * multiplied blending are a 2D canvas's, not a style layer's, so the tracks
 * are stroked onto a canvas over the view and MapLibre draws that canvas as
 * a raster under the place names. Panning and zooming move the raster with
 * the map; when the view settles it is redrawn sharp for the new view.
 *
 * Wave 4 (App Fixes 4d): the tracks are first turned into segments by how
 * often they were run, then each frequency level is drawn as a blurred halo
 * and a sharp core whose colour, opacity and width all rise with it - rare
 * streets thin and pale (dim on dark), the riverside thick and glowing.
 */
export function addHeatLayer(map: MapLibreMap, mode: "dark" | "light", accent: string, beforeId: string | undefined): HeatLayer {
  const composite = HEAT_STYLE[mode].composite;
  const strokes: { halo: HeatStroke | null; core: HeatStroke }[] = Array.from({ length: HEAT_LEVELS }, (_, level) => ({
    halo: heatHalo(mode, accent, heatLevelT(level)),
    core: heatCore(mode, accent, heatLevelT(level)),
  }));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  /** Each frequency level as one NaN-broken path, rarest first. */
  let levels: Float64Array[] = [];
  let view = { x0: 0, y0: 0, world: 1, scale: 1, width: 1, height: 1 };
  let coordinates: Coordinates = [[0, 0], [0, 0], [0, 0], [0, 0]];

  // The view plus its margin, in the map's own Mercator space.
  function layout() {
    const container = map.getContainer();
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const mx = w * MARGIN;
    const my = h * MARGIN;
    const width = w + 2 * mx;
    const height = h + 2 * my;
    const scale = Math.min(
      window.devicePixelRatio || 1,
      Math.sqrt(MAX_PIXELS / (width * height)),
      MAX_SIDE / width,
      MAX_SIDE / height,
    );
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const corner = (x: number, y: number): [number, number] => map.unproject([x, y]).toArray() as [number, number];
    const topLeft = corner(-mx, -my);
    view = {
      x0: mercatorX(topLeft[0]),
      y0: mercatorY(topLeft[1]),
      world: TILE_SIZE * 2 ** map.getZoom(),
      scale,
      width,
      height,
    };
    coordinates = [topLeft, corner(w + mx, -my), corner(w + mx, h + my), corner(-mx, h + my)];
  }

  function trace(path: Float64Array) {
    if (!ctx) return;
    const { x0, y0, world } = view;
    ctx.beginPath();
    let penDown = false;
    for (let p = 0; p < path.length; p += 2) {
      const x = path[p]!;
      if (Number.isNaN(x)) {
        penDown = false;
        continue;
      }
      const px = (x - x0) * world;
      const py = (path[p + 1]! - y0) * world;
      if (penDown) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
      penDown = true;
    }
  }

  function draw() {
    if (!ctx) return;
    ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    ctx.globalCompositeOperation = composite;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const k = heatZoomScale(map.getZoom());
    // Every halo under every core, each pass rarest first so the busy
    // streets land on top. The halo is three soft rings, not a blur filter,
    // so it is the same width in Safari as in Chrome.
    for (let level = 0; level < levels.length; level++) {
      const path = levels[level]!;
      if (!path.length) continue;
      const halo = strokes[level]!.halo;
      if (!halo) continue;
      trace(path);
      for (const ring of HEAT_HALO_RINGS) {
        ctx.lineWidth = halo.width * k * ring;
        ctx.strokeStyle = rgbCss(halo.rgb, halo.alpha / HEAT_HALO_RINGS.length);
        ctx.stroke();
      }
    }
    for (let level = 0; level < levels.length; level++) {
      const path = levels[level]!;
      if (!path.length) continue;
      const core = strokes[level]!.core;
      ctx.lineWidth = core.width * k;
      ctx.strokeStyle = core.color;
      trace(path);
      ctx.stroke();
    }
  }

  function source(): CanvasSource | undefined {
    return map.getSource(HEAT_SOURCE) as CanvasSource | undefined;
  }

  // A paused canvas source keeps the texture it has; playing re-reads the
  // canvas on every frame. So play for two frames after a draw - the new
  // corners take one to settle - then stop, and the map goes back to idle.
  let framesLeft = 0;
  function onRender() {
    if (--framesLeft > 0) return;
    map.off("render", onRender);
    source()?.pause();
  }
  function upload() {
    const src = source();
    if (!src) return;
    src.setCoordinates(coordinates);
    if (framesLeft <= 0) map.on("render", onRender);
    framesLeft = 2;
    src.play();
  }

  function redraw() {
    layout();
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    draw();
    upload();
  }

  layout();
  map.addSource(HEAT_SOURCE, { type: "canvas", canvas, coordinates, animate: false });
  map.addLayer(
    {
      id: HEAT_LAYER,
      type: "raster",
      source: HEAT_SOURCE,
      paint: { "raster-fade-duration": 0, "raster-resampling": "linear" },
    },
    beforeId,
  );
  map.on("moveend", redraw);
  map.on("resize", redraw);

  return {
    setTracks(next, reveal) {
      levels = buildHeatLevels(next);
      if (reveal && map.getLayer(HEAT_LAYER)) {
        // A fade, not a draw-in: the frequencies need every run at once.
        map.setPaintProperty(HEAT_LAYER, "raster-opacity-transition", { duration: 0, delay: 0 });
        map.setPaintProperty(HEAT_LAYER, "raster-opacity", 0);
        redraw();
        requestAnimationFrame(() => {
          if (!map.getLayer(HEAT_LAYER)) return;
          map.setPaintProperty(HEAT_LAYER, "raster-opacity-transition", { duration: REVEAL_MS, delay: 0 });
          map.setPaintProperty(HEAT_LAYER, "raster-opacity", 1);
        });
        return;
      }
      redraw();
    },
    remove() {
      map.off("moveend", redraw);
      map.off("resize", redraw);
      map.off("render", onRender);
    },
  };
}
