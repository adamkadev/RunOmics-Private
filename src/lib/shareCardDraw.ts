import type { Activity } from '@/domain/activity/types'
import { formatClock, formatDistance, formatDurationShort } from '@/lib/formatters'
import { shareCardTitle } from '@/lib/shareCardStats'
import type { ShareDesign } from '@/lib/shareCardPalette'
import { t } from '@/i18n'

// ── Hero metric helpers ──────────────────────────────────────────────────────

const HERO_OPACITY: Partial<Record<ShareDesign, number>> = {
  aurora: 0.12, pulse: 0.10, terrain: 0.14, prism: 0.11, cadence: 0.10,
}

function getHeroMetric(design: ShareDesign, activity: Activity): { value: string; unit: string } | null {
  switch (design) {
    case 'aurora':
      return { value: activity.distanceKm.toFixed(1), unit: 'km' }
    case 'pulse':
      return activity.avgHeartRate
        ? { value: String(activity.avgHeartRate), unit: 'bpm' }
        : { value: activity.distanceKm.toFixed(1), unit: 'km' }
    case 'prism':
      return activity.paceSecPerKm
        ? { value: formatClock(activity.paceSecPerKm), unit: '/km' }
        : { value: activity.distanceKm.toFixed(1), unit: 'km' }
    case 'cadence':
      return activity.cadenceSpm
        ? { value: String(activity.cadenceSpm), unit: 'spm' }
        : { value: activity.distanceKm.toFixed(1), unit: 'km' }
    case 'terrain':
      return activity.elevationGain
        ? { value: `+${activity.elevationGain}`, unit: 'm' }
        : { value: activity.distanceKm.toFixed(1), unit: 'km' }
    default:
      return null
  }
}

function drawHeroMetric(
  ctx: Ctx,
  W: number,
  H: number,
  dark: boolean,
  r: number, g: number, b: number,
  design: ShareDesign,
  activity: Activity,
) {
  const metric = getHeroMetric(design, activity)
  if (!metric) return

  const base = HERO_OPACITY[design] ?? 0
  const opacity = dark ? base : base / 1.4
  const centerX = W / 2
  const centerY = H * 0.44

  ctx.save()

  ctx.shadowColor = `rgba(${r},${g},${b},${dark ? 0.25 : 0.15})`
  ctx.shadowBlur = 40

  ctx.font = '900 96px Inter,system-ui,sans-serif'
  ctx.fillStyle = dark ? `rgba(255,255,255,${opacity})` : `rgba(0,0,0,${opacity})`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(metric.value, centerX, centerY)

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0

  ctx.font = '700 18px Inter,system-ui,sans-serif'
  ctx.fillStyle = dark ? `rgba(255,255,255,${opacity * 1.8})` : `rgba(0,0,0,${opacity * 1.5})`
  ctx.textBaseline = 'top'
  ctx.fillText(metric.unit, centerX, centerY + 4)

  const lineW = 32
  ctx.beginPath()
  ctx.moveTo(centerX - lineW / 2, centerY - 108)
  ctx.lineTo(centerX + lineW / 2, centerY - 108)
  ctx.strokeStyle = dark ? `rgba(255,255,255,${opacity * 0.8})` : `rgba(0,0,0,${opacity * 0.7})`
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.restore()
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}

// ── Shared canvas helpers (ported from DC HTML) ─────────────────────────────

type Ctx = CanvasRenderingContext2D

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, rr: number) {
  ctx.beginPath()
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, rr); return }
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function glow(ctx: Ctx, W: number, H: number, cx: number, cy: number, radius: number, r: number, g: number, b: number, alpha: number) {
  ctx.save()
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
  grd.addColorStop(0, `rgba(${r},${g},${b},${alpha})`)
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, W, H)
  ctx.restore()
}

// ctx.filter blur never renders in WebKit, and ctx.shadowBlur draws the
// shadow-casting shape itself in addition to its shadow, which leaves a solid
// stroke instead of a soft bloom. Drawing the stroke far off-canvas and using
// shadowOffsetX to bring back only its blurred shadow reproduces the
// ctx.filter look with the cross-browser-reliable shadow primitive.
// shadowOffsetX is in raw device pixels (unaffected by the canvas transform),
// while translate() is in logical units, so the offset must be scaled by the
// current transform to cancel the translate exactly.
function strokeGlow(ctx: Ctx, points: [number, number][], lw: number, a: number, r: number, g: number, b: number, blur: number) {
  const first = points[0]
  if (!first) return
  const OFFSET = 1000
  ctx.save()
  ctx.translate(-OFFSET, 0)
  ctx.shadowOffsetX = OFFSET * ctx.getTransform().a
  ctx.shadowColor = `rgba(${r},${g},${b},${a})`
  ctx.shadowBlur = blur
  ctx.beginPath(); ctx.moveTo(first[0], first[1])
  points.forEach(([px, py]) => ctx.lineTo(px, py))
  ctx.strokeStyle = `rgba(${r},${g},${b},${a})`; ctx.lineWidth = lw
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke()
  ctx.restore()
}

function glass(ctx: Ctx, cx: number, cy: number, w: number, h: number, rot: number, r: number, g: number, b: number, dark: boolean, al: number) {
  ctx.save()
  ctx.translate(cx, cy); ctx.rotate(rot)
  const rr = Math.min(w, h) * 0.1, x = -w / 2, y = -h / 2
  rrect(ctx, x, y, w, h, rr)
  ctx.shadowColor = `rgba(0,0,0,${dark ? 0.4 : 0.12})`; ctx.shadowBlur = 28; ctx.shadowOffsetY = 8
  const fill = ctx.createLinearGradient(x, y, x + w * 0.45, y + h * 0.45)
  if (dark) {
    fill.addColorStop(0, `rgba(255,255,255,${al * 1.6})`)
    fill.addColorStop(0.4, `rgba(${r},${g},${b},${al * 0.55})`)
    fill.addColorStop(1, `rgba(255,255,255,${al * 0.22})`)
  } else {
    fill.addColorStop(0, `rgba(255,255,255,${al * 2.5})`)
    fill.addColorStop(0.4, `rgba(${r},${g},${b},${al * 0.25})`)
    fill.addColorStop(1, `rgba(255,255,255,${al * 1.6})`)
  }
  ctx.fillStyle = fill; ctx.fill()
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
  rrect(ctx, x, y, w, h, rr)
  const edge = ctx.createLinearGradient(x, y, x + w * 0.38, y + h * 0.38)
  edge.addColorStop(0, `rgba(255,255,255,${dark ? 0.55 : 0.95})`)
  edge.addColorStop(0.28, `rgba(255,255,255,${dark ? 0.18 : 0.45})`)
  edge.addColorStop(1, 'rgba(255,255,255,0.02)')
  ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.stroke()
  ctx.restore()
}

function drawCover(ctx: Ctx, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ir = img.width / img.height
  const br = w / h
  const sw = ir > br ? img.height * br : img.width
  const sh = ir > br ? img.height : img.width / br
  const sx = (img.width - sw) / 2
  const sy = (img.height - sh) / 2
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

function simplifyPolyline(coords: [number, number][], maxPoints = 150): [number, number][] {
  if (coords.length <= maxPoints) return coords
  const step = Math.ceil(coords.length / maxPoints)
  return coords.filter((_, i) => i % step === 0 || i === coords.length - 1)
}

function getKmMarkers(
  pts: [number, number][],
  totalDistanceKm: number,
): { pt: [number, number]; label: string }[] {
  if (pts.length < 2 || totalDistanceKm <= 0) return []
  let cumDist = 0
  const cumDistances = [0]
  for (let i = 1; i < pts.length; i++) {
    const cur = pts[i], prev = pts[i - 1]
    if (!cur || !prev) continue
    const dx = cur[0] - prev[0]
    const dy = cur[1] - prev[1]
    cumDist += Math.sqrt(dx * dx + dy * dy)
    cumDistances.push(cumDist)
  }
  const totalPixels = cumDist
  const step = totalDistanceKm > 10 ? 2 : 1
  const markers: { pt: [number, number]; label: string }[] = []
  for (let km = step; km < Math.floor(totalDistanceKm); km += step) {
    const targetPx = (km / totalDistanceKm) * totalPixels
    let idx = cumDistances.findIndex(d => d >= targetPx)
    if (idx < 0) idx = pts.length - 1
    const pt = pts[idx]
    if (pt) markers.push({ pt, label: `${km}` })
  }
  return markers
}

// Route points are [lng, lat] (Garmin/GeoJSON order). Apply cosine correction so
// the projection is isometric despite varying latitude.
function projectGPS(coords: [number, number][], W: number, H: number): [number, number][] {
  const lngs = coords.map(([lng]) => lng)
  const lats = coords.map(([, lat]) => lat)
  const avgLat = lats.reduce((s, v) => s + v, 0) / lats.length
  const cos = Math.cos((avgLat * Math.PI) / 180)
  const xs = lngs.map(lng => lng * cos)
  const ys = lats.map(lat => -lat)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const pad = 0.14
  const scaleX = W * (1 - 2 * pad) / (maxX - minX || 1)
  const scaleY = H * (1 - 2 * pad) / (maxY - minY || 1)
  const scale = Math.min(scaleX, scaleY)
  const ox = W / 2 - ((minX + maxX) / 2) * scale
  const oy = H / 2 - ((minY + maxY) / 2) * scale
  return coords.map(([lng, lat]) => [lng * cos * scale + ox, -lat * scale + oy])
}

// ── Theme background functions (ported from DC HTML) ────────────────────────

export function draw_aurora(ctx: Ctx, W: number, H: number, r: number, g: number, b: number, dark: boolean) {
  ctx.fillStyle = dark ? '#050d0a' : '#f0fdf8'; ctx.fillRect(0, 0, W, H)
  glow(ctx, W, H, -W * 0.22, H * 0.12, W * 0.95, r, g, b, dark ? 0.55 : 0.18)
  glow(ctx, W, H, W * 1.18, H * 0.52, W * 0.78, r, g, b, dark ? 0.38 : 0.13)
  glow(ctx, W, H, W * 0.32, H * 1.08, W * 0.65, r, g, b, dark ? 0.28 : 0.09)
  glass(ctx, W * 0.72, H * 0.3, W * 0.82, H * 0.74, -0.36, r, g, b, dark, dark ? 0.1 : 0.38)
  glass(ctx, -W * 0.08, H * 0.76, W * 0.65, H * 0.62, 0.18, r, g, b, dark, dark ? 0.07 : 0.28)
}

export function draw_pulse(ctx: Ctx, W: number, H: number, r: number, g: number, b: number, dark: boolean) {
  ctx.fillStyle = dark ? '#040810' : '#f8fafe'; ctx.fillRect(0, 0, W, H)
  glow(ctx, W, H, W * 0.5, H * 0.5, W * 0.7, r, g, b, dark ? 0.18 : 0.07)
  const midY = H * 0.5, amp = H * 0.17, SEGS = 80, T = 15
  const wY = (i: number) => { const t2 = (i / SEGS) * Math.PI * 2.5, env = Math.sin(Math.PI * (i / SEGS)); return midY + Math.sin(t2) * amp * env * 1.5 }
  const glowPts: [number, number][] = []
  for (let i = 0; i <= SEGS; i++) glowPts.push([(i / SEGS) * W, wY(i)])
  strokeGlow(ctx, glowPts, 38, dark ? 0.75 : 0.38, r, g, b, 28)
  ctx.beginPath(); ctx.moveTo(0, wY(0) - T)
  for (let i = 1; i <= SEGS; i++) ctx.lineTo((i / SEGS) * W, wY(i) - T)
  for (let i = SEGS; i >= 0; i--) ctx.lineTo((i / SEGS) * W, wY(i) + T)
  ctx.closePath()
  const wg = ctx.createLinearGradient(0, midY - amp, 0, midY + amp)
  wg.addColorStop(0, `rgba(255,255,255,${dark ? 0.52 : 0.84})`)
  wg.addColorStop(0.3, `rgba(${r},${g},${b},${dark ? 0.28 : 0.14})`)
  wg.addColorStop(1, `rgba(255,255,255,${dark ? 0.09 : 0.42})`)
  ctx.fillStyle = wg; ctx.fill()
  ctx.beginPath(); ctx.moveTo(0, wY(0) - T + 2)
  for (let i = 1; i <= SEGS; i++) ctx.lineTo((i / SEGS) * W, wY(i) - T + 2)
  ctx.strokeStyle = `rgba(255,255,255,${dark ? 0.72 : 0.96})`; ctx.lineWidth = 1.5; ctx.stroke()
  glass(ctx, W * 0.5, H * 0.16, W * 0.84, H * 0.09, 0, r, g, b, dark, dark ? 0.09 : 0.36)
  glass(ctx, W * 0.5, H * 0.84, W * 0.84, H * 0.09, 0, r, g, b, dark, dark ? 0.09 : 0.36)
}

export function draw_terrain(ctx: Ctx, W: number, H: number, r: number, g: number, b: number, dark: boolean) {
  ctx.fillStyle = dark ? '#040a06' : '#f2faf4'; ctx.fillRect(0, 0, W, H)
  glow(ctx, W, H, W * 0.5, H * 0.92, W * 0.9, r, g, b, dark ? 0.4 : 0.16)
  const layers = [
    { pts: [[0, H * 0.55], [W * 0.18, H * 0.4], [W * 0.42, H * 0.32], [W * 0.68, H * 0.44], [W, H * 0.52]] as [number, number][], a: dark ? 0.06 : 0.22 },
    { pts: [[0, H * 0.62], [W * 0.14, H * 0.5], [W * 0.38, H * 0.4], [W * 0.62, H * 0.52], [W * 0.85, H * 0.45], [W, H * 0.6]] as [number, number][], a: dark ? 0.1 : 0.3 },
    { pts: [[0, H * 0.7], [W * 0.12, H * 0.59], [W * 0.32, H * 0.5], [W * 0.55, H * 0.61], [W * 0.78, H * 0.54], [W, H * 0.68]] as [number, number][], a: dark ? 0.14 : 0.38 },
    { pts: [[0, H * 0.77], [W * 0.1, H * 0.68], [W * 0.28, H * 0.6], [W * 0.5, H * 0.7], [W * 0.72, H * 0.63], [W, H * 0.75]] as [number, number][], a: dark ? 0.2 : 0.48 },
    { pts: [[0, H * 0.84], [W * 0.08, H * 0.75], [W * 0.25, H * 0.69], [W * 0.46, H * 0.78], [W * 0.68, H * 0.72], [W, H * 0.82]] as [number, number][], a: dark ? 0.28 : 0.6 },
  ]
  layers.forEach(layer => {
    const pts = layer.pts
    const first = pts[0], last = pts[pts.length - 1]
    if (!first || !last) return
    const ridge = () => {
      ctx.beginPath(); ctx.moveTo(first[0], first[1])
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1], cur = pts[i]
        if (!prev || !cur) continue
        const [ax, ay] = prev, [bx, by] = cur
        ctx.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2)
      }
      ctx.lineTo(last[0], last[1])
    }
    ridge(); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath()
    const fill = ctx.createLinearGradient(0, first[1] - H * 0.05, 0, H)
    fill.addColorStop(0, `rgba(${r},${g},${b},${layer.a})`)
    fill.addColorStop(0.2, `rgba(255,255,255,${layer.a * (dark ? 1.5 : 2.2)})`)
    fill.addColorStop(1, `rgba(${r},${g},${b},${layer.a * 0.45})`)
    ctx.fillStyle = fill; ctx.fill()
    ridge(); ctx.strokeStyle = `rgba(255,255,255,${dark ? layer.a * 3.2 : layer.a * 1.6})`; ctx.lineWidth = 1.5; ctx.stroke()
  })
}

export function draw_prism(ctx: Ctx, W: number, H: number, r: number, g: number, b: number, dark: boolean) {
  ctx.fillStyle = dark ? '#060408' : '#fafaf9'; ctx.fillRect(0, 0, W, H)
  glow(ctx, W, H, W * 0.62, H * 0.38, W * 0.72, r, g, b, dark ? 0.28 : 0.11)
  const shapes = [
    { pts: [[W * 0.22, 0], [W * 1.05, 0], [W * 1.05, H * 0.68], [W * 0.52, H * 0.9]] as [number, number][], al: dark ? 0.12 : 0.55 },
    { pts: [[-W * 0.05, H * 0.3], [W * 0.52, H * 0.12], [W * 0.47, H * 1.05], [-W * 0.05, H * 1.05]] as [number, number][], al: dark ? 0.09 : 0.42 },
    { pts: [[W * 0.28, -H * 0.02], [W * 0.88, -H * 0.02], [W * 0.72, H * 0.24], [W * 0.12, H * 0.4]] as [number, number][], al: dark ? 0.16 : 0.68 },
  ]
  shapes.forEach(shape => {
    const xs = shape.pts.map(p => p[0]), ys = shape.pts.map(p => p[1])
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    ctx.save()
    ctx.shadowColor = dark ? 'rgba(0,0,0,.38)' : 'rgba(0,0,0,.08)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6
    ctx.beginPath(); shape.pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath()
    const fill = ctx.createLinearGradient(x0, y0, x0 + (x1 - x0) * 0.7, y0 + (y1 - y0) * 0.7)
    fill.addColorStop(0, dark ? `rgba(255,255,255,${shape.al * 1.5})` : `rgba(255,255,255,${shape.al * 1.2})`)
    fill.addColorStop(0.38, `rgba(${r},${g},${b},${shape.al * 0.55})`)
    fill.addColorStop(1, dark ? `rgba(255,255,255,${shape.al * 0.22})` : `rgba(255,255,255,${shape.al * 0.7})`)
    ctx.fillStyle = fill; ctx.fill()
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
    ctx.beginPath(); shape.pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath()
    const edge = ctx.createLinearGradient(x0, y0, x0 + (x1 - x0) * 0.4, y0 + (y1 - y0) * 0.4)
    edge.addColorStop(0, dark ? 'rgba(255,255,255,.58)' : 'rgba(255,255,255,.96)')
    edge.addColorStop(0.3, dark ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.52)')
    edge.addColorStop(1, 'rgba(255,255,255,.02)')
    ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore()
  })
}

export function draw_cadence(ctx: Ctx, W: number, H: number, r: number, g: number, b: number, dark: boolean) {
  ctx.fillStyle = dark ? '#04090a' : '#f8fbf9'; ctx.fillRect(0, 0, W, H)
  glow(ctx, W, H, W * 0.5, H * 0.72, W * 0.78, r, g, b, dark ? 0.34 : 0.13)
  const heights = [0.42, 0.68, 0.34, 0.86, 0.55, 0.8, 0.38, 0.65, 0.42]
  const COLS = heights.length, colW = W / COLS, baseY = H * 0.84, maxH = H * 0.56
  heights.forEach((bh, idx) => {
    const bH = maxH * bh, x = idx * colW + colW * 0.15, w = colW * 0.7, y = baseY - bH, rr = w * 0.3
    if (bh > 0.6) {
      ctx.save()
      const gg = ctx.createRadialGradient(x + w / 2, y + bH * 0.25, 0, x + w / 2, y + bH * 0.25, w * 1.2)
      gg.addColorStop(0, `rgba(${r},${g},${b},${dark ? 0.55 : 0.28})`)
      gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gg; ctx.fillRect(x - w, y - w, w * 3, bH + w * 2); ctx.restore()
    }
    rrect(ctx, x, y, w, bH, rr)
    ctx.shadowColor = dark ? 'rgba(0,0,0,.3)' : 'rgba(0,0,0,.09)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4
    const bf = ctx.createLinearGradient(x, y, x, y + bH)
    bf.addColorStop(0, dark ? 'rgba(255,255,255,.24)' : 'rgba(255,255,255,.82)')
    bf.addColorStop(0.2, `rgba(${r},${g},${b},${dark ? 0.13 : 0.1})`)
    bf.addColorStop(1, dark ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.35)')
    ctx.fillStyle = bf; ctx.fill()
    rrect(ctx, x, y, w, bH, rr)
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
    const be = ctx.createLinearGradient(x, y, x + w * 0.55, y + bH * 0.42)
    be.addColorStop(0, dark ? 'rgba(255,255,255,.68)' : 'rgba(255,255,255,.96)')
    be.addColorStop(0.28, dark ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.55)')
    be.addColorStop(1, 'rgba(255,255,255,.02)')
    ctx.strokeStyle = be; ctx.lineWidth = 1.5; ctx.stroke()
  })
  ctx.beginPath(); ctx.moveTo(colW * 0.15, H * 0.84 + 3); ctx.lineTo(W - colW * 0.15, H * 0.84 + 3)
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.1)'; ctx.lineWidth = 1; ctx.stroke()
}

function drawMapStreetLabels(ctx: Ctx, W: number, H: number, dark: boolean, streetLabels: string[]) {
  if (streetLabels.length === 0) return
  ctx.save()
  ctx.font = '500 8.5px Inter,system-ui,sans-serif'
  const labelColor = dark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.38)'
  const bg = dark ? 'rgba(9,16,26,0.76)' : 'rgba(237,241,247,0.76)'
  const ph = 11, pad = 4

  // All major horizontal grid lines (every 112px), cycling through labels
  let hi = 0
  for (let y = 112; y < H; y += 112) {
    const lbl = streetLabels[hi++ % streetLabels.length]
    if (!lbl) continue
    const tw = ctx.measureText(lbl).width
    const lx = W * 0.05
    ctx.fillStyle = bg
    ctx.fillRect(lx - pad, y - ph / 2 - pad / 2, tw + pad * 2, ph + pad)
    ctx.fillStyle = labelColor
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(lbl, lx, y)
  }

  // Major vertical grid lines (every 112px, up to 3), cycling through labels in reverse
  const vPool = streetLabels.length > 1 ? [...streetLabels].reverse() : streetLabels
  let vi = 0
  for (let vX = 112; vX < W && vi < 3; vX += 112) {
    const lbl = vPool[vi % vPool.length]
    if (!lbl) continue
    const tw = ctx.measureText(lbl).width
    const labelY = H * (0.25 + (vi + 1) * 0.15)
    vi++
    ctx.save()
    ctx.translate(vX, labelY)
    ctx.rotate(-Math.PI / 2)
    ctx.fillStyle = bg
    ctx.fillRect(-tw / 2 - pad, -ph / 2 - pad / 2, tw + pad * 2, ph + pad)
    ctx.fillStyle = labelColor
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(lbl, 0, 0)
    ctx.restore()
  }

  ctx.restore()
}

function drawMapCompass(ctx: Ctx, W: number, H: number, r: number, g: number, b: number, dark: boolean) {
  const cx = W - 34, cy = H - 178
  const size = 13
  ctx.save()

  // Glass circle background
  ctx.beginPath(); ctx.arc(cx, cy, size + 6, 0, Math.PI * 2)
  ctx.fillStyle = dark ? 'rgba(0,0,0,0.62)' : 'rgba(255,255,255,0.72)'
  ctx.fill()
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)'
  ctx.lineWidth = 1; ctx.stroke()

  // North arrow (accent color, filled)
  ctx.beginPath()
  ctx.moveTo(cx, cy - size)
  ctx.lineTo(cx - 4.5, cy + 1)
  ctx.lineTo(cx, cy - 2)
  ctx.lineTo(cx + 4.5, cy + 1)
  ctx.closePath()
  ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill()

  // South arrow (muted)
  ctx.beginPath()
  ctx.moveTo(cx, cy + size)
  ctx.lineTo(cx + 4.5, cy - 1)
  ctx.lineTo(cx, cy + 2)
  ctx.lineTo(cx - 4.5, cy - 1)
  ctx.closePath()
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.2)'; ctx.fill()

  // E / W ticks
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.28)'
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(cx - size, cy); ctx.lineTo(cx - 5, cy); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx + size, cy); ctx.lineTo(cx + 5, cy); ctx.stroke()

  // "N" label
  ctx.font = '800 7px Inter,system-ui,sans-serif'
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.78)'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('N', cx, cy - size - 7)

  ctx.restore()
}

function drawKmPill(ctx: Ctx, pt: [number, number], label: string, r: number, g: number, b: number, dark: boolean) {
  ctx.save()
  ctx.font = '700 8px Inter,system-ui,sans-serif'
  const text = `${label} km`
  const tw = ctx.measureText(text).width
  const pw = tw + 10, ph = 14, prr = 7
  const px = pt[0] - pw / 2, py = pt[1] - 8 - ph - 2
  rrect(ctx, px, py, pw, ph, prr)
  ctx.fillStyle = dark ? 'rgba(9,16,26,0.84)' : 'rgba(255,255,255,0.88)'
  ctx.fill()
  rrect(ctx, px, py, pw, ph, prr)
  ctx.strokeStyle = `rgba(${r},${g},${b},0.78)`; ctx.lineWidth = 1.2; ctx.stroke()
  ctx.fillStyle = `rgba(${r},${g},${b},1)`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, pt[0], py + ph / 2)
  ctx.beginPath(); ctx.arc(pt[0], pt[1], 3, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${r},${g},${b},0.9)`; ctx.fill()
  ctx.restore()
}

function drawDepartLabel(ctx: Ctx, pt: [number, number]) {
  ctx.save()
  ctx.font = '700 8px Inter,system-ui,sans-serif'
  const tw = ctx.measureText('Départ').width
  const pw = tw + 10, ph = 14, prr = 7
  const px = pt[0] - pw / 2, py = pt[1] - 7 - ph - 4
  rrect(ctx, px, py, pw, ph, prr)
  ctx.fillStyle = '#22c55e'; ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('Départ', pt[0], py + ph / 2)
  ctx.restore()
}

export function draw_map(
  ctx: Ctx, W: number, H: number,
  r: number, g: number, b: number,
  dark: boolean,
  gpsRoute?: [number, number][] | null,
  locationName?: string | null,
  distanceKm?: number,
  streetLabels?: string[] | null,
) {
  // Background + grid
  ctx.fillStyle = dark ? '#09101a' : '#edf1f7'; ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.055)' : 'rgba(0,0,0,.07)'; ctx.lineWidth = 0.8
  for (let x = 0; x < W; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y < H; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.13)'; ctx.lineWidth = 2.2
  for (let x = 0; x < W; x += 112) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y < H; y += 112) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

  // Street labels on major grid lines
  if (streetLabels?.length) drawMapStreetLabels(ctx, W, H, dark, streetLabels)

  glow(ctx, W, H, W * 0.5, H * 0.52, W * 0.55, r, g, b, dark ? 0.22 : 0.14)

  // Watermark city name (very subtle, behind route)
  if (locationName) {
    const watermarkText = (locationName.split(',')[0] ?? locationName).toUpperCase()
    let fontSize = Math.round(W * 0.19)
    ctx.save()
    ctx.font = `800 ${fontSize}px Inter,system-ui,sans-serif`
    const measured = ctx.measureText(watermarkText).width
    const maxWidth = W * 0.95
    if (measured > maxWidth) {
      fontSize = Math.round(fontSize * maxWidth / measured)
      ctx.font = `800 ${fontSize}px Inter,system-ui,sans-serif`
    }
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(watermarkText, W / 2, H / 2)
    ctx.restore()
  }

  // GPS route
  const simplified = gpsRoute && gpsRoute.length > 1 ? simplifyPolyline(gpsRoute) : null
  const pts: [number, number][] = simplified
    ? projectGPS(simplified, W, H)
    : [
        [W * 0.22, H * 0.72], [W * 0.22, H * 0.58], [W * 0.3, H * 0.5], [W * 0.44, H * 0.5],
        [W * 0.44, H * 0.38], [W * 0.56, H * 0.3], [W * 0.68, H * 0.3], [W * 0.68, H * 0.42],
        [W * 0.56, H * 0.5], [W * 0.56, H * 0.62], [W * 0.68, H * 0.7], [W * 0.68, H * 0.78],
        [W * 0.56, H * 0.78], [W * 0.44, H * 0.7], [W * 0.22, H * 0.72],
      ]

  const first = pts[0]
  const last = pts[pts.length - 1]
  if (!first || !last) return

  const drawRoute = (lw: number, a: number, blur?: number) => {
    if (blur) { strokeGlow(ctx, pts, lw, a, r, g, b, blur); return }
    ctx.save()
    ctx.beginPath(); ctx.moveTo(first[0], first[1])
    pts.forEach(([px, py]) => ctx.lineTo(px, py))
    ctx.strokeStyle = `rgba(${r},${g},${b},${a})`; ctx.lineWidth = lw
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke()
    ctx.restore()
  }
  drawRoute(18, dark ? 0.7 : 0.45, 14)
  drawRoute(3.5, dark ? 0.95 : 0.82)

  // Km pills
  if (simplified && distanceKm && distanceKm > 0) {
    getKmMarkers(pts, distanceKm).forEach(({ pt, label }) => drawKmPill(ctx, pt, label, r, g, b, dark))
  }

  // Start dot + "Départ" label
  ctx.beginPath(); ctx.arc(first[0], first[1], 7, 0, Math.PI * 2)
  ctx.fillStyle = '#22c55e'; ctx.fill()
  ctx.beginPath(); ctx.arc(first[0], first[1], 7, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.stroke()
  drawDepartLabel(ctx, first)

  // End dot
  ctx.beginPath(); ctx.arc(last[0], last[1], 7, 0, Math.PI * 2)
  ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill()
  ctx.beginPath(); ctx.arc(last[0], last[1], 7, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.stroke()

  // Compass rose (top of stats card area, bottom right)
  drawMapCompass(ctx, W, H, r, g, b, dark)
}

export function draw_memory(ctx: Ctx, W: number, H: number, r: number, g: number, b: number, dark: boolean, photoImg?: HTMLImageElement | null) {
  if (photoImg) {
    drawCover(ctx, photoImg, 0, 0, W, H)
    const topScrim = ctx.createLinearGradient(0, 0, 0, H * 0.32)
    topScrim.addColorStop(0, 'rgba(0,0,0,0.62)'); topScrim.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = topScrim; ctx.fillRect(0, 0, W, H * 0.32)
    const botScrim = ctx.createLinearGradient(0, H * 0.52, 0, H)
    botScrim.addColorStop(0, 'rgba(0,0,0,0)'); botScrim.addColorStop(1, 'rgba(0,0,0,0.78)')
    ctx.fillStyle = botScrim; ctx.fillRect(0, H * 0.52, W, H * 0.48)
    return
  }
  // Full-bleed photo placeholder (warm golden hour gradient)
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  if (dark) {
    bg.addColorStop(0, '#1c0c06'); bg.addColorStop(0.35, '#2e1610'); bg.addColorStop(0.6, '#12160a'); bg.addColorStop(1, '#060a05')
  } else {
    bg.addColorStop(0, '#ffe4cc'); bg.addColorStop(0.35, '#ffcba4'); bg.addColorStop(0.6, '#a8c88a'); bg.addColorStop(1, '#5c7a48')
  }
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

  // Sun glow (upper-right)
  glow(ctx, W, H, W * 0.68, H * 0.22, W * 0.65, r, g, b, dark ? 0.38 : 0.28)

  // Horizon silhouette (lower third)
  ctx.fillStyle = dark ? 'rgba(0,0,0,.72)' : 'rgba(18,28,10,.48)'
  const hzY = H * 0.62
  const trees = [{ x: W * 0.08, h: 0.12, w: 0.1 }, { x: W * 0.22, h: 0.09, w: 0.08 }, { x: W * 0.48, h: 0.15, w: 0.12 }, { x: W * 0.72, h: 0.11, w: 0.09 }, { x: W * 0.88, h: 0.13, w: 0.11 }]
  trees.forEach(tr => {
    ctx.beginPath(); ctx.moveTo(tr.x, hzY)
    ctx.lineTo(tr.x - tr.w * W * 0.5, hzY - H * tr.h)
    ctx.lineTo(tr.x + tr.w * W * 0.5, hzY - H * tr.h)
    ctx.closePath(); ctx.fill()
  })

  // Subtle grid hint
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.03)'; ctx.lineWidth = 0.8
  for (let x = 0; x < W; x += 44) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y < H; y += 44) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

  // Center "Add photo" indicator
  const icW = 72, icH = 58, icX = (W - icW) / 2, icY = H * 0.38 - icH / 2
  ctx.save()
  rrect(ctx, icX - 8, icY - 8, icW + 16, icH + 16, 20)
  ctx.fillStyle = dark ? 'rgba(0,0,0,.3)' : 'rgba(255,255,255,.35)'; ctx.fill()
  rrect(ctx, icX - 8, icY - 8, icW + 16, icH + 16, 20)
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; ctx.stroke()
  // Camera body
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.65)' : 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  rrect(ctx, icX + 4, icY + 16, icW - 8, icH - 22, 6); ctx.stroke()
  // Lens
  ctx.beginPath(); ctx.arc(icX + icW / 2, icY + icH / 2 + 2, 10, 0, Math.PI * 2); ctx.stroke()
  // Viewfinder bump
  ctx.beginPath(); ctx.moveTo(icX + icW / 2 - 10, icY + 16); ctx.lineTo(icX + icW / 2 - 6, icY + 8); ctx.lineTo(icX + icW / 2 + 6, icY + 8); ctx.lineTo(icX + icW / 2 + 10, icY + 16); ctx.stroke()
  // Label
  ctx.font = '600 11px Inter,system-ui,sans-serif'
  ctx.fillStyle = dark ? 'rgba(255,255,255,.65)' : 'rgba(255,255,255,.9)'
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  ctx.fillText('Ajouter une photo', W / 2, icY + icH + 10)
  ctx.restore()

  // Bottom vignette + specular line (frosted overlay, stays on top of photo)
  const panY = H * 0.65
  ctx.save()
  const vig = ctx.createLinearGradient(0, panY - 60, 0, H)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(0.3, dark ? 'rgba(0,0,0,.55)' : 'rgba(0,0,0,.35)')
  vig.addColorStop(1, dark ? 'rgba(0,0,0,.80)' : 'rgba(0,0,0,.55)')
  ctx.fillStyle = vig; ctx.fillRect(0, panY - 60, W, H - (panY - 60))
  ctx.beginPath(); ctx.moveTo(0, panY); ctx.lineTo(W, panY)
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.stroke()
  ctx.restore()
}

// ── GPS route overlay (any design) ──────────────────────────────────────────

export function drawRouteOverlay(
  ctx: Ctx,
  W: number,
  H: number,
  route: [number, number][],
  r: number, g: number, b: number,
  dark: boolean,
) {
  // Same projection as MAP (72% fill with 14% padding), shifted to center at H*0.44
  const rawPts = projectGPS(route, W, H)
  const dy = H * 0.44 - H * 0.5
  const pts = rawPts.map(([x, y]) => [x, y + dy] as [number, number])

  const first = pts[0]
  const last = pts[pts.length - 1]
  if (!first || !last) return

  const drawRoute = (lw: number, a: number, blur?: number) => {
    if (blur) { strokeGlow(ctx, pts, lw, a, r, g, b, blur); return }
    ctx.save()
    ctx.beginPath(); ctx.moveTo(first[0], first[1])
    pts.forEach(([px, py]) => ctx.lineTo(px, py))
    ctx.strokeStyle = `rgba(${r},${g},${b},${a})`; ctx.lineWidth = lw
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke()
    ctx.restore()
  }

  drawRoute(36, dark ? 0.45 : 0.28, 24)
  drawRoute(16, dark ? 0.75 : 0.48, 10)
  drawRoute(3.5, dark ? 0.98 : 0.85)

  ctx.beginPath(); ctx.moveTo(first[0], first[1])
  pts.forEach(([px, py]) => ctx.lineTo(px, py))
  ctx.strokeStyle = `rgba(${r},${g},${b},${dark ? 0.92 : 0.78})`
  ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke()

  ctx.beginPath(); ctx.arc(first[0], first[1], 5.5, 0, Math.PI * 2)
  ctx.fillStyle = '#22c55e'; ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; ctx.stroke()

  ctx.beginPath(); ctx.arc(last[0], last[1], 5.5, 0, Math.PI * 2)
  ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; ctx.stroke()
}

// ── Branding (Zone B) ────────────────────────────────────────────────────────

export function drawBranding(ctx: Ctx, W: number, _H: number, dark: boolean) {
  ctx.save()

  const fs = 11
  const paddingTop = 135
  const edgeX = W - 14

  const col = dark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.72)'

  ctx.translate(edgeX, paddingTop)
  ctx.rotate(Math.PI / 2)

  ctx.font = `800 ${fs}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = dark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.12)'
  ctx.shadowBlur = dark ? 8 : 4
  ctx.shadowOffsetY = 2
  ctx.fillStyle = col
  ctx.globalAlpha = 1
  ctx.fillText('RUNOMICS', 0, 0)

  ctx.restore()
}

// ── Data overlay (Zone A + Zone C) ──────────────────────────────────────────

function formatShareDate(activity: Activity): string {
  const d = new Date(activity.date + 'T00:00:00')
  const day = d.toLocaleDateString(t.locale, { weekday: 'short' })
  const date = d.getDate()
  const month = d.toLocaleDateString(t.locale, { month: 'short' })
  return `${day} ${date} ${month}`
}

export function drawDataOverlay(ctx: Ctx, W: number, H: number, dark: boolean, r: number, g: number, b: number, activity: Activity, design: ShareDesign) {
  // Zone A - top-left: name + date
  ctx.save()
  ctx.font = '800 18px Inter,system-ui,sans-serif'
  ctx.fillStyle = dark ? 'rgba(255,255,255,.92)' : 'rgba(0,0,0,.88)'
  ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  ctx.fillText(shareCardTitle(activity), 26, 70)
  ctx.font = '500 12px Inter,system-ui,sans-serif'
  ctx.fillStyle = dark ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.44)'
  ctx.fillText(formatShareDate(activity), 26, 94)
  ctx.restore()

  // Zone D - hero metric centered in the card
  drawHeroMetric(ctx, W, H, dark, r, g, b, design, activity)

  // Zone C - bottom stats glass card
  const cx = 20, cy = H - 148, cw = W - 40, ch = 122, crr = 18
  ctx.save()
  rrect(ctx, cx, cy, cw, ch, crr)
  ctx.fillStyle = dark ? 'rgba(0,0,0,.52)' : 'rgba(255,255,255,.62)'
  ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4
  ctx.fill()
  rrect(ctx, cx, cy, cw, ch, crr)
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.78)'
  ctx.lineWidth = 1; ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
  ctx.stroke(); ctx.restore()

  const durationH = Math.floor(activity.durationSeconds / 3600) > 0
  const stats: { label: string; value: string; unit: string }[] = [
    { label: t.activity.shareCard.distance, value: formatDistance(activity.distanceKm), unit: t.units.km },
    { label: t.activity.shareCard.pace, value: activity.paceSecPerKm ? formatClock(activity.paceSecPerKm) : '-', unit: '/km' },
    { label: t.activity.shareCard.avgHr, value: activity.avgHeartRate ? `${activity.avgHeartRate}` : '-', unit: t.units.bpm },
    { label: t.activity.shareCard.time, value: formatDurationShort(activity.durationSeconds), unit: durationH ? 'h' : 'min' },
  ]

  const cellW = cw / 4
  stats.forEach((s, i) => {
    const scx = cx + cellW * i + cellW / 2
    ctx.save()
    ctx.font = '600 8px Inter,system-ui,sans-serif'
    ctx.fillStyle = dark ? 'rgba(255,255,255,.38)' : 'rgba(0,0,0,.35)'
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    ctx.fillText(s.label.toUpperCase(), scx, cy + 34)
    ctx.font = '800 21px Inter,system-ui,sans-serif'
    ctx.fillStyle = dark ? 'rgba(255,255,255,.93)' : 'rgba(0,0,0,.88)'
    ctx.fillText(s.value, scx, cy + 50)
    ctx.font = '600 10px Inter,system-ui,sans-serif'
    ctx.fillStyle = `rgba(${r},${g},${b},.9)`
    ctx.fillText(s.unit, scx, cy + 78)
    if (i < 3) {
      ctx.beginPath(); ctx.moveTo(cx + cellW * (i + 1), cy + 14); ctx.lineTo(cx + cellW * (i + 1), cy + ch - 14)
      ctx.strokeStyle = dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)'; ctx.lineWidth = 1; ctx.stroke()
    }
    ctx.restore()
  })
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

export function drawTheme(
  ctx: Ctx,
  theme: ShareDesign,
  W: number,
  H: number,
  r: number, g: number, b: number,
  dark: boolean,
  gpsRoute?: [number, number][] | null,
  photoImg?: HTMLImageElement | null,
  locationName?: string | null,
  distanceKm?: number,
  streetLabels?: string[] | null,
): void {
  switch (theme) {
    case 'aurora':  draw_aurora(ctx, W, H, r, g, b, dark); break
    case 'pulse':   draw_pulse(ctx, W, H, r, g, b, dark); break
    case 'terrain': draw_terrain(ctx, W, H, r, g, b, dark); break
    case 'prism':   draw_prism(ctx, W, H, r, g, b, dark); break
    case 'cadence': draw_cadence(ctx, W, H, r, g, b, dark); break
    case 'map':     draw_map(ctx, W, H, r, g, b, dark, gpsRoute, locationName, distanceKm, streetLabels); break
    case 'memory':  draw_memory(ctx, W, H, r, g, b, dark, photoImg ?? null); break
  }
}
