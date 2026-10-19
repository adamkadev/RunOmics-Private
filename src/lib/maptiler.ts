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

const HEAT_BASEMAP_LIGHT: Partial<Record<keyof typeof MAP_STYLE_COLORS.light, string>> = {
  background: '#f1f2f1',
  land: '#ebeceb',
  park: '#e2e8e0',
  water: '#dde5ea',
  waterway: '#dde5ea',
}

export function heatBasemapStyle(style: StyleSpecification, isDark: boolean): StyleSpecification {
  if (isDark) return style
  let json = JSON.stringify(style)
  for (const [role, muted] of Object.entries(HEAT_BASEMAP_LIGHT)) {
    const painted = MAP_STYLE_COLORS.light[role as keyof typeof MAP_STYLE_COLORS.light]
    json = json.replaceAll(`"${painted}"`, `"${muted}"`)
  }
  return JSON.parse(json) as StyleSpecification
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
