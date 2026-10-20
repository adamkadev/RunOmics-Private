"use client";

import type { CanvasSource, Coordinates, Map as MapLibreMap } from "maplibre-gl";
import {
  HEAT_HALO_RINGS,
  HEAT_LEVELS,
  HEAT_DARK,
  HEAT_STYLE,
  buildHeatLevels,
  heatCore,
  heatHalo,
  heatLevelT,
  heatLineWidth,
  heatZoomScale,
  mercatorX,
  mercatorY,
  type HeatStroke,
} from "./mapUtils";
import { hexToRgb, rgbCss } from "@/lib/heatRamp";

/** Dark B's glow, at most (owner A/B test). */
const HEAT_B_GLOW_MAX = 0.35;
/** Dark C's glow, at most: A's blend, but overlaps can't add up to white. */
const HEAT_C_GLOW_MAX = 0.4;
/** Dark C's core at the busiest street, at most. */
const HEAT_C_CORE_MAX_PX = 2.4;
const GROUND_DARK = "#0b0c0c";

/**
 * Dark C's core colour by frequency: mix(accent, ground, 0.6) at t = 0, the
 * accent at t = 0.7, mix(accent, white, 0.35) at t = 1 - never pure white.
 */
function heatCoreC(accent: string, t: number): string {
  const A = hexToRgb(accent);
  const dim = hexToRgb(GROUND_DARK).map((g, i) => A[i]! + (g - A[i]!) * 0.6);
  const light = A.map((a) => a + (255 - a) * 0.35);
  const mix = (a: readonly number[], b: readonly number[], k: number) => a.map((v, i) => v + (b[i]! - v) * k) as [number, number, number];
  return rgbCss(t <= 0.7 ? mix(dim, A, t / 0.7) : mix(A, light, (t - 0.7) / 0.3));
}

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
export function addHeatLayer(map: MapLibreMap, mode: "dark" | "light", accent: string, beforeId: string | undefined, variant: "A" | "B" | "C" = "C"): HeatLayer {
  // Dark B (owner A/B test): normal blending, so nothing passes the accent.
  const composite = mode === "dark" ? (variant === "A" ? HEAT_DARK.composite : "source-over") : HEAT_STYLE[mode].composite;
  const strokes: { halo: HeatStroke | null; core: HeatStroke }[] = Array.from({ length: HEAT_LEVELS }, (_, level) => ({
    halo: heatHalo(mode, accent, heatLevelT(level)),
    core: heatCore(mode, accent, heatLevelT(level)),
  }));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  /** Each frequency level as one NaN-broken path, rarest first (light). */
  let levels: Float64Array[] = [];
  /** Every run on its own (dark, as 3.1.0 drew it). */
  let tracks: Float64Array[] = [];
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

  /** Every run's glow on its own canvas, then laid on the heat canvas at `max` opacity at most. */
  function glowLayer(blend: GlobalCompositeOperation, alpha: number, max: number, lineWidth: number) {
    if (!ctx) return;
    const glow = document.createElement("canvas");
    glow.width = canvas.width;
    glow.height = canvas.height;
    const g = glow.getContext("2d");
    if (!g) return;
    g.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    g.globalCompositeOperation = blend;
    g.lineJoin = "round";
    g.lineCap = "round";
    g.lineWidth = lineWidth * HEAT_DARK.passes[0].width;
    g.strokeStyle = rgbCss(hexToRgb(accent), alpha);
    const { x0, y0, world } = view;
    for (const track of tracks) {
      g.beginPath();
      let penDown = false;
      for (let p = 0; p < track.length; p += 2) {
        const x = track[p]!;
        if (Number.isNaN(x)) {
          penDown = false;
          continue;
        }
        const px = (x - x0) * world;
        const py = (track[p + 1]! - y0) * world;
        if (penDown) g.lineTo(px, py);
        else g.moveTo(px, py);
        penDown = true;
      }
      g.stroke();
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = max;
    ctx.drawImage(glow, 0, 0);
    ctx.restore();
  }

  function draw() {
    if (!ctx) return;
    ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    ctx.globalCompositeOperation = composite;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (mode === "dark" && variant === "B") {
      // B: the glows on their own canvas in normal blending, laid on at 0.35
      // at most, then the cores in normal blending: overlaps build towards
      // the accent and never past it, so no street turns white.
      const lineWidth = heatLineWidth(map.getZoom());
      glowLayer("source-over", 0.12, HEAT_B_GLOW_MAX, lineWidth);
      ctx.lineWidth = lineWidth * HEAT_DARK.passes[1].width;
      ctx.strokeStyle = rgbCss(hexToRgb(accent), HEAT_DARK.passes[1].alpha);
      for (const track of tracks) {
        trace(track);
        ctx.stroke();
      }
      return;
    }
    if (mode === "dark" && variant === "C") {
      // C: A's glow, added up on its own canvas and laid on at 0.40 at most;
      // then each street's core coloured and widened by how often it is run,
      // rarest first, topping out at a light accent 2.4 px wide.
      const lineWidth = heatLineWidth(map.getZoom());
      glowLayer("lighter", HEAT_DARK.passes[0].alpha, HEAT_C_GLOW_MAX, lineWidth);
      for (let level = 0; level < levels.length; level++) {
        const path = levels[level]!;
        if (!path.length) continue;
        const t = heatLevelT(level);
        ctx.lineWidth = Math.min(HEAT_C_CORE_MAX_PX, lineWidth * (1 + t));
        ctx.strokeStyle = heatCoreC(accent, t);
        trace(path);
        ctx.stroke();
      }
      return;
    }
    if (mode === "dark") {
      // Every glow before any core; additive, so order doesn't matter.
      const lineWidth = heatLineWidth(map.getZoom());
      for (const pass of HEAT_DARK.passes) {
        ctx.lineWidth = lineWidth * pass.width;
        ctx.strokeStyle = rgbCss(hexToRgb(accent), pass.alpha);
        for (const track of tracks) {
          trace(track);
          ctx.stroke();
        }
      }
      return;
    }
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
      tracks = next;
      levels = mode === "dark" && variant !== "C" ? [] : buildHeatLevels(next);
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
