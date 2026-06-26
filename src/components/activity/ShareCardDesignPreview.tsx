'use client'

import { useId } from 'react'
import Image from "next/image";
import { ImagePlus, Map as MapIcon, Pencil } from 'lucide-react'
import type { Activity } from '@/domain/activity/types'
import {
  BRAND_MARK_SRC, buildStatItems, isTexturedDesign, projectRouteToCircle, routePathD,
  shareCardTitle, texturedBgPath, type MapStyle, type ShareDesign, type ThemeMode,
} from '@/lib/shareCard'
import { formatDateWithYear } from '@/lib/formatters'
import type { AccentId } from '@/lib/accent'
import { t } from '@/i18n'
import { ACCENT_TOKENS, getDesignConfig } from '@/components/activity/shareCardDesignTokens'

export const PREVIEW_WIDTH = 258
export const PREVIEW_HEIGHT = 368

interface Props {
  activity: Activity
  design: ShareDesign
  accent: AccentId
  theme: ThemeMode
  showMap: boolean
  photoUrl?: string | null
  onPickPhoto?: () => void
  mapSnapshotUrl?: string | null
  mapLoading?: boolean
  mapStyle?: MapStyle
}

export function DesignPreview({ activity, design, accent, theme, showMap, photoUrl, onPickPhoto, mapSnapshotUrl, mapLoading, mapStyle }: Props) {
  const clipId = useId()
  const baseConfig = getDesignConfig(design, accent, theme)
  const isMapBg = design === 'map'
  const isMemory = design === 'memory'
  const isTextured = isTexturedDesign(design)
  // Day basemap: skip the accent theme entirely for the overlay text, go plain white.
  const config = isMapBg && mapStyle === 'light' ? { ...baseConfig, accentColor: '#ffffff', routeColor: '#ffffff', isLight: true } : baseConfig
  const effectiveShowMap = showMap || isMapBg
  const barColor = ACCENT_TOKENS[accent].barColor

  const hasRoute = !!activity.route && activity.route.length > 1
  const routePoints = hasRoute ? projectRouteToCircle(activity.route!, 100, 100, 88 * 1.56) : null
  const stats = buildStatItems(activity).slice(0, 4)

  const texturedBgSrc = isTextured ? texturedBgPath(design, accent, theme) : null
  const hasBgImage = (isMemory && !!photoUrl) || (isMapBg && !!mapSnapshotUrl) || isTextured
  // Image-background designs (Map, Memory) keep their overlays small, so the map/photo stays visible.
  // Textured designs keep the full header/stats treatment - their backgrounds already bake in
  // enough contrast (and the top accent bar), so they skip the heavy legibility scrims below.
  const isOverlayStyle = isMapBg || isMemory
  const showScrims = isOverlayStyle && hasBgImage
  const topScrimHeight = isOverlayStyle ? 64 : 175
  const bottomScrimHeight = isOverlayStyle ? 100 : 265
  const topScrimPeakOpacity = isOverlayStyle ? 0.55 : 0.80
  const bottomScrimPeakOpacity = isOverlayStyle ? 0.62 : 0.92

  return (
    <div
      className="relative overflow-hidden rounded-card"
      style={{
        width: PREVIEW_WIDTH,
        height: PREVIEW_HEIGHT,
        background: hasBgImage ? 'transparent' : config.bg,
        boxShadow: '0 20px 56px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(255,255,255,0.08)',
      }}
    >
      {/* Textured background (Facets/Grain/Topographic) - per-accent asset, light/dark variant follows the site theme.
          objectPosition anchors to the top (where the baked-in accent bar + brand mark live) since the preview's
          aspect ratio differs from the asset's (1080x1920), so a centered cover crop would clip them. */}
      {isTextured && texturedBgSrc && (
        <Image src={texturedBgSrc} alt="" fill style={{ objectFit: 'cover', objectPosition: 'top' }} />
      )}
      {/* Photo background (Memory with photo) */}
      {isMemory && photoUrl && (
        <Image src={photoUrl} alt="" fill style={{ objectFit: 'cover' }} />
      )}
      {/* Photo placeholder (Memory without photo) */}
      {isMemory && !photoUrl && onPickPhoto && (
        <button
          onClick={onPickPhoto}
          style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <ImagePlus size={24} color="rgba(255,255,255,0.45)" strokeWidth={1.5} />
          <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.45)' }}>{t.activity.shareCard.choosePhoto}</span>
        </button>
      )}
      {/* Persistent "change photo" affordance (Memory only) - stays visible even once a photo
          is set, so the control isn't only discoverable by scrolling to the picker below. */}
      {isMemory && onPickPhoto && (
        <button
          onClick={onPickPhoto}
          aria-label={t.activity.shareCard.choosePhoto}
          style={{
            position: 'absolute',
            bottom: 14,
            right: 14,
            zIndex: 5,
            width: 30,
            height: 30,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.2)',
            cursor: 'pointer',
          }}
        >
          <Pencil size={16} color="#fff" strokeWidth={2} />
        </button>
      )}
      {/* Map background (Map design) */}
      {isMapBg && mapSnapshotUrl && (
        <Image src={mapSnapshotUrl} alt="" fill style={{ objectFit: 'cover' }} />
      )}
      {isMapBg && !mapSnapshotUrl && mapLoading && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MapIcon size={24} color="rgba(255,255,255,0.3)" strokeWidth={1.5} className="animate-pulse" />
        </div>
      )}

      {/* Top accent bar - textured backgrounds already bake this in */}
      {!isMemory && !isTextured && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: barColor, zIndex: 10 }} />
      )}

      {/* Scrims (Memory photo or Map background, for legibility) */}
      {showScrims && (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: topScrimHeight, background: `linear-gradient(180deg, rgba(0,0,0,${topScrimPeakOpacity}) 0%, rgba(0,0,0,0) 100%)`, zIndex: 1 }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: bottomScrimHeight, background: `linear-gradient(0deg, rgba(0,0,0,${bottomScrimPeakOpacity}) 0%, rgba(0,0,0,0) 100%)`, zIndex: 1 }} />
        </>
      )}

      {/* Brand mark - baked into the texture backgrounds already; Map's captured snapshot
          and Memory's user photo need it stamped on top (the asset is black-on-transparent,
          inverted to white on dark designs/basemaps). */}
      {(isMapBg || isMemory) && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, filter: config.isLight ? undefined : 'invert(1)' }}>
          {/* objectPosition anchors to the mark's actual corner - the preview's aspect ratio
              differs from the asset's (1080x1920), so a centered cover crop would clip it. */}
          <Image src={BRAND_MARK_SRC} alt="" fill style={{ objectFit: 'cover', objectPosition: 'top right' }} />
        </div>
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
  )
}
