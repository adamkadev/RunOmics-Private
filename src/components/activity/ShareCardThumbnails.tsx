'use client'

import { useEffect, useRef } from 'react'
import type { AccentId } from '@/lib/accent'
import { ACCENT_RGB, type ShareDesign, type ThemeMode } from '@/lib/shareCard'
import { drawTheme } from '@/lib/shareCardDraw'
import { useShareCardMap } from '@/lib/useShareCardMap'
import { cn } from '@/lib/utils'
import { SHARE_CARD_COLORS } from '@/lib/colors'
import { withAlpha } from '@/lib/palette'
import { t } from '@/i18n'

// Thumbnails render at 390x390 (square crop of the design) and display at THUMB_SIZE via CSS.
const THUMB_CANVAS = 390
export const THUMB_SIZE = 104

interface ThemeCardProps {
  design: ShareDesign
  accent: AccentId
  theme: ThemeMode
  selected: boolean
  accentHex: string
  onClick: () => void
  gpsRoute?: [number, number][] | null
  // Memory design only: object URL of the chosen photo (preview), or null for the placeholder.
  photoUrl?: string | null
  customRgb?: [number, number, number]
}

export function ThemeCard({ design, accent, theme, selected, accentHex, onClick, gpsRoute, photoUrl, customRgb }: ThemeCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const showPhoto = design === 'memory' && !!photoUrl
  // The square thumbnail gets its own render rather than a crop of the tall
  // one: the fit is per aspect ratio, and so is the projected trace.
  const { image: mapImage, points: mapPoints, failed: mapFailed } = useShareCardMap({
    route: gpsRoute,
    theme,
    width: THUMB_CANVAS,
    height: THUMB_CANVAS,
    enabled: design === 'route',
  })

  useEffect(() => {
    if (showPhoto) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dark = theme === 'dark'
    const [r, g, b] = customRgb ?? ACCENT_RGB[accent][dark ? 'dark' : 'light']
    canvas.width = THUMB_CANVAS
    canvas.height = THUMB_CANVAS
    // Map and route themes get the real GPS route; memory gets no photo here
    // (the camera placeholder), since the picked one renders as an <img>.
    drawTheme(ctx, design, THUMB_CANVAS, THUMB_CANVAS, r, g, b, dark, {
      gpsRoute: design === 'map' || design === 'route' ? gpsRoute : null,
      mapImage,
      mapPoints,
      mapFailed,
    })
  }, [showPhoto, design, accent, theme, gpsRoute, customRgb, mapImage, mapPoints, mapFailed])

  return (
    <button type="button" onClick={onClick} className="flex shrink-0 flex-col items-center gap-1.5">
      <div
        style={{
          width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 18, overflow: 'hidden', position: 'relative',
          border: selected ? `2px solid ${accentHex}cc` : '2px solid color-mix(in srgb, var(--ro-text) 12%, transparent)',
          boxShadow: selected ? `0 0 0 2px ${withAlpha(accentHex, SHARE_CARD_COLORS.thumbRingAlpha)}, var(--shadow-thumb)` : 'var(--shadow-thumb)',
          transition: 'border 0.18s, box-shadow 0.18s',
        }}
      >
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl!} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />
        )}
      </div>
      <span
        className={cn('text-caption font-bold tracking-wide transition-colors uppercase', !selected && 'text-muted-foreground/60')}
        style={selected ? { color: accentHex } : undefined}
      >
        {t.activity.shareCard.designLabels[design]}
      </span>
    </button>
  )
}

// Marks the paradigm shift between generated themes and the user's own photo.
export function ThemeDivider({ label }: { label: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5 px-0.5" style={{ width: 44 }}>
      <div className="flex items-center justify-center" style={{ height: THUMB_SIZE }}>
        <div style={{ width: 1, height: '100%', background: 'color-mix(in srgb, var(--ro-text) 14%, transparent)' }} />
      </div>
      <span className="text-center text-caption font-semibold leading-tight tracking-wide text-muted-foreground/50">
        {label}
      </span>
    </div>
  )
}
