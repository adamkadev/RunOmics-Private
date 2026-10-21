"use client";

import type { CanvasSource, Coordinates, Map as MapLibreMap } from "maplibre-gl";
import { HEAT_DARK, heatLineWidth, mercatorX, mercatorY } from "./mapUtils";
import { hexToRgb, mix, rgbCss, scale } from "@/lib/heatRamp";

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

/**
 * Light (mirrors dark A): each layer is every run stroked in white, its
 * transparency added up per run and capped at 1, then tinted. A soft glow
 * (full at ~33 runs), a mint line (full at ~8 runs) and a deep line on top
 * (full at ~28 runs), so one run is a faint mint thread and a corridor is
 * deep green over a mint glow. Vector strokes on the GPU, never read back.
 */
const HEAT_LIGHT = {
  glow: { width: 4, alpha: 0.03, opacity: 0.6, sigmaPx: 3.2 },
  mint: { width: 1, alpha: 0.12 },
  deep: { width: 1.2, alpha: 0.035 },
} as const;

/** ctx.filter exists and takes a blur: Safari before 18 has neither. */
const hasFilter = typeof document !== "undefined" && (() => {
  const g = document.createElement("canvas").getContext("2d");
  if (!g || !("filter" in g)) return false;
  g.filter = "blur(1px)";
  return g.filter === "blur(1px)";
})();

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
 * Dark (variant A, Wave 6b): every run stroked on its own in the accent and
 * added together, so a street glows by how many runs overlap on it.
 *
 * Light (mirrors dark A, Oct 2026): three layers of every run stroked on
 * its own, transparency added up per run, each tinted - a blurred glow, a
 * mint line, a deep line - see HEAT_LIGHT. The density raster it replaces
 * read pixels back, which forced it to one dot per screen point: stair-step
 * glow edges when zoomed in, notches along corridors, dark knots at
 * junctions, and a slow frame on iPhone.
 */
export function addHeatLayer(map: MapLibreMap, mode: "dark" | "light", accent: string, beforeId: string | undefined): HeatLayer {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  /** Every run on its own. */
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

  /** A run as one path on `g`, in CSS px. */
  function traceOn(g: CanvasRenderingContext2D, path: Float64Array) {
    const { x0, y0, world } = view;
    g.beginPath();
    let penDown = false;
    for (let p = 0; p < path.length; p += 2) {
      const x = path[p]!;
      if (Number.isNaN(x)) {
        penDown = false;
        continue;
      }
      const px = (x - x0) * world;
      const py = (path[p + 1]! - y0) * world;
      if (penDown) g.lineTo(px, py);
      else g.moveTo(px, py);
      penDown = true;
    }
  }

  function trace(path: Float64Array) {
    if (ctx) traceOn(ctx, path);
  }

  /** Variant A: every glow before any core; additive, so order doesn't matter. */
  function drawDark() {
    if (!ctx) return;
    ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    ctx.globalCompositeOperation = HEAT_DARK.composite;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const lineWidth = heatLineWidth(map.getZoom());
    for (const pass of HEAT_DARK.passes) {
      ctx.lineWidth = lineWidth * pass.width;
      ctx.strokeStyle = rgbCss(hexToRgb(accent), pass.alpha);
      for (const track of tracks) {
        trace(track);
        ctx.stroke();
      }
    }
  }

  const layers: Record<"glow" | "mint" | "deep", HTMLCanvasElement> = {
    glow: document.createElement("canvas"),
    mint: document.createElement("canvas"),
    deep: document.createElement("canvas"),
  };
  /** The blur fallback's scratch canvas, made only where ctx.filter is missing. */
  let blurScratch: HTMLCanvasElement | null = null;

  /** Every run stroked in white on its own, "lighter" so transparency builds up, then tinted. */
  function strokeLayer(name: keyof typeof layers, widthMul: number, alpha: number, tint: string) {
    const c = layers[name];
    if (c.width !== canvas.width || c.height !== canvas.height) { c.width = canvas.width; c.height = canvas.height; }
    const g = c.getContext("2d")!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, c.width, c.height);
    g.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    g.globalCompositeOperation = "lighter";
    g.lineJoin = "round";
    g.lineCap = "round";
    g.lineWidth = heatLineWidth(map.getZoom()) * widthMul;
    g.strokeStyle = `rgba(255,255,255,${alpha})`;
    for (const track of tracks) { traceOn(g, track); g.stroke(); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = tint;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  /**
   * A gaussian blur that works in every Safari: ctx.filter where it exists
   * (Safari 18+), else a shadow cast from off-screen. A shadow is painted in
   * shadowColor, never the source's colours, so it is cast on a scratch
   * canvas and tinted there before it is laid on.
   */
  function drawBlurred(src: HTMLCanvasElement, sigmaDevicePx: number, opacity: number, tint: string) {
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = opacity;
    if (hasFilter) {
      ctx.filter = `blur(${sigmaDevicePx}px)`;
      ctx.drawImage(src, 0, 0);
    } else {
      const t = (blurScratch ??= document.createElement("canvas"));
      if (t.width !== src.width || t.height !== src.height) { t.width = src.width; t.height = src.height; }
      const g = t.getContext("2d")!;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = "source-over";
      g.clearRect(0, 0, t.width, t.height);
      const OFF = 10_000;
      g.save();
      g.shadowColor = "rgba(0,0,0,1)";
      g.shadowBlur = 2 * sigmaDevicePx; // shadowBlur ≈ 2σ
      g.shadowOffsetX = OFF;
      g.drawImage(src, -OFF, 0);
      g.restore();
      g.globalCompositeOperation = "source-in";
      g.fillStyle = tint;
      g.fillRect(0, 0, t.width, t.height);
      ctx.drawImage(t, 0, 0);
    }
    ctx.restore();
  }

  function drawLight() {
    if (!ctx) return;
    const A = hexToRgb(accent);
    const deep = rgbCss(scale(A, 0.25), 1); // mint → rgb(13,51,41)
    const glowTint = rgbCss(mix(A, [0, 0, 0], 0.13), 1); // mint → ≈ rgb(39,183,144)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    const L = HEAT_LIGHT;
    drawBlurred(strokeLayer("glow", L.glow.width, L.glow.alpha, glowTint), L.glow.sigmaPx * view.scale, L.glow.opacity, glowTint);
    ctx.drawImage(strokeLayer("mint", L.mint.width, L.mint.alpha, rgbCss(A, 1)), 0, 0);
    ctx.drawImage(strokeLayer("deep", L.deep.width, L.deep.alpha, deep), 0, 0);
  }

  function draw() {
    if (mode === "dark") drawDark();
    else drawLight();
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
    ctx?.setTransform(1, 0, 0, 1, 0, 0);
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
      // Give the light layers' memory back: Safari counts every live canvas against one budget.
      for (const c of [...Object.values(layers), blurScratch]) if (c) { c.width = 0; c.height = 0; }
      map.off("moveend", redraw);
      map.off("resize", redraw);
      map.off("render", onRender);
    },
  };
}
