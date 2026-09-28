import type { StyleSpecification } from 'maplibre-gl'
import { t } from '@/i18n'
import light from '@/map/styles/runomics-light.json'
import dark from '@/map/styles/runomics-dark.json'

const MAP_LANGUAGE = t.locale.split('-')[0] ?? 'en'

/**
 * Every label in `lang`, falling back to the local name: the kept styles
 * name places in English (`name:en`), the way MapTiler's `language` query
 * used to pick it on its side.
 */
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

/**
 * RunOmics' own basemap for a theme (v4.17): the greys in src/map/styles,
 * built from MapTiler's Dataviz by scripts/build-map-styles.ts, with the key
 * filled into every source, sprite and glyph URL.
 */
export function maptilerStyle(isDark: boolean, token: string): StyleSpecification {
  const style = JSON.parse(JSON.stringify(isDark ? dark : light).replaceAll('{key}', token)) as StyleSpecification
  return withLanguage(style, MAP_LANGUAGE)
}
