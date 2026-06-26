import { type AccentId } from '@/lib/accent'

export type ThemeMode = 'light' | 'dark'
export type ShareDesign = 'facets' | 'grain' | 'topographic' | 'map' | 'memory'
export const SHARE_DESIGNS: ShareDesign[] = ['facets', 'grain', 'topographic', 'map', 'memory']

// The three texture designs render the activity over a static background asset (one per
// accent x theme, see public/backgrounds/<accent>/<design>[-light].png) instead of a
// generated gradient - they follow the site's current light/dark theme automatically.
// Those assets already bake in the top accent bar and brand mark, like the Map design's
// captured snapshot's overlay; only Memory (a user photo) needs the brand mark stamped on top.
export type TexturedDesign = 'facets' | 'grain' | 'topographic'
export const TEXTURED_DESIGNS: TexturedDesign[] = ['facets', 'grain', 'topographic']
export function isTexturedDesign(design: ShareDesign): design is TexturedDesign {
  return (TEXTURED_DESIGNS as ShareDesign[]).includes(design)
}

export function texturedBgPath(design: TexturedDesign, accent: AccentId, theme: ThemeMode): string {
  return `/backgrounds/${accent}/${design}${theme === 'light' ? '-light' : ''}.png`
}

// Brand wordmark overlay (public/backgrounds/branding-mark.png), full canvas size with the
// vertical "RUNOMICS" mark pre-positioned top-right - stamped as-is on Memory's user photo
// (black-on-transparent, inverted to white since Memory is always a dark design).
export const BRAND_MARK_SRC = '/backgrounds/branding-mark.png'

export const W = 1080
export const H = 1920
export const M = 80

// Route circle geometry
export const CX = W / 2
export const CY = 870
export const CR = 330

// Stats glass card
export const STATS_Y = 1400
export const STATS_H = 420

// Map design: keeps overlays small so the route map stays the focal point.
// Stats sit directly on the scrim (no card background).
export const MAP_TOP_SCRIM_H = 360
export const MAP_BOTTOM_SCRIM_H = 380

export interface DesignPalette {
  bg: string
  isLight: boolean
  titleColor: string; dateColor: string
  routeColor: string
  statsBg: string; statsBorder: string
  valueColor: string; labelColor: string; secondaryColor: string
  isMapBg: boolean; isPhoto: boolean
}

interface AccentColors {
  lightAccent: string; lightText: string
  darkAccent: string; darkText: string
}

const ACCENT_COLORS: Record<AccentId, AccentColors> = {
  nature: { lightAccent: '#0e9f6e', lightText: '#059669', darkAccent: '#10b981', darkText: '#2ed9a0' },
  performance: { lightAccent: '#3b82f6', lightText: '#2563eb', darkAccent: '#3b82f6', darkText: '#60a5fa' },
  impact: { lightAccent: '#f43f5e', lightText: '#e11d48', darkAccent: '#f43f5e', darkText: '#fb7185' },
  motivation: { lightAccent: '#f97316', lightText: '#ea580c', darkAccent: '#f97316', darkText: '#fb923c' },
  endurance: { lightAccent: '#8b5cf6', lightText: '#7c3aed', darkAccent: '#8b5cf6', darkText: '#a78bfa' },
  silver: { lightAccent: '#64748b', lightText: '#475569', darkAccent: '#94a3b8', darkText: '#cbd5e1' },
}

export function resolveDesignPalette(design: ShareDesign, accent: AccentId, theme: ThemeMode): DesignPalette {
  const a = ACCENT_COLORS[accent]
  switch (design) {
    case 'facets':
    case 'grain':
    case 'topographic':
      return theme === 'light'
        ? {
            bg: '#f8fafc', isLight: true,
            titleColor: '#0f172a', dateColor: '#64748b',
            routeColor: a.lightAccent,
            statsBg: 'rgba(255,255,255,0.68)', statsBorder: 'rgba(255,255,255,0.82)',
            valueColor: a.lightText, labelColor: '#64748b', secondaryColor: '#1e293b',
            isMapBg: false, isPhoto: false,
          }
        : {
            bg: '#06090f', isLight: false,
            titleColor: '#ffffff', dateColor: 'rgba(255,255,255,0.45)',
            routeColor: a.darkText,
            statsBg: 'rgba(255,255,255,0.07)', statsBorder: 'rgba(255,255,255,0.13)',
            valueColor: a.darkText, labelColor: 'rgba(255,255,255,0.42)', secondaryColor: 'rgba(255,255,255,0.88)',
            isMapBg: false, isPhoto: false,
          }
    case 'map':
      return {
        bg: '#0f172a', isLight: false,
        titleColor: '#ffffff', dateColor: 'rgba(255,255,255,0.45)',
        routeColor: a.darkText,
        statsBg: 'rgba(255,255,255,0.06)', statsBorder: 'rgba(255,255,255,0.10)',
        valueColor: a.darkText, labelColor: 'rgba(255,255,255,0.38)', secondaryColor: 'rgba(255,255,255,0.78)',
        isMapBg: true, isPhoto: false,
      }
    case 'memory':
      return {
        bg: '#1e3a5f', isLight: false,
        titleColor: '#ffffff', dateColor: 'rgba(255,255,255,0.62)',
        routeColor: 'rgba(255,255,255,0.72)',
        statsBg: 'rgba(0,0,0,0.42)', statsBorder: 'rgba(255,255,255,0.12)',
        valueColor: '#ffffff', labelColor: 'rgba(255,255,255,0.45)', secondaryColor: 'rgba(255,255,255,0.88)',
        isMapBg: false, isPhoto: true,
      }
  }
}
