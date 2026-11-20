import { describe, it, expect } from 'vitest'
import { huedColors, withKeyPlaceholder, withoutEditorFields, type StyleJson } from '../styleChecks'
import light from '../styles/runomics-light.json'
import dark from '../styles/runomics-dark.json'

const SOURCE: StyleJson = {
  version: 8,
  id: 'abc',
  metadata: { 'maptiler:copyright': 'x' },
  sources: { planet: { type: 'vector', url: 'https://api.maptiler.com/tiles/v4/tiles.json?key=ABC123' } },
  glyphs: 'https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=ABC123',
  layers: [
    { id: 'Background', type: 'background', paint: { 'background-color': '#f0f1ef' } },
    { id: 'Grass', type: 'fill', 'source-layer': 'grass', paint: { 'fill-color': '#dfe8da' } },
    { id: 'Water', type: 'fill', 'source-layer': 'water', paint: { 'fill-color': '#d0deea' } },
    { id: 'Country border', type: 'line', 'source-layer': 'country_border', paint: { 'line-color': 'hsl(356,32%,70%)' } },
    { id: 'Bus stops', type: 'symbol', 'source-layer': 'poi', layout: { visibility: 'none' }, paint: { 'text-color': '#ff0000' } },
  ],
}

describe('withKeyPlaceholder', () => {
  it('replaces any key in every URL', () => {
    const json = JSON.stringify(withKeyPlaceholder(SOURCE))
    expect(json).not.toContain('ABC123')
    expect(json.match(/key=\{key\}/g)).toHaveLength(2)
  })
})

describe('withoutEditorFields', () => {
  it('drops the editor id and metadata and names the style', () => {
    const style = withoutEditorFields(SOURCE, 'runomics-light')
    expect(style.id).toBeUndefined()
    expect(style.metadata).toBeUndefined()
    expect(style.name).toBe('runomics-light')
    expect(style.layers).toBe(SOURCE.layers)
  })
})

describe('huedColors', () => {
  it('finds a hue in a visible layer outside parks and water', () => {
    expect(huedColors(SOURCE)).toEqual(['Country border.line-color: hsl(356,32%,70%)'])
  })

  it('passes greys, parks, water and hidden layers', () => {
    expect(huedColors({ ...SOURCE, layers: SOURCE.layers.filter((l) => l.id !== 'Country border') })).toEqual([])
  })
})

describe('the committed styles', () => {
  it('are greys only, parks and water aside, and carry the placeholder, never a key', () => {
    for (const style of [light, dark] as unknown as StyleJson[]) {
      expect(huedColors(style)).toEqual([])
      const json = JSON.stringify(style)
      expect(json).toContain('key={key}')
      expect(json).not.toMatch(/key=(?!\{key\})[A-Za-z0-9]/)
    }
  })

  it('name places through name:en, which lib/maptiler swaps for the app language', () => {
    for (const style of [light, dark] as unknown as StyleJson[]) {
      expect(style.layers.some((l) => JSON.stringify(l.layout?.['text-field'] ?? '').includes('name:en'))).toBe(true)
    }
  })
})
