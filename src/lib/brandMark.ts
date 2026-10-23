/**
 * Each layer is offset 3.5 units and tapers 29 → 26 → 23 so the stack leans forward.
 * Colour always comes from the accent tokens.
 */
export const MARK_VIEWBOX = 44
export const MARK_STROKE = 6
export const MARK_SMALL_STROKE = 7
export const MARK_SMALL_MAX_PX = 24

interface Arc {
  /** Left end x; the chord is 2 rx wide at height y. */
  x: number
  y: number
  rx: number
  ry: number
  /** Arches up (sweep 1) or curves down (sweep 0). */
  up: boolean
}

/** Top cap, ring front, ring back, base. */
const ARCS: readonly Arc[] = [
  { x: 11, y: 12, rx: 14.5, ry: 6.5, up: true },
  { x: 9, y: 22, rx: 13, ry: 6, up: false },
  { x: 9, y: 22, rx: 13, ry: 6, up: true },
  { x: 7, y: 32, rx: 11.5, ry: 5.5, up: false },
]
const SMALL_ARCS = [ARCS[0]!, ARCS[2]!, ARCS[3]!]

const toPath = ({ x, y, rx, ry, up }: Arc) => `M ${x} ${y} A ${rx} ${ry} 0 0 ${up ? 1 : 0} ${x + 2 * rx} ${y}`

export const MARK_PATHS = ARCS.map(toPath)
export const MARK_SMALL_PATHS = SMALL_ARCS.map(toPath)

export function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  const small = size <= MARK_SMALL_MAX_PX
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / MARK_VIEWBOX, size / MARK_VIEWBOX)
  ctx.strokeStyle = color
  ctx.lineWidth = small ? MARK_SMALL_STROKE : MARK_STROKE
  ctx.lineCap = 'round'
  for (const arc of small ? SMALL_ARCS : ARCS) {
    ctx.beginPath()
    // Canvas angles run clockwise: pi is the left end, 1.5 pi the top.
    if (arc.up) ctx.ellipse(arc.x + arc.rx, arc.y, arc.rx, arc.ry, 0, Math.PI, 2 * Math.PI)
    else ctx.ellipse(arc.x + arc.rx, arc.y, arc.rx, arc.ry, 0, Math.PI, 0, true)
    ctx.stroke()
  }
  ctx.restore()
}
