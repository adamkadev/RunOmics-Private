'use client'

import Image from 'next/image'
import type { AccentId } from '@/lib/accent'
import { isTexturedDesign, texturedBgPath, type ShareDesign, type ThemeMode } from '@/lib/shareCard'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

// Design-picker thumbnails are small, static decorative tiles (not live renders of the
// real activity) - cheap to draw and legible at 60x84, unlike a cropped corner of the
// full preview would be.

function TexturedThumb({ design, accent, theme }: { design: 'facets' | 'grain' | 'topographic'; accent: AccentId; theme: ThemeMode }) {
  const isLight = theme === 'light'
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Image src={texturedBgPath(design, accent, theme)} alt="" fill style={{ objectFit: 'cover', objectPosition: 'top' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 7px' }}>
        <div
          style={{
            background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.08)',
            border: `1px solid ${isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.13)'}`,
            borderRadius: 7,
            padding: '5px 7px',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: isLight ? '#0f172a' : '#60a5fa', letterSpacing: '-0.03em' }}>9.00</div>
          <div style={{ fontSize: 8, color: isLight ? '#94a3b8' : 'rgba(255,255,255,0.38)', fontWeight: 500, marginTop: 1 }}>{t.units.km}</div>
        </div>
      </div>
    </div>
  )
}

function MapThumb() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(170deg,#0b1424 0%,#0f172a 100%)' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 60 84">
        <g stroke="rgba(255,255,255,0.08)" strokeWidth="0.6">
          <path d="M0,20 H60 M0,40 H60 M0,60 H60" />
          <path d="M15,0 V84 M30,0 V84 M45,0 V84" />
        </g>
        <path d="M8,70 C16,55 14,40 24,34 C34,28 30,16 44,10" fill="none" stroke="#60a5fa" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '5px 7px', background: 'linear-gradient(0deg,rgba(15,23,42,0.95) 0%,transparent 100%)' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#60a5fa', letterSpacing: '-0.01em' }}>9.00 {t.units.km}</span>
      </div>
    </div>
  )
}

function MemoryThumb() {
  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(145deg,#1e1b4b 0%,#312e81 45%,#1e3a5f 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
      }}
    >
      <svg width="20" height="18" viewBox="0 0 36 32" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="6" width="34" height="24" rx="3" />
        <circle cx="18" cy="18" r="6" />
        <path d="M13 6l2.5-5h5L23 6" />
      </svg>
      <span style={{ fontSize: 8, fontWeight: 500, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.3, padding: '0 5px' }}>{t.activity.shareCard.galleryPlaceholder}</span>
    </div>
  )
}

export function DesignThumb({ design, accent, theme, selected, accentHex, onClick }: {
  design: ShareDesign; accent: AccentId; theme: ThemeMode; selected: boolean; accentHex: string; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="flex shrink-0 flex-col items-center gap-1.5">
      <div style={{
        width: 60, height: 84, borderRadius: 13, overflow: 'hidden', position: 'relative',
        border: selected ? `2px solid ${accentHex}` : '2px solid transparent',
        boxShadow: selected ? `0 0 0 2px ${accentHex}55, 0 4px 12px rgba(0,0,0,0.24)` : '0 2px 6px rgba(0,0,0,0.18)',
        transition: 'border 0.18s, box-shadow 0.18s',
      }}>
        {isTexturedDesign(design) ? <TexturedThumb design={design} accent={accent} theme={theme} /> : design === 'map' ? <MapThumb /> : <MemoryThumb />}
      </div>
      <span className={cn('text-caption transition-colors', selected ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground')}>
        {t.activity.shareCard.designLabels[design]}
      </span>
    </button>
  )
}
