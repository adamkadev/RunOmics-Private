'use client'

import { useEffect, useRef } from 'react'
import type { AccentId } from '@/lib/accent'
import { ACCENT_RGB, type ShareDesign, type ThemeMode } from '@/lib/shareCard'
import { drawTheme } from '@/lib/shareCardDraw'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

// Thumbnails render at 390x390 (square crop of the design) and display at THUMB_SIZE via CSS.
// Each canvas re-renders whenever accent, theme, or design changes.
const THUMB_CANVAS = 390
export const THUMB_SIZE = 84

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
  // Memory shows the chosen photo once picked, otherwise the camera placeholder canvas.
  const showPhoto = design === 'memory' && !!photoUrl

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
    // For map theme: include real GPS route; for memory: no photo (camera placeholder).
    drawTheme(ctx, design, THUMB_CANVAS, THUMB_CANVAS, r, g, b, dark, design === 'map' ? gpsRoute : null, null)
  }, [showPhoto, design, accent, theme, gpsRoute, customRgb])

  return (
    <button type="button" onClick={onClick} className="flex shrink-0 flex-col items-center gap-1.5">
      <div
        style={{
          width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 18, overflow: 'hidden', position: 'relative',
          border: selected ? `2px solid ${accentHex}cc` : '2px solid rgba(255,255,255,0.12)',
          boxShadow: selected ? `0 0 0 2px ${accentHex}55, 0 4px 12px rgba(0,0,0,0.45)` : '0 4px 12px rgba(0,0,0,0.45)',
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
        className={cn('text-[10.5px] font-bold tracking-wide transition-colors uppercase', !selected && 'text-muted-foreground/60')}
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
        <div style={{ width: 1, height: '100%', background: 'rgba(255,255,255,0.14)' }} />
      </div>
      <span className="text-center text-[9px] font-semibold leading-tight tracking-wide text-muted-foreground/50">
        {label}
      </span>
    </div>
  )
}
