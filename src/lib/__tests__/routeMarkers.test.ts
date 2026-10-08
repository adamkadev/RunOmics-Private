import { describe, expect, it } from 'vitest'
import { JOIN_PX, MARKER_INK, drawRouteMarker, endsJoined, markerExtent, routeEnds, routeMarkerImage } from '@/lib/routeMarkers'

const ACCENT = '#2dd4a7'

/** One RGBA pixel of an image, at device px (x, y). */
function pixel(image: { width: number; data: Uint8ClampedArray }, x: number, y: number) {
  const i = (y * image.width + x) * 4
  return [...image.data.slice(i, i + 4)]
}

describe('the route markers (design review, Oct 2026)', () => {
  it('draws two ends apart, the finish under the start, and one loop marker where they touch', () => {
    expect(routeEnds('A', 'B', false)).toEqual([{ kind: 'finish', at: 'B' }, { kind: 'start', at: 'A' }])
    expect(routeEnds('A', 'B', true)).toEqual([{ kind: 'loop', at: 'A' }])
    // The finish waits for the draw-in to reach it.
    expect(routeEnds('A', null, false)).toEqual([{ kind: 'start', at: 'A' }])
  })

  it('joins the ends under 20 px apart, never stacking two markers', () => {
    expect(JOIN_PX).toBe(20)
    expect(endsJoined([0, 0], [19.9, 0])).toBe(true)
    expect(endsJoined([0, 0], [12, 16])).toBe(false)
  })

  it('sizes them 16, 18 and 22 px across, the outlines outside', () => {
    expect([markerExtent('start'), markerExtent('finish'), markerExtent('loop')]).toEqual([16, 20, 25])
  })

  it('draws the finish as an ink-and-white checkered dot in a white ring and a thin dark outline', () => {
    const image = routeMarkerImage('finish', ACCENT, 2)
    expect([image.width, image.height]).toEqual([40, 40])
    // The centre's checker, the 2.5 px ring, the outline past it, and clear corners.
    expect(pixel(image, 20, 20)).toEqual([255, 255, 255, 255])
    expect(pixel(image, 16, 10)).toEqual([12, 13, 13, 255])
    expect(pixel(image, 20, 4)).toEqual([255, 255, 255, 255])
    const outline = pixel(image, 20, 1)
    expect(outline.slice(0, 3)).toEqual([12, 13, 13])
    expect(outline[3]).toBeGreaterThan(100)
    expect(pixel(image, 0, 0)[3]).toBe(0)
  })

  it('rings the loop marker in the accent, outlined in ink', () => {
    const image = routeMarkerImage('loop', ACCENT, 2)
    expect(image.width).toBe(50)
    // 9.5 px from the centre: the accent ring; 11.75 px: the ink outline.
    expect(pixel(image, 25, 25 - 19)).toEqual([0x2d, 0xd4, 0xa7, 255])
    expect(pixel(image, 25, 25 - 23).slice(0, 3)).toEqual([12, 13, 13])
  })

  it('draws the same markers on a canvas: an accent start, checkers clipped to the finish', () => {
    const fills: { op: string; fill: string; args: unknown[] }[] = []
    let fillStyle = ''
    const ctx = {
      save() {}, restore() {}, beginPath() {}, clip() {},
      arc: (...args: unknown[]) => fills.push({ op: 'arc', fill: fillStyle, args }),
      fill: () => fills.push({ op: 'fill', fill: fillStyle, args: [] }),
      fillRect: (...args: unknown[]) => fills.push({ op: 'fillRect', fill: fillStyle, args }),
      set fillStyle(v: string) { fillStyle = v },
      get fillStyle() { return fillStyle },
    } as unknown as CanvasRenderingContext2D
    drawRouteMarker(ctx, 'start', [50, 50], ACCENT)
    expect(fills.filter((f) => f.op === 'fill').map((f) => f.fill)).toEqual(['#ffffff', ACCENT])
    fills.length = 0
    drawRouteMarker(ctx, 'finish', [50, 50], ACCENT)
    expect(fills.some((f) => f.op === 'fillRect' && f.fill === MARKER_INK)).toBe(true)
    expect(fills.some((f) => f.op === 'fill' && f.fill === ACCENT)).toBe(false)
  })
})
