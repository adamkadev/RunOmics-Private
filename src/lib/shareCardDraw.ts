import type { Activity } from '@/domain/activity/types'
import { formatClock, formatDistance, formatDurationShort } from '@/lib/formatters'
import { shareCardTitle } from '@/lib/shareCardStats'
import type { ShareDesign } from '@/lib/shareCardPalette'
import { t } from '@/i18n'

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
  ctx.filter = `blur(${Math.round(radius * 0.22)}px)`
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
  grd.addColorStop(0, `rgba(${r},${g},${b},${alpha})`)
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, W, H)
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

function projectGPS(coords: [number, number][], W: number, H: number): [number, number][] {
  const lats = coords.map(c => c[0])
  const lngs = coords.map(c => c[1])
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const pad = 0.14
  return coords.map(([lat, lng]) => [
    W * (pad + (1 - 2 * pad) * (lng - minLng) / (maxLng - minLng || 1)),
    H * (pad + (1 - 2 * pad) * (1 - (lat - minLat) / (maxLat - minLat || 1))),
  ])
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
  ctx.save(); ctx.filter = 'blur(28px)'
  ctx.beginPath(); ctx.moveTo(0, wY(0))
  for (let i = 1; i <= SEGS; i++) ctx.lineTo((i / SEGS) * W, wY(i))
  ctx.strokeStyle = `rgba(${r},${g},${b},${dark ? 0.75 : 0.38})`; ctx.lineWidth = 38; ctx.stroke(); ctx.restore()
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
    const pts = layer.pts, last = pts[pts.length - 1]
    const ridge = () => {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i]
        ctx.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2)
      }
      ctx.lineTo(last[0], last[1])
    }
    ridge(); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath()
    const fill = ctx.createLinearGradient(0, pts[0][1] - H * 0.05, 0, H)
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
      ctx.save(); ctx.filter = `blur(${w * 0.55}px)`
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

export function draw_map(ctx: Ctx, W: number, H: number, r: number, g: number, b: number, dark: boolean, gpsRoute?: [number, number][] | null) {
  ctx.fillStyle = dark ? '#09101a' : '#edf1f7'; ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.055)' : 'rgba(0,0,0,.07)'; ctx.lineWidth = 0.8
  for (let x = 0; x < W; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y < H; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.13)'; ctx.lineWidth = 2.2
  for (let x = 0; x < W; x += 112) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y < H; y += 112) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  glow(ctx, W, H, W * 0.5, H * 0.52, W * 0.55, r, g, b, dark ? 0.22 : 0.14)

  const pts: [number, number][] = gpsRoute && gpsRoute.length > 1
    ? projectGPS(gpsRoute, W, H)
    : [
        [W * 0.22, H * 0.72], [W * 0.22, H * 0.58], [W * 0.3, H * 0.5], [W * 0.44, H * 0.5],
        [W * 0.44, H * 0.38], [W * 0.56, H * 0.3], [W * 0.68, H * 0.3], [W * 0.68, H * 0.42],
        [W * 0.56, H * 0.5], [W * 0.56, H * 0.62], [W * 0.68, H * 0.7], [W * 0.68, H * 0.78],
        [W * 0.56, H * 0.78], [W * 0.44, H * 0.7], [W * 0.22, H * 0.72],
      ]

  const drawRoute = (lw: number, a: number, blur?: number) => {
    if (blur) { ctx.save(); ctx.filter = `blur(${blur}px)` }
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1])
    pts.forEach(([px, py]) => ctx.lineTo(px, py))
    ctx.strokeStyle = `rgba(${r},${g},${b},${a})`; ctx.lineWidth = lw
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke()
    if (blur) ctx.restore()
  }
  drawRoute(18, dark ? 0.7 : 0.45, 14)
  drawRoute(3.5, dark ? 0.95 : 0.82)
  ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 7, 0, Math.PI * 2)
  ctx.fillStyle = '#22c55e'; ctx.fill()
  ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 7, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.stroke()
  ctx.beginPath(); ctx.arc(pts[pts.length - 1][0], pts[pts.length - 1][1], 7, 0, Math.PI * 2)
  ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill()
  ctx.beginPath(); ctx.arc(pts[pts.length - 1][0], pts[pts.length - 1][1], 7, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.stroke()
}

export function draw_memory(ctx: Ctx, W: number, H: number, r: number, g: number, b: number, dark: boolean, photoImg?: HTMLImageElement | null) {
  if (photoImg) {
    drawCover(ctx, photoImg, 0, 0, W, H * 0.62)
    const topScrim = ctx.createLinearGradient(0, 0, 0, H * 0.22)
    topScrim.addColorStop(0, 'rgba(0,0,0,0.52)'); topScrim.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = topScrim; ctx.fillRect(0, 0, W, H * 0.22)
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.62)
    if (dark) { sky.addColorStop(0, '#1a0a05'); sky.addColorStop(0.5, '#2e1610'); sky.addColorStop(1, '#0a0806') }
    else { sky.addColorStop(0, '#ffecd8'); sky.addColorStop(0.5, '#ffcba4'); sky.addColorStop(1, '#f0a87c') }
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.62)
    const gnd = ctx.createLinearGradient(0, H * 0.56, 0, H)
    if (dark) { gnd.addColorStop(0, '#060a07'); gnd.addColorStop(1, '#020402') }
    else { gnd.addColorStop(0, '#88a870'); gnd.addColorStop(1, '#5c7a48') }
    ctx.fillStyle = gnd; ctx.fillRect(0, H * 0.56, W, H * 0.44)
    glow(ctx, W, H * 0.62, W * 0.62, H * 0.28, W * 0.5, r, g, b, dark ? 0.32 : 0.25)
    ctx.fillStyle = dark ? 'rgba(0,0,0,.68)' : 'rgba(18,28,10,.5)'
    const trees = [{ x: W * 0.12, h: 0.18, w: 0.12 }, { x: W * 0.28, h: 0.12, w: 0.09 }, { x: W * 0.55, h: 0.22, w: 0.14 }, { x: W * 0.78, h: 0.16, w: 0.1 }]
    trees.forEach(tr => {
      ctx.beginPath(); ctx.moveTo(tr.x, H * 0.62)
      ctx.lineTo(tr.x - tr.w * W * 0.5, H * (1 - tr.h) * 0.62 + H * 0.62 * tr.h)
      ctx.lineTo(tr.x + tr.w * W * 0.5, H * (1 - tr.h) * 0.62 + H * 0.62 * tr.h)
      ctx.closePath(); ctx.fill()
    })
  }
  const panY = H * 0.6
  const pan = ctx.createLinearGradient(0, panY, 0, H)
  pan.addColorStop(0, dark ? 'rgba(4,8,6,.78)' : 'rgba(255,255,255,.78)')
  pan.addColorStop(1, dark ? 'rgba(2,4,2,.92)' : 'rgba(255,255,255,.9)')
  ctx.fillStyle = pan; ctx.fillRect(0, panY, W, H - panY)
  ctx.beginPath(); ctx.moveTo(0, panY); ctx.lineTo(W, panY)
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.24)' : 'rgba(255,255,255,.92)'; ctx.lineWidth = 1.5; ctx.stroke()
}

// ── Branding (Zone B) ────────────────────────────────────────────────────────

export function drawBranding(ctx: Ctx, W: number, _H: number, dark: boolean) {
  ctx.save()
  const alpha = dark ? 0.76 : 0.62
  const col = dark ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`
  ctx.strokeStyle = col; ctx.fillStyle = col
  ctx.lineWidth = 1.35; ctx.lineCap = 'round'
  ctx.font = '700 10px Inter,system-ui,sans-serif'
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
  const tw = ctx.measureText('RUNOMICS').width
  const gap = 5, iW = 14, rx = W - 20, ry = 27
  const ix = rx - tw - gap - iW, cx2 = ix + iW / 2
  ctx.beginPath(); ctx.ellipse(cx2, ry - 4, iW / 2, 2.2, 0, Math.PI, 0, false); ctx.stroke()
  ctx.beginPath(); ctx.ellipse(cx2, ry, iW / 2, 2.2, 0, Math.PI, 0, false); ctx.stroke()
  ctx.beginPath(); ctx.ellipse(cx2, ry + 4, iW / 2, 2.2, 0, 0, Math.PI, false); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(ix, ry - 4); ctx.lineTo(ix, ry + 4); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(ix + iW, ry - 4); ctx.lineTo(ix + iW, ry + 4); ctx.stroke()
  ctx.fillText('RUNOMICS', rx, ry)
  ctx.restore()
}

// ── Data overlay (Zone A + Zone C) ──────────────────────────────────────────

function formatShareDate(activity: Activity): string {
  const d = new Date(activity.date + 'T00:00:00')
  const day = d.toLocaleDateString('en-US', { weekday: 'short' })
  const date = d.getDate()
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  return `${day} ${date} ${month}`
}

export function drawDataOverlay(ctx: Ctx, W: number, H: number, dark: boolean, r: number, g: number, b: number, activity: Activity) {
  // Zone A - top-left: name + date
  ctx.save()
  ctx.font = '800 18px Inter,system-ui,sans-serif'
  ctx.fillStyle = dark ? 'rgba(255,255,255,.92)' : 'rgba(0,0,0,.88)'
  ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  ctx.fillText(shareCardTitle(activity), 26, 32)
  ctx.font = '500 12px Inter,system-ui,sans-serif'
  ctx.fillStyle = dark ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.44)'
  ctx.fillText(formatShareDate(activity), 26, 56)
  ctx.restore()

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
    ctx.fillText(s.label.toUpperCase(), scx, cy + 18)
    ctx.font = '800 21px Inter,system-ui,sans-serif'
    ctx.fillStyle = dark ? 'rgba(255,255,255,.93)' : 'rgba(0,0,0,.88)'
    ctx.fillText(s.value, scx, cy + 34)
    ctx.font = '600 10px Inter,system-ui,sans-serif'
    ctx.fillStyle = `rgba(${r},${g},${b},.9)`
    ctx.fillText(s.unit, scx, cy + 62)
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
): void {
  switch (theme) {
    case 'aurora':  draw_aurora(ctx, W, H, r, g, b, dark); break
    case 'pulse':   draw_pulse(ctx, W, H, r, g, b, dark); break
    case 'terrain': draw_terrain(ctx, W, H, r, g, b, dark); break
    case 'prism':   draw_prism(ctx, W, H, r, g, b, dark); break
    case 'cadence': draw_cadence(ctx, W, H, r, g, b, dark); break
    case 'map':     draw_map(ctx, W, H, r, g, b, dark, gpsRoute); break
    case 'memory':  draw_memory(ctx, W, H, r, g, b, dark, photoImg ?? null); break
  }
}
