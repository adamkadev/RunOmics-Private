import type { ShareDesign } from '@/lib/shareCard'
import type { AccentId } from '@/lib/accent'

export const ACCENT_TOKENS: Record<AccentId, {
  barColor: string
  canvasLight: string; a1Light: string; a2Light: string; a1opLight: number; a2opLight: number; accentLight: string
  canvasDark: string; a1Dark: string; a2Dark: string; a1opDark: number; a2opDark: number; accentDark: string; accentTextDark: string
}> = {
  nature: {
    barColor: '#059669',
    canvasLight: 'linear-gradient(155deg,#f0fef8 0%,#ecf9f4 100%)', a1Light: '#86efac', a2Light: '#6ee7b7', a1opLight: 0.58, a2opLight: 0.50, accentLight: '#059669',
    canvasDark: 'linear-gradient(155deg,#064e3b 0%,#082f39 100%)', a1Dark: '#10b981', a2Dark: '#34d399', a1opDark: 0.45, a2opDark: 0.38, accentDark: '#10b981', accentTextDark: '#6ee7b7',
  },
  performance: {
    barColor: '#2563eb',
    canvasLight: 'linear-gradient(155deg,#f0f7ff 0%,#eff2ff 100%)', a1Light: '#60a5fa', a2Light: '#93c5fd', a1opLight: 0.60, a2opLight: 0.52, accentLight: '#2563eb',
    canvasDark: 'linear-gradient(155deg,#1e3a8a 0%,#0c2340 100%)', a1Dark: '#3b82f6', a2Dark: '#60a5fa', a1opDark: 0.48, a2opDark: 0.40, accentDark: '#3b82f6', accentTextDark: '#93c5fd',
  },
  impact: {
    barColor: '#e11d48',
    canvasLight: 'linear-gradient(155deg,#fff5f8 0%,#fff1f5 100%)', a1Light: '#f472b6', a2Light: '#f87db8', a1opLight: 0.60, a2opLight: 0.52, accentLight: '#e11d48',
    canvasDark: 'linear-gradient(155deg,#831843 0%,#500724 100%)', a1Dark: '#f43f5e', a2Dark: '#f472b6', a1opDark: 0.48, a2opDark: 0.40, accentDark: '#f43f5e', accentTextDark: '#fb7185',
  },
  motivation: {
    barColor: '#ea580c',
    canvasLight: 'linear-gradient(155deg,#fffbf0 0%,#fff8f0 100%)', a1Light: '#fb923c', a2Light: '#fdba74', a1opLight: 0.60, a2opLight: 0.52, accentLight: '#ea580c',
    canvasDark: 'linear-gradient(155deg,#7c2d12 0%,#431407 100%)', a1Dark: '#f97316', a2Dark: '#fb923c', a1opDark: 0.48, a2opDark: 0.40, accentDark: '#f97316', accentTextDark: '#fdba74',
  },
  endurance: {
    barColor: '#7c3aed',
    canvasLight: 'linear-gradient(155deg,#faf8ff 0%,#f5f3ff 100%)', a1Light: '#a78bfa', a2Light: '#c4b5fd', a1opLight: 0.60, a2opLight: 0.52, accentLight: '#7c3aed',
    canvasDark: 'linear-gradient(155deg,#4c1d95 0%,#2e1065 100%)', a1Dark: '#8b5cf6', a2Dark: '#a78bfa', a1opDark: 0.48, a2opDark: 0.40, accentDark: '#8b5cf6', accentTextDark: '#c4b5fd',
  },
}

export interface DesignConfig {
  bg: string
  showBlobs: boolean
  blob1: string; blob2: string; blob1Op: number; blob2Op: number
  isLight: boolean
  titleColor: string; subtitleColor: string; brandColor: string
  mapCircleBg: string; routeColor: string
  statsBg: string; statsBorder: string; accentColor: string; statsLabelColor: string; statsPrimaryColor: string
  isMapBg: boolean; isPhoto: boolean
}

export function getDesignConfig(design: ShareDesign, accent: AccentId): DesignConfig {
  const t = ACCENT_TOKENS[accent]

  switch (design) {
    case 'aurora':
      return {
        bg: t.canvasLight, showBlobs: true,
        blob1: t.a1Light, blob2: t.a2Light, blob1Op: t.a1opLight, blob2Op: t.a2opLight,
        isLight: true,
        titleColor: '#0f172a', subtitleColor: '#64748b', brandColor: '#0f172a',
        mapCircleBg: 'rgba(59,130,246,0.05)', routeColor: t.accentLight,
        statsBg: 'rgba(255,255,255,0.68)', statsBorder: 'rgba(255,255,255,0.82)',
        accentColor: t.accentLight, statsLabelColor: '#64748b', statsPrimaryColor: '#1e293b',
        isMapBg: false, isPhoto: false,
      }
    case 'night':
      return {
        bg: t.canvasDark, showBlobs: true,
        blob1: t.a1Dark, blob2: t.a2Dark, blob1Op: t.a1opDark, blob2Op: t.a2opDark,
        isLight: false,
        titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.45)', brandColor: '#ffffff',
        mapCircleBg: 'rgba(59,130,246,0.07)', routeColor: t.accentTextDark,
        statsBg: 'rgba(255,255,255,0.07)', statsBorder: 'rgba(255,255,255,0.13)',
        accentColor: t.accentTextDark, statsLabelColor: 'rgba(255,255,255,0.42)', statsPrimaryColor: 'rgba(255,255,255,0.88)',
        isMapBg: false, isPhoto: false,
      }
    case 'clean':
      return {
        bg: 'linear-gradient(150deg,#ffffff 0%,#f1f5f9 100%)', showBlobs: false,
        blob1: '#000', blob2: '#000', blob1Op: 0, blob2Op: 0,
        isLight: true,
        titleColor: '#0f172a', subtitleColor: '#94a3b8', brandColor: '#0f172a',
        mapCircleBg: 'rgba(0,0,0,0.035)', routeColor: t.accentLight,
        statsBg: 'rgba(0,0,0,0.025)', statsBorder: 'rgba(0,0,0,0.08)',
        accentColor: t.accentLight, statsLabelColor: '#94a3b8', statsPrimaryColor: '#334155',
        isMapBg: false, isPhoto: false,
      }
    case 'map':
      return {
        bg: '#0f172a', showBlobs: false,
        blob1: '#000', blob2: '#000', blob1Op: 0, blob2Op: 0,
        isLight: false,
        titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.45)', brandColor: '#ffffff',
        mapCircleBg: 'rgba(59,130,246,0.06)', routeColor: t.accentTextDark,
        statsBg: 'rgba(255,255,255,0.06)', statsBorder: 'rgba(255,255,255,0.10)',
        accentColor: t.accentTextDark, statsLabelColor: 'rgba(255,255,255,0.38)', statsPrimaryColor: 'rgba(255,255,255,0.78)',
        isMapBg: true, isPhoto: false,
      }
    case 'memory':
      return {
        bg: 'linear-gradient(145deg,#1e1b4b 0%,#312e81 45%,#1e3a5f 100%)', showBlobs: false,
        blob1: '#000', blob2: '#000', blob1Op: 0, blob2Op: 0,
        isLight: false,
        titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.62)', brandColor: '#ffffff',
        mapCircleBg: 'rgba(255,255,255,0.04)', routeColor: 'rgba(255,255,255,0.72)',
        statsBg: 'rgba(0,0,0,0.62)', statsBorder: 'rgba(255,255,255,0.12)',
        accentColor: '#ffffff', statsLabelColor: 'rgba(255,255,255,0.45)', statsPrimaryColor: 'rgba(255,255,255,0.88)',
        isMapBg: false, isPhoto: true,
      }
  }
}
