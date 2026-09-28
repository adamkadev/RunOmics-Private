"use client";

import type { CanvasSource, Coordinates, Map as MapLibreMap } from "maplibre-gl";
import { HEAT_STYLE, heatLineWidth, mercatorX, mercatorY } from "./mapUtils";

export const HEAT_SOURCE = "heat";
export const HEAT_LAYER = "heat";

const REVEAL_STEPS = 16;
const REVEAL_STEP_MS = 45;

/** Canvas drawn past each edge, a quarter of the view, so a pan shows tracks before the redraw. */
const MARGIN = 0.25;
/** The canvas is uploaded as a texture on every redraw: at most this many pixels, and 4096 a side. */
const MAX_PIXELS = 8_000_000;
const MAX_SIDE = 4096;
/** MapLibre's zoom 0 is one 512 px tile. */
const TILE_SIZE = 512;

export interface HeatLayer {
  /** Replace the tracks drawn, revealing them in steps unless `reveal` is false. */
  setTracks(tracks: Float64Array[], reveal: boolean): void;
  remove(): void;
}

/**
 * The heat tracks as a canvas the map georeferences (v4.17). Additive and
 * multiplied blending are a 2D canvas's, not a style layer's, so the tracks
 * are stroked onto a canvas over the view and MapLibre draws that canvas as
 * a raster under the place names. Panning and zooming move the raster with
 * the map; when the view settles it is redrawn sharp for the new view.
 */
export function addHeatLayer(map: MapLibreMap, mode: "dark" | "light", beforeId: string | undefined): HeatLayer {
  const style = HEAT_STYLE[mode];
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  let tracks: Float64Array[] = [];
  /** Tracks already on the canvas: a reveal adds to them, a redraw repeats them. */
  let drawn = 0;
  let revealTimer: ReturnType<typeof setTimeout> | null = null;
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

  function stroke(from: number, to: number) {
    if (!ctx) return;
    const { x0, y0, world, scale } = view;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalCompositeOperation = style.composite;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const lineWidth = heatLineWidth(map.getZoom());
    // Every glow before any core, as the design draws them; both blends are
    // order-free, so a reveal can add runs on top of what is drawn.
    for (const pass of style.passes) {
      ctx.lineWidth = lineWidth * pass.width;
      ctx.strokeStyle = pass.color;
      for (let t = from; t < to; t++) {
        const track = tracks[t]!;
        ctx.beginPath();
        let penDown = false;
        for (let p = 0; p < track.length; p += 2) {
          const x = track[p]!;
          if (Number.isNaN(x)) {
            penDown = false;
            continue;
          }
          const px = (x - x0) * world;
          const py = (track[p + 1]! - y0) * world;
          if (penDown) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
          penDown = true;
        }
        ctx.stroke();
      }
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
    stroke(0, drawn);
    upload();
  }

  function stopReveal() {
    if (revealTimer !== null) clearTimeout(revealTimer);
    revealTimer = null;
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
      stopReveal();
      tracks = next;
      if (!reveal || !tracks.length) {
        drawn = tracks.length;
        redraw();
        return;
      }
      drawn = 0;
      redraw();
      let step = 0;
      const advance = () => {
        step += 1;
        const target = Math.ceil((tracks.length * step) / REVEAL_STEPS);
        stroke(drawn, target);
        drawn = target;
        upload();
        revealTimer = step < REVEAL_STEPS ? setTimeout(advance, REVEAL_STEP_MS) : null;
      };
      advance();
    },
    remove() {
      stopReveal();
      map.off("moveend", redraw);
      map.off("resize", redraw);
      map.off("render", onRender);
    },
  };
}
