import type { StyleSpecification } from 'maplibre-gl'
import { MAP_STYLE_COLORS } from '@/lib/themeTokens'
import { t } from '@/i18n'
import light from '@/map/styles/runomics-light.json'
import dark from '@/map/styles/runomics-dark.json'

const MAP_LANGUAGE = t.locale.split('-')[0] ?? 'en'

export function withLanguage(style: StyleSpecification, lang: string): StyleSpecification {
  if (lang === 'en') return style
  return {
    ...style,
    layers: style.layers.map((layer) => {
      if (layer.type !== 'symbol' || !layer.layout?.['text-field']) return layer
      const field = JSON.stringify(layer.layout['text-field']).replaceAll('"name:en"', `"name:${lang}"`)
      return { ...layer, layout: { ...layer.layout, 'text-field': JSON.parse(field) } }
    }),
  }
}

export function maptilerStyle(isDark: boolean, token: string): StyleSpecification {
  const style = JSON.parse(JSON.stringify(isDark ? dark : light).replaceAll('{key}', token)) as StyleSpecification
  return withLanguage(style, MAP_LANGUAGE)
}

/**
 * The heatmap's muted ground (Wave 4, App Fixes 4d): land, parks, water and
 * roads in four near-greys, so the routes carry the only colour. Building
 * fills, casings, hillshade and borders drop out; labels stay, at 60 %.
 */
export const HEAT_BASEMAP = {
  light: { land: '#eef0ef', park: '#e2eae3', water: '#dde6ea', road: '#ffffff' },
  dark: { land: '#0e1211', park: '#122019', water: '#13202a', road: '#1c2321' },
} as const

const HEAT_LABEL_OPACITY = 0.6
/** Label text on the heatmap (Wave 5 B): one grey per mode, no halo, at 60 %. */
const HEAT_LABEL = { light: '#6b7270', dark: '#8d9391' } as const

type Role = keyof (typeof HEAT_BASEMAP)['light'] | 'hide'

/** What each layer of the RunOmics style becomes on the heatmap, by its id. */
function heatRole(id: string): Role | null {
  if (id === 'Background' || id === 'Residential' || id === 'Pier' || id === 'Bridge') return 'land'
  if (['Cemetery', 'Wood', 'Grass', 'Forest', 'Stadium'].includes(id)) return 'park'
  if (id === 'Water' || id === 'Water shadow' || id.startsWith('River')) return 'water'
  if (id === 'Road network' || id === 'Road bridge' || id === 'Tunnel' || id === 'Pathway' || id === 'Tunnel pathway') return 'road'
  if (id.includes('outline') || id.startsWith('Building') || id === 'Hillshade' || id.includes('border') || id.includes('ailway') || id === 'Aviation line') return 'hide'
  return null
}

/** `#rrggbb` at an alpha. */
function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1, 7), 16)
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`
}

export function heatBasemapStyle(style: StyleSpecification, isDark: boolean): StyleSpecification {
  // Dark keeps its own basemap, as 3.1.0 did: the additive tracks read on it as they are.
  if (isDark) return style
  const colours = HEAT_BASEMAP.light
  return {
    ...style,
    layers: style.layers.map((layer) => {
      if (layer.type === 'symbol') {
        const paint = { ...(layer.paint ?? {}) } as Record<string, unknown>
        // A halo doubled every street name ("Devant-les-Ponts"): none at all.
        if (paint['text-color'] !== undefined) paint['text-color'] = withAlpha(HEAT_LABEL[isDark ? 'dark' : 'light'], HEAT_LABEL_OPACITY)
        paint['text-halo-width'] = 0
        delete paint['text-halo-color']
        delete paint['text-halo-blur']
        return { ...layer, paint } as typeof layer
      }
      const role = heatRole(layer.id)
      if (!role) return layer
      if (role === 'hide') return { ...layer, layout: { ...(layer.layout ?? {}), visibility: 'none' } } as typeof layer
      const colour = colours[role]
      const key = layer.type === 'background' ? 'background-color' : layer.type === 'fill' ? 'fill-color' : layer.type === 'line' ? 'line-color' : null
      if (!key) return layer
      const paint = { ...(layer.paint ?? {}), [key]: colour } as Record<string, unknown>
      if (layer.type === 'fill') delete paint['fill-outline-color']
      return { ...layer, paint } as typeof layer
    }),
  }
}

const SHARE_BASEMAP: Record<'light' | 'dark', Partial<Record<keyof typeof MAP_STYLE_COLORS.light, string>>> = {
  light: { park: '#c6e0c2', water: '#b4d2ea', waterway: '#b4d2ea', roadCasing: '#d5d9d7' },
  dark: { park: '#1a3326', water: '#16304a', waterway: '#16304a', roadMajor: '#2a3030' },
}

export function shareBasemapStyle(style: StyleSpecification, isDark: boolean): StyleSpecification {
  const mode = isDark ? 'dark' : 'light'
  let json = JSON.stringify(style)
  for (const [role, stronger] of Object.entries(SHARE_BASEMAP[mode])) {
    const painted = MAP_STYLE_COLORS[mode][role as keyof typeof MAP_STYLE_COLORS.light]
    json = json.replaceAll(`"${painted}"`, `"${stronger}"`)
  }
  return JSON.parse(json) as StyleSpecification
}
