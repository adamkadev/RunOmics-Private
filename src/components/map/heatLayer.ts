"use client";

import type { CanvasSource, Coordinates, Map as MapLibreMap } from "maplibre-gl";
import { HEAT_DARK, countToT, dilateMax, heatLineWidth, heatZoomScale, mercatorX, mercatorY } from "./mapUtils";
import { heatHaloLight, hexToRgb, rampLight, rgbCss } from "@/lib/heatRamp";

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
/** Light (4d): the halo's half-width on a rare street and the outer, fainter ring's (6 px and 13 px across). */
const HALO_HALF_PX = 3;
const HALO_OUTER_HALF_PX = 6.5;
/** Light: the outer ring's share of the halo's opacity, for a soft edge. */
const HALO_OUTER_ALPHA = 0.55;
/** Light: the halo's blur, σ ≈ 3.2 px (4d), as a down/up-scale by this. */
const HALO_BLUR_PX = 3;
/** Light: per-pixel work, so the canvas is capped at 2x. */
const MAX_DPR = 2;
/**
 * Light: at most this many pixels. Each redraw keeps a scratch canvas the
 * canvas's size; at 8 M pixels with several of them, Safari's canvas memory
 * limit was passed and the tab crashed.
 */
const MAX_LIGHT_PIXELS = 4_000_000;

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
      const hr = heatHaloLight(accent, t);
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

  /**
   * Reading a canvas back is the expensive step (a GPU readback on iPhone):
   * at full resolution it took seconds and blanked the map. So only the run
   * counts are read back, at CSS-pixel resolution, and coloured there; the
   * sharp line shape is stroked at full resolution and filled with that
   * colour by the GPU ("source-in"), never read back.
   */
  function drawLight() {
    if (!ctx) return;
    const W = canvas.width, H = canvas.height, s = view.scale;
    const k = heatZoomScale(map.getZoom());
    const lat = map.getCenter().lat;
    const mPerPx = (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / view.world;

    // 1. count, at CSS-pixel resolution: one stroke per run, +1/255 alpha per run.
    //    At least 3 px wide, so the field covers the line it colours.
    const cw = Math.max(1, Math.round(W / s)), ch = Math.max(1, Math.round(H / s));
    const count = surface("count", cw, ch, true);
    count.g.globalCompositeOperation = "lighter";
    count.g.lineCap = count.g.lineJoin = "round";
    const band = Math.max(3, MERGE_M / mPerPx);
    count.g.lineWidth = band;
    count.g.strokeStyle = "rgba(255,255,255,0.0039215686)";
    for (const tr of tracks) { count.g.beginPath(); path(count.g, tr); count.g.stroke(); }
    const cd = count.g.getImageData(0, 0, cw, ch).data;

    // 2. p95 of the counts the runs cover
    const hist = new Uint32Array(256);
    let n = 0;
    for (let i = 3; i < cd.length; i += 4) if (cd[i]) { hist[cd[i]!]!++; n++; }
    if (!n) { releaseScratch(); return; }
    let acc = 0, p95 = 1;
    for (let c = 1; c < 256; c++) { acc += hist[c]!; if (acc >= 0.95 * n) { p95 = c; break; } }
    const L = luts(p95);

    // 3. colour fields: core, halo and busy core, one pixel per CSS pixel
    const core = new ImageData(cw, ch), halo = new ImageData(cw, ch), hot = new ImageData(cw, ch);
    const co = core.data, ho = halo.data, bo = hot.data;
    let anyHot = false;
    for (let i = 0; i < cd.length; i += 4) {
      const c = cd[i + 3]!;
      if (!c) continue;
      const j = c * 4;
      co[i] = L.core[j]!; co[i + 1] = L.core[j + 1]!; co[i + 2] = L.core[j + 2]!; co[i + 3] = L.core[j + 3]!;
      if (L.hot[c]) { bo[i] = co[i]!; bo[i + 1] = co[i + 1]!; bo[i + 2] = co[i + 2]!; bo[i + 3] = co[i + 3]!; anyHot = true; }
    }
    // The halo: the counts widened past the line (4d: 6 px across on a rare
    // street, a fainter ring out to 13 px), each pixel taking the busiest run
    // near it - a max, so overlapping glows never stack into ink.
    const counts = new Uint8Array(cw * ch);
    for (let p = 0; p < counts.length; p++) counts[p] = cd[p * 4 + 3]!;
    const inner = dilateMax(counts, cw, ch, Math.max(1, Math.round(HALO_HALF_PX - band / 2)));
    const outer = dilateMax(counts, cw, ch, Math.max(2, Math.round(HALO_OUTER_HALF_PX - band / 2)));
    for (let p = 0, i = 0; p < counts.length; p++, i += 4) {
      const ci = inner[p]!, cj = outer[p]!;
      if (!cj) continue;
      const ai = ci ? L.halo[ci * 4 + 3]! : 0, aj = L.halo[cj * 4 + 3]! * HALO_OUTER_ALPHA;
      const j = (ai >= aj ? ci : cj) * 4;
      ho[i] = L.halo[j]!; ho[i + 1] = L.halo[j + 1]!; ho[i + 2] = L.halo[j + 2]!; ho[i + 3] = Math.max(ai, aj);
    }
    const field = (name: string, img: ImageData) => { const f = surface(name, cw, ch); f.g.putImageData(img, 0, 0); return f.c; };

    // 4. compose at full resolution: halo, dilated busy core, core
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // The halo blurred by a down/up-scale (σ ≈ 3.2 px), which works in Safari, unlike ctx.filter. Once, not twice.
    const haloField = field("halo", halo);
    const small = surface("haloSmall", Math.ceil(cw / HALO_BLUR_PX), Math.ceil(ch / HALO_BLUR_PX));
    small.g.imageSmoothingQuality = "high";
    small.g.drawImage(haloField, 0, 0, small.c.width, small.c.height);
    ctx.drawImage(small.c, 0, 0, W, H);

    // A line: every run stroked once at full resolution, then filled with a field.
    const line = (width: number, colours: HTMLCanvasElement) => {
      const m = surface("line", W, H);
      m.g.setTransform(s, 0, 0, s, 0, 0);
      m.g.lineCap = m.g.lineJoin = "round";
      m.g.lineWidth = width;
      m.g.strokeStyle = "#fff";
      m.g.beginPath();
      for (const tr of tracks) path(m.g, tr);
      m.g.stroke();
      m.g.setTransform(1, 0, 0, 1, 0, 0);
      m.g.globalCompositeOperation = "source-in";
      m.g.imageSmoothingEnabled = true;
      m.g.imageSmoothingQuality = "high";
      m.g.drawImage(colours, 0, 0, W, H);
      ctx.drawImage(m.c, 0, 0);
    };
    // The busy core 1 px wider each side (≈ 2.4–3.3 px), then the core on top.
    if (anyHot) line(CORE_PX * k + 2, field("hot", hot));
    line(CORE_PX * k, field("core", core));
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

  function paint() {
    layout();
    ctx?.setTransform(1, 0, 0, 1, 0, 0);
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    draw();
    upload();
  }

  // Light's per-pixel draw runs on the next frame, not inside the map's
  // style.load or moveend: the basemap finishes loading first, and a burst
  // of moves draws once.
  let pending = 0;
  function redraw() {
    if (mode === "dark") return paint();
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      if (map.getSource(HEAT_SOURCE)) paint();
    });
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
      if (pending) cancelAnimationFrame(pending);
      pending = 0;
      releaseScratch();
      map.off("moveend", redraw);
      map.off("resize", redraw);
      map.off("render", onRender);
    },
  };
}
