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

/** Set by the e2e build alone: with no token the map still builds, on a blank style, so a test can tap it. */
export const TEST_MAPS = process.env.NEXT_PUBLIC_E2E_MAPS === '1'

/** Same-origin glyphs that 404: a label then draws nothing instead of failing the layer it is on. */
export function emptyStyle(isDark: boolean): StyleSpecification {
  return {
    version: 8,
    glyphs: '/e2e-glyphs/{fontstack}/{range}.pbf',
    sources: {},
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': isDark ? '#0e1211' : '#eef0ef' } }],
  }
}

/** The MapTiler style, the blank one in a test build without a token, or null: no map. */
export function basemapStyle(isDark: boolean, token: string | undefined = process.env.NEXT_PUBLIC_MAPTILER_TOKEN): StyleSpecification | null {
  if (token) return maptilerStyle(isDark, token)
  return TEST_MAPS ? emptyStyle(isDark) : null
}

/** Near-greys, so the routes carry the only colour. */
export const HEAT_BASEMAP = {
  light: { land: '#eef0ef', park: '#e2eae3', water: '#dde6ea', road: '#ffffff' },
  dark: { land: '#0e1211', park: '#122019', water: '#13202a', road: '#1c2321' },
} as const

/**
 * Opaque, with a halo in the land's colour: a translucent label let a corridor
 * show through the name, and the line read as crossing it.
 */
const HEAT_LABEL = '#5a615f'
const HEAT_LABEL_HALO = { width: 1.4, blur: 0.4 } as const

type Role = keyof (typeof HEAT_BASEMAP)['light'] | 'hide'

function heatRole(id: string): Role | null {
  if (id === 'Background' || id === 'Residential' || id === 'Pier' || id === 'Bridge') return 'land'
  if (['Cemetery', 'Wood', 'Grass', 'Forest', 'Stadium'].includes(id)) return 'park'
  if (id === 'Water' || id === 'Water shadow' || id.startsWith('River')) return 'water'
  if (id === 'Road network' || id === 'Road bridge' || id === 'Tunnel' || id === 'Pathway' || id === 'Tunnel pathway') return 'road'
  if (id.includes('outline') || id.startsWith('Building') || id === 'Hillshade' || id.includes('border') || id.includes('ailway') || id === 'Aviation line') return 'hide'
  return null
}

export function heatBasemapStyle(style: StyleSpecification, isDark: boolean): StyleSpecification {
  // No heat map layer draws a sprite icon: without the key, its 348 KB image is never fetched.
  const base = { ...style }
  delete base.sprite
  // Dark keeps its own basemap: the additive tracks read on it as they are.
  if (isDark) return base
  const colours = HEAT_BASEMAP.light
  return {
    ...base,
    layers: style.layers.map((layer) => {
      if (layer.type === 'symbol') {
        const paint = { ...(layer.paint ?? {}) } as Record<string, unknown>
        if (paint['text-color'] !== undefined) paint['text-color'] = HEAT_LABEL
        paint['text-halo-color'] = colours.land
        paint['text-halo-width'] = HEAT_LABEL_HALO.width
        paint['text-halo-blur'] = HEAT_LABEL_HALO.blur
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
