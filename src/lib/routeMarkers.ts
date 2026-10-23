/**
 * The finish's thin dark outline keeps it visible on light tiles. The accent
 * is a point marker's only: no trace or data colour takes it.
 */

export type MarkerKind = 'start' | 'finish' | 'loop'

type Point = [number, number]

interface MarkerSpec {
  /** Across, ring included, outline not. */
  diameter: number
  ring: number
  outline: number
}

export const MARKER_SPECS: Record<MarkerKind, MarkerSpec> = {
  start: { diameter: 16, ring: 2.5, outline: 0 },
  finish: { diameter: 18, ring: 2.5, outline: 1 },
  loop: { diameter: 22, ring: 3, outline: 1.5 },
}

export const JOIN_PX = 20
/** The checkers' side, in px. */
const CHECKER = 3
export const MARKER_INK = '#0c0d0d'
const WHITE = '#ffffff'
const FINISH_OUTLINE = 'rgba(12, 13, 13, 0.6)'

export function markerExtent(kind: MarkerKind): number {
  const spec = MARKER_SPECS[kind]
  return spec.diameter + spec.outline * 2
}

export function endsJoined(start: Point, finish: Point): boolean {
  return Math.hypot(finish[0] - start[0], finish[1] - start[1]) < JOIN_PX
}

export interface RouteEnd<P> {
  kind: MarkerKind
  at: P
}

/** Finish first, so the start sits on top. */
export function routeEnds<P>(start: P, finish: P | null, joined: boolean): RouteEnd<P>[] {
  if (!finish) return [{ kind: 'start', at: start }]
  if (joined) return [{ kind: 'loop', at: start }]
  return [{ kind: 'finish', at: finish }, { kind: 'start', at: start }]
}

function layers(kind: MarkerKind, accent: string, scale = 1) {
  const spec = MARKER_SPECS[kind]
  const r = (spec.diameter / 2) * scale
  return {
    outline: spec.outline > 0 ? { radius: r + spec.outline * scale, color: kind === 'loop' ? MARKER_INK : FINISH_OUTLINE } : null,
    ring: { radius: r, color: kind === 'loop' ? accent : WHITE },
    inner: { radius: r - spec.ring * scale, checkered: kind !== 'start', color: accent },
    checker: CHECKER * scale,
  }
}

/** Centred on the disc, so the rim is even. */
function checkerGrid(radius: number, size: number) {
  const cells = Math.ceil((radius * 2) / size)
  return { cells, origin: -(cells * size) / 2 }
}

function inkChecker(x: number, y: number, radius: number): boolean {
  const { origin } = checkerGrid(radius, CHECKER)
  return (Math.floor((x - origin) / CHECKER) + Math.floor((y - origin) / CHECKER)) % 2 === 1
}

export function drawRouteMarker(ctx: CanvasRenderingContext2D, kind: MarkerKind, [x, y]: Point, accent: string, scale = 1) {
  const { outline, ring, inner, checker } = layers(kind, accent, scale)
  const disc = (radius: number, color: string) => {
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }
  ctx.save()
  if (outline) disc(outline.radius, outline.color)
  disc(ring.radius, ring.color)
  if (!inner.checkered) {
    disc(inner.radius, inner.color)
  } else {
    disc(inner.radius, WHITE)
    ctx.beginPath()
    ctx.arc(x, y, inner.radius, 0, Math.PI * 2)
    ctx.clip()
    ctx.fillStyle = MARKER_INK
    const size = checker
    const { cells, origin } = checkerGrid(inner.radius, size)
    for (let row = 0; row < cells; row++) {
      for (let col = 0; col < cells; col++) {
        if ((row + col) % 2 === 1) ctx.fillRect(x + origin + col * size, y + origin + row * size, size, size)
      }
    }
  }
  ctx.restore()
}

/** "#rrggbb" or "rgba(r, g, b, a)" as [r, g, b, a], a from 0 to 1. */
function rgba(color: string): [number, number, number, number] {
  const hex = color.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1]!, 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
  }
  const parts = color.match(/rgba?\(([^)]+)\)/)?.[1]?.split(',').map((p) => Number(p.trim()))
  if (parts && parts.length >= 3) return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1]
  return [0, 0, 0, 1]
}

export interface MarkerImage {
  width: number
  height: number
  data: Uint8ClampedArray
}

/** Samples per pixel along each axis: enough for a smooth rim. */
const SUPERSAMPLE = 4

/**
 * For a MapLibre icon: a map draws icons, not canvas paths. Centred, so the
 * icon's default anchor puts it on the point.
 */
export function routeMarkerImage(kind: MarkerKind, accent: string, pixelRatio = 2): MarkerImage {
  const { outline, ring, inner } = layers(kind, accent)
  const outer = outline?.radius ?? ring.radius
  const size = Math.ceil(outer * 2 * pixelRatio)
  const centre = size / 2 / pixelRatio
  const colours = {
    outline: rgba(outline?.color ?? WHITE),
    ring: rgba(ring.color),
    inner: rgba(inner.color),
    ink: rgba(MARKER_INK),
    white: rgba(WHITE),
  }
  const data = new Uint8ClampedArray(size * size * 4)
  const n = SUPERSAMPLE * SUPERSAMPLE
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          // In CSS px from the marker's centre.
          const x = (px + (sx + 0.5) / SUPERSAMPLE) / pixelRatio - centre
          const y = (py + (sy + 0.5) / SUPERSAMPLE) / pixelRatio - centre
          const d = Math.hypot(x, y)
          let c: [number, number, number, number] | null = null
          if (d <= inner.radius) {
            c = !inner.checkered ? colours.inner : inkChecker(x, y, inner.radius) ? colours.ink : colours.white
          } else if (d <= ring.radius) {
            c = colours.ring
          } else if (outline && d <= outline.radius) {
            c = colours.outline
          }
          if (!c) continue
          r += c[0] * c[3]
          g += c[1] * c[3]
          b += c[2] * c[3]
          a += c[3]
        }
      }
      const i = (py * size + px) * 4
      if (a > 0) {
        data[i] = Math.round(r / a)
        data[i + 1] = Math.round(g / a)
        data[i + 2] = Math.round(b / a)
      }
      data[i + 3] = Math.round((a / n) * 255)
    }
  }
  return { width: size, height: size, data }
}
