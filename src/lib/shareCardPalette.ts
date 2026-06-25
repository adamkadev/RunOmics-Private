import { type AccentId } from '@/lib/accent'

export type ShareDesign = 'aurora' | 'night' | 'clean' | 'map' | 'memory'
export const SHARE_DESIGNS: ShareDesign[] = ['aurora', 'night', 'clean', 'map', 'memory']

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

// Map design: keeps overlays small so the route map stays the focal point
export const MAP_STATS_H = 220
export const MAP_TOP_SCRIM_H = 360
export const MAP_BOTTOM_SCRIM_H = MAP_STATS_H + M * 2 + 80

export interface DesignPalette {
  bg: string
  showBlobs: boolean
  blob1: string; blob2: string; blob1Op: number; blob2Op: number
  titleColor: string; dateColor: string; brandColor: string
  circleBg: string; routeColor: string
  statsBg: string; statsBorder: string
  valueColor: string; labelColor: string; secondaryColor: string
  isMapBg: boolean; isPhoto: boolean
}

interface AccentColors {
  lightBg: string
  la1: string; la2: string; la1Op: number; la2Op: number
  lightAccent: string; lightText: string; lightCircle: string
  darkBg: string
  da1: string; da2: string; da1Op: number; da2Op: number
  darkAccent: string; darkText: string; darkCircle: string
}

const ACCENT_COLORS: Record<AccentId, AccentColors> = {
  nature: {
    lightBg: '#eef3f0',
    la1: '#a7f3d6', la2: '#bcd6ff', la1Op: 0.65, la2Op: 0.60,
    lightAccent: '#0e9f6e', lightText: '#059669', lightCircle: 'rgba(14,159,110,0.05)',
    darkBg: '#070f0c',
    da1: '#0e9f6e', da2: '#1276b8', da1Op: 0.50, da2Op: 0.42,
    darkAccent: '#10b981', darkText: '#2ed9a0', darkCircle: 'rgba(16,185,129,0.07)',
  },
  performance: {
    lightBg: '#eff6ff',
    la1: '#93c5fd', la2: '#bae6fd', la1Op: 0.65, la2Op: 0.60,
    lightAccent: '#3b82f6', lightText: '#2563eb', lightCircle: 'rgba(59,130,246,0.05)',
    darkBg: '#06091a',
    da1: '#1d4ed8', da2: '#0284c7', da1Op: 0.50, da2Op: 0.42,
    darkAccent: '#3b82f6', darkText: '#60a5fa', darkCircle: 'rgba(59,130,246,0.07)',
  },
  impact: {
    lightBg: '#fff1f2',
    la1: '#fda4af', la2: '#fbcfe8', la1Op: 0.65, la2Op: 0.60,
    lightAccent: '#f43f5e', lightText: '#e11d48', lightCircle: 'rgba(244,63,94,0.05)',
    darkBg: '#130608',
    da1: '#be185d', da2: '#9d174d', da1Op: 0.50, da2Op: 0.42,
    darkAccent: '#f43f5e', darkText: '#fb7185', darkCircle: 'rgba(244,63,94,0.07)',
  },
  motivation: {
    lightBg: '#fff7ed',
    la1: '#fdba74', la2: '#fde68a', la1Op: 0.65, la2Op: 0.60,
    lightAccent: '#f97316', lightText: '#ea580c', lightCircle: 'rgba(249,115,22,0.05)',
    darkBg: '#130a04',
    da1: '#c2410c', da2: '#b45309', da1Op: 0.50, da2Op: 0.42,
    darkAccent: '#f97316', darkText: '#fb923c', darkCircle: 'rgba(249,115,22,0.07)',
  },
  endurance: {
    lightBg: '#f5f3ff',
    la1: '#c4b5fd', la2: '#e9d5ff', la1Op: 0.65, la2Op: 0.60,
    lightAccent: '#8b5cf6', lightText: '#7c3aed', lightCircle: 'rgba(139,92,246,0.05)',
    darkBg: '#0d0a1a',
    da1: '#6d28d9', da2: '#7e22ce', da1Op: 0.50, da2Op: 0.42,
    darkAccent: '#8b5cf6', darkText: '#a78bfa', darkCircle: 'rgba(139,92,246,0.07)',
  },
}

export function resolveDesignPalette(design: ShareDesign, accent: AccentId): DesignPalette {
  const a = ACCENT_COLORS[accent]
  switch (design) {
    case 'aurora':
      return {
        bg: a.lightBg, showBlobs: true,
        blob1: a.la1, blob2: a.la2, blob1Op: a.la1Op, blob2Op: a.la2Op,
        titleColor: '#0f172a', dateColor: '#64748b', brandColor: '#0f172a',
        circleBg: a.lightCircle, routeColor: a.lightAccent,
        statsBg: 'rgba(255,255,255,0.68)', statsBorder: 'rgba(255,255,255,0.82)',
        valueColor: a.lightText, labelColor: '#64748b', secondaryColor: '#1e293b',
        isMapBg: false, isPhoto: false,
      }
    case 'night':
      return {
        bg: a.darkBg, showBlobs: true,
        blob1: a.da1, blob2: a.da2, blob1Op: a.da1Op, blob2Op: a.da2Op,
        titleColor: '#ffffff', dateColor: 'rgba(255,255,255,0.45)', brandColor: '#ffffff',
        circleBg: a.darkCircle, routeColor: a.darkText,
        statsBg: 'rgba(255,255,255,0.07)', statsBorder: 'rgba(255,255,255,0.13)',
        valueColor: a.darkText, labelColor: 'rgba(255,255,255,0.42)', secondaryColor: 'rgba(255,255,255,0.88)',
        isMapBg: false, isPhoto: false,
      }
    case 'clean':
      return {
        bg: '#f8fafc', showBlobs: false,
        blob1: '#000', blob2: '#000', blob1Op: 0, blob2Op: 0,
        titleColor: '#0f172a', dateColor: '#94a3b8', brandColor: '#0f172a',
        circleBg: 'rgba(0,0,0,0.035)', routeColor: a.lightAccent,
        statsBg: 'rgba(0,0,0,0.025)', statsBorder: 'rgba(0,0,0,0.08)',
        valueColor: a.lightText, labelColor: '#94a3b8', secondaryColor: '#334155',
        isMapBg: false, isPhoto: false,
      }
    case 'map':
      return {
        bg: '#0f172a', showBlobs: false,
        blob1: '#000', blob2: '#000', blob1Op: 0, blob2Op: 0,
        titleColor: '#ffffff', dateColor: 'rgba(255,255,255,0.45)', brandColor: '#ffffff',
        circleBg: a.darkCircle, routeColor: a.darkText,
        statsBg: 'rgba(255,255,255,0.06)', statsBorder: 'rgba(255,255,255,0.10)',
        valueColor: a.darkText, labelColor: 'rgba(255,255,255,0.38)', secondaryColor: 'rgba(255,255,255,0.78)',
        isMapBg: true, isPhoto: false,
      }
    case 'memory':
      return {
        bg: '#1e3a5f', showBlobs: false,
        blob1: '#000', blob2: '#000', blob1Op: 0, blob2Op: 0,
        titleColor: '#ffffff', dateColor: 'rgba(255,255,255,0.62)', brandColor: '#ffffff',
        circleBg: 'rgba(255,255,255,0.04)', routeColor: 'rgba(255,255,255,0.72)',
        statsBg: 'rgba(0,0,0,0.42)', statsBorder: 'rgba(255,255,255,0.12)',
        valueColor: '#ffffff', labelColor: 'rgba(255,255,255,0.45)', secondaryColor: 'rgba(255,255,255,0.88)',
        isMapBg: false, isPhoto: true,
      }
  }
}
