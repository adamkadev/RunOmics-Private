import type { ShareDesign, ThemeMode } from '@/lib/shareCard'
import type { AccentId } from '@/lib/accent'

export const ACCENT_TOKENS: Record<AccentId, {
  barColor: string
  accentLight: string
  accentDark: string; accentTextDark: string
}> = {
  nature: { barColor: '#059669', accentLight: '#059669', accentDark: '#10b981', accentTextDark: '#6ee7b7' },
  performance: { barColor: '#2563eb', accentLight: '#2563eb', accentDark: '#3b82f6', accentTextDark: '#93c5fd' },
  impact: { barColor: '#e11d48', accentLight: '#e11d48', accentDark: '#f43f5e', accentTextDark: '#fb7185' },
  motivation: { barColor: '#ea580c', accentLight: '#ea580c', accentDark: '#f97316', accentTextDark: '#fdba74' },
  endurance: { barColor: '#7c3aed', accentLight: '#7c3aed', accentDark: '#8b5cf6', accentTextDark: '#c4b5fd' },
}

export interface DesignConfig {
  bg: string
  isLight: boolean
  titleColor: string; subtitleColor: string
  routeColor: string
  statsBg: string; statsBorder: string; accentColor: string; statsLabelColor: string; statsPrimaryColor: string
  isMapBg: boolean; isPhoto: boolean
}

export function getDesignConfig(design: ShareDesign, accent: AccentId, theme: ThemeMode): DesignConfig {
  const t = ACCENT_TOKENS[accent]

  switch (design) {
    case 'facets':
    case 'grain':
    case 'topographic':
      return theme === 'light'
        ? {
            bg: '#f8fafc', isLight: true,
            titleColor: '#0f172a', subtitleColor: '#64748b',
            routeColor: t.accentLight,
            statsBg: 'rgba(255,255,255,0.68)', statsBorder: 'rgba(255,255,255,0.82)',
            accentColor: t.accentLight, statsLabelColor: '#64748b', statsPrimaryColor: '#1e293b',
            isMapBg: false, isPhoto: false,
          }
        : {
            bg: '#06090f', isLight: false,
            titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.45)',
            routeColor: t.accentTextDark,
            statsBg: 'rgba(255,255,255,0.07)', statsBorder: 'rgba(255,255,255,0.13)',
            accentColor: t.accentTextDark, statsLabelColor: 'rgba(255,255,255,0.42)', statsPrimaryColor: 'rgba(255,255,255,0.88)',
            isMapBg: false, isPhoto: false,
          }
    case 'map':
      return {
        bg: '#0f172a', isLight: false,
        titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.45)',
        routeColor: t.accentTextDark,
        statsBg: 'rgba(255,255,255,0.06)', statsBorder: 'rgba(255,255,255,0.10)',
        accentColor: t.accentTextDark, statsLabelColor: 'rgba(255,255,255,0.38)', statsPrimaryColor: 'rgba(255,255,255,0.78)',
        isMapBg: true, isPhoto: false,
      }
    case 'memory':
      return {
        bg: 'linear-gradient(145deg,#1e1b4b 0%,#312e81 45%,#1e3a5f 100%)', isLight: false,
        titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.62)',
        routeColor: 'rgba(255,255,255,0.72)',
        statsBg: 'rgba(0,0,0,0.62)', statsBorder: 'rgba(255,255,255,0.12)',
        accentColor: '#ffffff', statsLabelColor: 'rgba(255,255,255,0.45)', statsPrimaryColor: 'rgba(255,255,255,0.88)',
        isMapBg: false, isPhoto: true,
      }
  }
}
