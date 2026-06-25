import type { ShareDesign } from '@/lib/shareCard'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

// Design-picker thumbnails are small, static decorative tiles (not live renders of the
// real activity) - cheap to draw and legible at 60x84, unlike a cropped corner of the
// full preview would be.

function AuroraThumb() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(155deg,#f0f8ff,#eff6ff)' }}>
      <div style={{ position: 'absolute', width: '130%', height: '90%', left: '-15%', top: '-25%', borderRadius: 9999, background: 'radial-gradient(circle,#93c5fd 0%,transparent 60%)', opacity: 0.55, filter: 'blur(14px)' }} />
      <div style={{ position: 'absolute', width: '110%', height: '80%', right: '-20%', top: '22%', borderRadius: 9999, background: 'radial-gradient(circle,#bae6fd 0%,transparent 60%)', opacity: 0.48, filter: 'blur(12px)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 7px' }}>
        <div style={{ background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(255,255,255,0.88)', borderRadius: 7, padding: '5px 7px', backdropFilter: 'blur(8px)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', letterSpacing: '-0.03em' }}>9.00</div>
          <div style={{ fontSize: 8, color: '#64748b', fontWeight: 500, marginTop: 1 }}>{t.units.km}</div>
        </div>
      </div>
    </div>
  )
}

function NightThumb() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(155deg,#070d20,#06091a)' }}>
      <div style={{ position: 'absolute', width: '130%', height: '90%', left: '-15%', top: '-25%', borderRadius: 9999, background: 'radial-gradient(circle,#1d4ed8 0%,transparent 60%)', opacity: 0.52, filter: 'blur(14px)' }} />
      <div style={{ position: 'absolute', width: '110%', height: '80%', right: '-20%', top: '22%', borderRadius: 9999, background: 'radial-gradient(circle,#0284c7 0%,transparent 60%)', opacity: 0.44, filter: 'blur(12px)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 7px' }}>
        <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 7, padding: '5px 7px', backdropFilter: 'blur(8px)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', letterSpacing: '-0.03em' }}>9.00</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.38)', fontWeight: 500, marginTop: 1 }}>{t.units.km}</div>
        </div>
      </div>
    </div>
  )
}

function CleanThumb() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#f8fafc' }}>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '7px 8px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.04em', lineHeight: 1 }}>9.00</div>
        <div style={{ fontSize: 8, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>{t.units.km}</div>
        <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', margin: '4px 0' }} />
        <div style={{ fontSize: 10, fontWeight: 700, color: '#334155', letterSpacing: '-0.025em' }}>54:33</div>
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

const THUMBS: Record<ShareDesign, () => React.JSX.Element> = {
  aurora: AuroraThumb,
  night: NightThumb,
  clean: CleanThumb,
  map: MapThumb,
  memory: MemoryThumb,
}

export function DesignThumb({ design, selected, accentHex, onClick }: {
  design: ShareDesign; selected: boolean; accentHex: string; onClick: () => void
}) {
  const Thumb = THUMBS[design]
  return (
    <button type="button" onClick={onClick} className="flex shrink-0 flex-col items-center gap-1.5">
      <div style={{
        width: 60, height: 84, borderRadius: 13, overflow: 'hidden', position: 'relative',
        border: selected ? `2px solid ${accentHex}` : '2px solid transparent',
        boxShadow: selected ? `0 0 0 2px ${accentHex}55, 0 4px 12px rgba(0,0,0,0.24)` : '0 2px 6px rgba(0,0,0,0.18)',
        transition: 'border 0.18s, box-shadow 0.18s',
      }}>
        <Thumb />
      </div>
      <span className={cn('text-[11px] transition-colors', selected ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground')}>
        {t.activity.shareCard.designLabels[design]}
      </span>
    </button>
  )
}
