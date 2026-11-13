'use client'

import { useLayoutEffect, useRef, useState } from 'react'

/** Below 28 pt a large title reads as a card title: the short name takes over instead. */
export const TITLE_FLOOR_PX = 28

/** A text's width at the title's own size: glyphs scale with the size, letter-spacing does not. */
export interface TitleRun {
  glyphs: number
  spacing: number
}

export interface TitleFit {
  short: boolean
  /** null keeps the title's own size. */
  px: number | null
}

function sizeFor(room: number, sizePx: number, run: TitleRun): number | null {
  if (run.glyphs + run.spacing <= room) return null
  return Math.floor((sizePx * (room - run.spacing)) / run.glyphs)
}

export function titleFit(room: number, sizePx: number, full: TitleRun, short: TitleRun): TitleFit {
  const fullPx = sizeFor(room, sizePx, full)
  if (fullPx === null || fullPx >= TITLE_FLOOR_PX) return { short: false, px: fullPx }
  const shortPx = sizeFor(room, sizePx, short)
  return { short: true, px: shortPx === null ? null : Math.max(TITLE_FLOOR_PX, shortPx) }
}

/** The page title on one line: a size down to fit, then the short name, and only then cut short. */
export function FitTitle({ text, short = text }: { text: string; short?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [fit, setFit] = useState<TitleFit>({ short: false, px: null })

  useLayoutEffect(() => {
    const line = ref.current?.parentElement
    if (!line) return
    let live = true
    const measure = () => {
      if (!live || line.clientWidth === 0) return
      const style = getComputedStyle(line)
      const probe = document.createElement('span')
      Object.assign(probe.style, {
        position: 'absolute',
        visibility: 'hidden',
        whiteSpace: 'pre',
        letterSpacing: '0',
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
      })
      document.body.appendChild(probe)
      const spacing = parseFloat(style.letterSpacing) || 0
      const run = (s: string): TitleRun => {
        probe.textContent = s
        return { glyphs: probe.getBoundingClientRect().width, spacing: spacing * s.length }
      }
      const next = titleFit(line.clientWidth, parseFloat(style.fontSize), run(text), run(short))
      probe.remove()
      setFit((prev) => (prev.short === next.short && prev.px === next.px ? prev : next))
    }
    measure()
    // Measured in the fallback font until the web font is in.
    void document.fonts?.ready.then(measure)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(line)
    return () => {
      live = false
      observer?.disconnect()
    }
  }, [text, short])

  return (
    <span ref={ref} style={fit.px !== null ? { fontSize: fit.px } : undefined}>
      {fit.short ? short : text}
    </span>
  )
}
