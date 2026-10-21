"use client";

import type { CanvasSource, Coordinates, Map as MapLibreMap } from "maplibre-gl";
import { HEAT_DARK, countToT, heatLineWidth, heatZoomScale, mercatorX, mercatorY } from "./mapUtils";
import { hexToRgb, rampLight, rgbCss } from "@/lib/heatRamp";

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

/** Light (Wave 6b): runs closer than this share a count. */
const MERGE_M = 15;
/** Light: the core's width at city zoom (4d). */
const CORE_PX = 1.2;
/** Light: from here the core is dilated (≈ 2.4–3.3 px). */
const HOT_T = 0.5;
/** Light: per-pixel work, so the canvas is capped at 2x. */
const MAX_DPR = 2;
/**
 * Light: at most this many pixels. Each redraw reads and writes several
 * buffers the canvas's size; at 8 M pixels that passed Safari's canvas
 * memory limit and the tab crashed.
 */
const MAX_LIGHT_PIXELS = 2_500_000;

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
 * Light (Wave 6b, mockup 4d): a density raster, as Strava draws one. Each
 * run adds 1/255 to a pixel's alpha, so a pixel holds how many distinct runs
 * crossed it; a thin mask of every run gives the line shape; the count
 * colours each pixel of the line through the ramp, with a soft halo under
 * it and the busy pixels thickened. Lines stay continuous, with no pieces.
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
      mode === "light" ? Math.min(MAX_DPR, window.devicePixelRatio || 1) : window.devicePixelRatio || 1,
      Math.sqrt((mode === "light" ? MAX_LIGHT_PIXELS : MAX_PIXELS) / (width * height)),
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

  const scratch: Record<string, HTMLCanvasElement> = {};
  function surface(name: string, w: number, h: number, read = false) {
    const c = (scratch[name] ??= document.createElement("canvas"));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext("2d", { willReadFrequently: read })!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    g.clearRect(0, 0, w, h);
    return { c, g };
  }

  /** Give the scratch canvases' memory back: Safari counts every live canvas against one budget. */
  function releaseScratch() {
    for (const c of Object.values(scratch)) { c.width = 0; c.height = 0; }
  }

  function path(g: CanvasRenderingContext2D, track: Float64Array) {
    const { x0, y0, world } = view;
    let down = false;
    for (let p = 0; p < track.length; p += 2) {
      const x = track[p]!;
      if (Number.isNaN(x)) { down = false; continue; }
      const px = (x - x0) * world, py = (track[p + 1]! - y0) * world;
      if (down) g.lineTo(px, py);
      else g.moveTo(px, py);
      down = true;
    }
  }

  // Colour + alpha for every count 0..255, given p95.
  function luts(p95: number) {
    const core = new Uint8ClampedArray(1024), halo = new Uint8ClampedArray(1024), hot = new Uint8Array(256);
    for (let c = 0; c < 256; c++) {
      const t = countToT(c, p95);
      const cr = rampLight(accent, t);
      const hr = rampLight(accent, t * 0.45);
      core.set([cr[0], cr[1], cr[2], 255 * (0.43 + 0.57 * t)], c * 4);
      halo.set([hr[0], hr[1], hr[2], 255 * (0.12 + 0.48 * t)], c * 4);
      hot[c] = t >= HOT_T ? 1 : 0;
    }
    return { core, halo, hot };
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

  function drawLight() {
    if (!ctx) return;
    const W = canvas.width, H = canvas.height, s = view.scale;
    const k = heatZoomScale(map.getZoom());
    const lat = map.getCenter().lat;
    const mPerPx = (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / view.world;

    // 1. count: one stroke per run, +1/255 alpha per run
    const count = surface("count", W, H, true);
    count.g.setTransform(s, 0, 0, s, 0, 0);
    count.g.globalCompositeOperation = "lighter";
    count.g.lineCap = count.g.lineJoin = "round";
    count.g.lineWidth = Math.max(2, MERGE_M / mPerPx);
    count.g.strokeStyle = "rgba(255,255,255,0.0039215686)";
    for (const tr of tracks) { count.g.beginPath(); path(count.g, tr); count.g.stroke(); }

    // 2. mask: every run, one path, thin and opaque
    const mask = surface("mask", W, H, true);
    mask.g.setTransform(s, 0, 0, s, 0, 0);
    mask.g.lineCap = mask.g.lineJoin = "round";
    mask.g.lineWidth = CORE_PX * k;
    mask.g.strokeStyle = "#fff";
    mask.g.beginPath();
    for (const tr of tracks) path(mask.g, tr);
    mask.g.stroke();

    const cd = count.g.getImageData(0, 0, W, H).data;
    const md = mask.g.getImageData(0, 0, W, H).data;

    // 3. p95 of counts under the mask
    const hist = new Uint32Array(256);
    let n = 0;
    for (let i = 3; i < md.length; i += 4) if (md[i]) { hist[Math.max(1, cd[i]!)]!++; n++; }
    if (!n) { releaseScratch(); return; }
    let acc = 0, p95 = 1;
    for (let c = 1; c < 256; c++) { acc += hist[c]!; if (acc >= 0.95 * n) { p95 = c; break; } }
    const L = luts(p95);

    // No allocation per pixel: millions of pixels, and garbage per pixel stalled the tab.
    const core = new ImageData(W, H), halo = new ImageData(W, H);
    const co = core.data, ho = halo.data;
    let anyHot = false;
    for (let i = 0; i < md.length; i += 4) {
      const m = md[i + 3]!;
      if (!m) continue;
      const c = Math.max(1, cd[i + 3]!), j = c * 4, cov = m / 255;
      co[i] = L.core[j]!; co[i + 1] = L.core[j + 1]!; co[i + 2] = L.core[j + 2]!; co[i + 3] = L.core[j + 3]! * cov;
      ho[i] = L.halo[j]!; ho[i + 1] = L.halo[j + 1]!; ho[i + 2] = L.halo[j + 2]!; ho[i + 3] = L.halo[j + 3]! * cov;
      if (L.hot[c]) anyHot = true;
    }

    // 4. compose: halo (down/up-scale blur, ≈ 4 px), dilated busy core, core
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const f = Math.max(2, Math.round(3 * s));
    // Two full-size scratch canvases, reused: the count one holds the halo,
    // then the core; the mask one the busy core.
    const hs = surface("count", W, H, true); hs.g.putImageData(halo, 0, 0);
    const small = surface("haloSmall", Math.ceil(W / f), Math.ceil(H / f));
    small.g.imageSmoothingQuality = "high";
    small.g.drawImage(hs.c, 0, 0, small.c.width, small.c.height);
    ctx.drawImage(small.c, 0, 0, W, H);
    ctx.drawImage(small.c, 0, 0, W, H);           // twice: 4d's halo reaches 0.75 at the top

    if (anyHot) {
      // The busy core: the core with every pixel under HOT_T cleared, in place.
      for (let i = 0; i < md.length; i += 4) {
        if (co[i + 3] && !L.hot[Math.max(1, cd[i + 3]!)]) ho[i + 3] = 0;
        else ho[i + 3] = co[i + 3]!;
        ho[i] = co[i]!; ho[i + 1] = co[i + 1]!; ho[i + 2] = co[i + 2]!;
      }
      const hc = surface("mask", W, H, true); hc.g.putImageData(halo, 0, 0);
      const r = Math.max(1, Math.round(s));
      for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r], [-r, -r], [r, r], [-r, r], [r, -r]] as const) ctx.drawImage(hc.c, dx, dy);
    }

    const cc = surface("count", W, H, true); cc.g.putImageData(core, 0, 0);
    ctx.drawImage(cc.c, 0, 0);
    releaseScratch();
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
      releaseScratch();
      map.off("moveend", redraw);
      map.off("resize", redraw);
      map.off("render", onRender);
    },
  };
}
