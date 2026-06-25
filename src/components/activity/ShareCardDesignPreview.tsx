'use client'

import { useId } from 'react'
import { ImagePlus, Map as MapIcon } from 'lucide-react'
import type { Activity } from '@/domain/activity/types'
import { buildStatItems, projectRouteToCircle, routePathD, shareCardTitle, type MapStyle, type ShareDesign } from '@/lib/shareCard'
import { formatDateWithYear } from '@/lib/formatters'
import type { AccentId } from '@/lib/accent'
import { t } from '@/i18n'
import { ACCENT_TOKENS, getDesignConfig } from '@/components/activity/shareCardDesignTokens'

export const PREVIEW_WIDTH = 258
export const PREVIEW_HEIGHT = 368

function BlobAnimation() {
  return (
    <style>{`
      @keyframes ro-aurora {
        0% { transform: translate3d(0,0,0) scale(1); }
        50% { transform: translate3d(4%,-3%,0) scale(1.12); }
        100% { transform: translate3d(0,0,0) scale(1); }
      }
      @keyframes ro-aurora2 {
        0% { transform: translate3d(0,0,0) scale(1.05); }
        50% { transform: translate3d(-5%,4%,0) scale(1); }
        100% { transform: translate3d(0,0,0) scale(1.05); }
      }
    `}</style>
  )
}

interface Props {
  activity: Activity
  design: ShareDesign
  accent: AccentId
  showMap: boolean
  photoUrl?: string | null
  onPickPhoto?: () => void
  mapSnapshotUrl?: string | null
  mapLoading?: boolean
  mapStyle?: MapStyle
}

export function DesignPreview({ activity, design, accent, showMap, photoUrl, onPickPhoto, mapSnapshotUrl, mapLoading, mapStyle }: Props) {
  const clipId = useId()
  const baseConfig = getDesignConfig(design, accent)
  const isMapBg = design === 'map'
  const isMemory = design === 'memory'
  // Day basemap: skip the accent theme entirely for the overlay text, go plain white.
  // isLight: true also flips the brand badge to a dark glass pill, since the bright
  // basemap would otherwise leave the white-tinted pill (and its white text) unreadable.
  const config = isMapBg && mapStyle === 'light' ? { ...baseConfig, accentColor: '#ffffff', routeColor: '#ffffff', isLight: true } : baseConfig
  const effectiveShowMap = showMap || isMapBg
  const barColor = ACCENT_TOKENS[accent].barColor

  const hasRoute = !!activity.route && activity.route.length > 1
  const routePoints = hasRoute ? projectRouteToCircle(activity.route!, 100, 100, 88 * 1.56) : null
  const stats = buildStatItems(activity).slice(0, 4)

  const hasBgImage = (isMemory && !!photoUrl) || (isMapBg && !!mapSnapshotUrl)
  // Image-background designs (Map, Memory) keep their overlays small, so the map/photo stays visible.
  const isOverlayStyle = isMapBg || isMemory
  const topScrimHeight = isOverlayStyle ? 64 : 175
  const bottomScrimHeight = isOverlayStyle ? 100 : 265
  const topScrimPeakOpacity = isOverlayStyle ? 0.55 : 0.80
  const bottomScrimPeakOpacity = isOverlayStyle ? 0.62 : 0.92

  return (
    <>
      <BlobAnimation />
      <div
        className="relative overflow-hidden rounded-[22px]"
        style={{
          width: PREVIEW_WIDTH,
          height: PREVIEW_HEIGHT,
          background: hasBgImage ? 'transparent' : config.bg,
          boxShadow: '0 20px 56px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(255,255,255,0.08)',
        }}
      >
        {/* Photo background (Memory with photo) */}
        {isMemory && photoUrl && (
          <img src={photoUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {/* Photo placeholder (Memory without photo) */}
        {isMemory && !photoUrl && onPickPhoto && (
          <button
            onClick={onPickPhoto}
            style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <ImagePlus size={28} color="rgba(255,255,255,0.45)" strokeWidth={1.5} />
            <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.45)' }}>{t.activity.shareCard.choosePhoto}</span>
          </button>
        )}
        {/* Map background (Map design) */}
        {isMapBg && mapSnapshotUrl && (
          <img src={mapSnapshotUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {isMapBg && !mapSnapshotUrl && mapLoading && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MapIcon size={26} color="rgba(255,255,255,0.3)" strokeWidth={1.5} className="animate-pulse" />
          </div>
        )}

        {/* Top accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: barColor, zIndex: 10 }} />

        {/* Extra dark corner behind the badge, so it stays legible on bright (Day) basemaps */}
        {isMapBg && (
          <div style={{ position: 'absolute', top: 0, right: 0, width: 90, height: 90, background: 'radial-gradient(circle at 100% 0%, rgba(0,0,0,0.7) 0%, transparent 70%)', zIndex: 11 }} />
        )}

        {/* Branding badge - Map's photographic background varies more in brightness than the
            other designs' controlled gradients, so its pill needs a more opaque glass */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            right: 0,
            width: 22,
            height: 90,
            background: config.isLight ? `rgba(15,23,42,${isMapBg ? 0.32 : 0.07})` : `rgba(255,255,255,${isMapBg ? 0.32 : 0.14})`,
            backdropFilter: 'blur(20px) saturate(1.6)',
            borderBottomLeftRadius: 9,
            borderLeft: '0.5px solid',
            borderBottom: '0.5px solid',
            borderTop: '0.5px solid',
            borderColor: config.isLight ? `rgba(15,23,42,${isMapBg ? 0.45 : 0.12})` : `rgba(255,255,255,${isMapBg ? 0.45 : 0.24})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 12,
          }}
        >
          <span
            style={{
              writingMode: 'vertical-lr',
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: '0.14em',
              color: config.brandColor,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            RunOmics
          </span>
        </div>

        {/* Blobs (Aurora/Night only) */}
        {config.showBlobs && (
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                width: '95%',
                height: '95%',
                left: '-28%',
                top: '-30%',
                borderRadius: 9999,
                filter: 'blur(38px)',
                background: `radial-gradient(circle, ${config.blob1} 0%, transparent 60%)`,
                opacity: config.blob1Op,
                animation: 'ro-aurora 16s ease-in-out infinite',
              }}
            />
            <div
              style={{
                position: 'absolute',
                width: '85%',
                height: '85%',
                right: '-28%',
                top: '15%',
                borderRadius: 9999,
                filter: 'blur(32px)',
                background: `radial-gradient(circle, ${config.blob2} 0%, transparent 60%)`,
                opacity: config.blob2Op,
                animation: 'ro-aurora2 20s ease-in-out infinite',
              }}
            />
          </div>
        )}

        {/* Scrims (Memory photo or Map background, for legibility) */}
        {hasBgImage && (
          <>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: topScrimHeight, background: `linear-gradient(180deg, rgba(0,0,0,${topScrimPeakOpacity}) 0%, rgba(0,0,0,0) 100%)`, zIndex: 1 }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: bottomScrimHeight, background: `linear-gradient(0deg, rgba(0,0,0,${bottomScrimPeakOpacity}) 0%, rgba(0,0,0,0) 100%)`, zIndex: 1 }} />
          </>
        )}

        {/* Card content */}
        <div style={{ position: 'absolute', inset: 0, padding: 17, display: 'flex', flexDirection: 'column', zIndex: 2 }}>
          {/* Top: title */}
          <div style={{ marginBottom: 0, paddingRight: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: config.titleColor, letterSpacing: '-0.025em', lineHeight: 1.2 }}>{shareCardTitle(activity)}</div>
            <div style={{ fontSize: 10, fontWeight: 500, color: config.subtitleColor, marginTop: 2, letterSpacing: '0.01em' }}>{formatDateWithYear(activity.date)}</div>
          </div>

          {/* Map circle (not for the full-bleed Map design, which shows the route on the map itself) */}
          {!isMapBg && effectiveShowMap && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '2px 0 8px' }}>
              <svg viewBox="0 0 200 200" style={{ width: 172, height: 172 }} overflow="visible">
                <defs>
                  <clipPath id={clipId}><circle cx="100" cy="100" r={88 * 0.88} /></clipPath>
                </defs>
                <circle cx="100" cy="100" r="88" fill={config.mapCircleBg} />
                {routePoints && (
                  <path d={routePathD(routePoints)} fill="none" stroke={config.routeColor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#${clipId})`} />
                )}
              </svg>
            </div>
          )}

          {/* Spacer if no map circle */}
          {(isMapBg || !effectiveShowMap) && <div style={{ flex: 1 }} />}

          {/* Stats: hero distance + secondary line directly on the scrim for Map/Memory (no card, so the map/photo stays visible), full glass card otherwise */}
          {isOverlayStyle ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.04em', color: config.accentColor }}>{stats[0].value}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: config.statsLabelColor }}>{t.units.km}</span>
              </div>
              {stats.length > 1 && (
                <div style={{ fontSize: 11, fontWeight: 600, color: config.statsLabelColor, marginTop: 2 }}>
                  {stats.slice(1).map((s) => s.value).join('   ·   ')}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                background: config.statsBg,
                border: `1px solid ${config.statsBorder}`,
                backdropFilter: 'blur(18px) saturate(1.4)',
                borderRadius: 14,
                padding: '11px 13px',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px 6px' }}>
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <div
                      style={{
                        fontSize: stat.big ? 22 : 15,
                        fontWeight: stat.big ? 800 : 700,
                        letterSpacing: stat.big ? '-0.045em' : '-0.03em',
                        lineHeight: stat.big ? 1 : 1.15,
                        color: stat.big ? config.accentColor : config.statsPrimaryColor,
                      }}
                    >
                      {stat.value}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: config.statsLabelColor, marginTop: 2 }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
