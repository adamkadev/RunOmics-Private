import { describe, it, expect } from 'vitest'
import type { StyleSpecification } from 'maplibre-gl'
import { HEAT_BASEMAP, heatBasemapStyle, maptilerStyle, shareBasemapStyle, withLanguage } from '../maptiler'
import { MAP_STYLE_COLORS } from '../themeTokens'

describe('maptilerStyle (v4.17)', () => {
  it('fills the key into every URL and leaves no placeholder', () => {
    for (const isDark of [true, false]) {
      const json = JSON.stringify(maptilerStyle(isDark, 'secret-key'))
      expect(json).not.toContain('{key}')
      expect(json).toContain('key=secret-key')
    }
  })

  it('draws each theme on its own ground, from the token file', () => {
    const background = (s: StyleSpecification) => s.layers.find((l) => l.type === 'background')!.paint!
    expect(background(maptilerStyle(true, 'k'))).toMatchObject({ 'background-color': MAP_STYLE_COLORS.dark.background })
    expect(background(maptilerStyle(false, 'k'))).toMatchObject({ 'background-color': MAP_STYLE_COLORS.light.background })
  })
})

describe('withLanguage', () => {
  const style = {
    version: 8,
    sources: {},
    layers: [
      { id: 'towns', type: 'symbol', source: 's', layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']] } },
      { id: 'water', type: 'fill', source: 's' },
    ],
  } as unknown as StyleSpecification

  it('names places in the app language, the local name behind it', () => {
    const fr = withLanguage(style, 'fr')
    expect((fr.layers[0] as { layout: Record<string, unknown> }).layout['text-field']).toEqual(['coalesce', ['get', 'name:fr'], ['get', 'name']])
    expect(fr.layers[1]).toBe(style.layers[1])
  })

  it('leaves English as built', () => {
    expect(withLanguage(style, 'en')).toBe(style)
  })
})

describe('heatBasemapStyle (Wave 4, App Fixes 4d)', () => {
  const paintOf = (s: StyleSpecification, id: string) => (s.layers.find((l) => l.id === id)!.paint ?? {}) as Record<string, unknown>
  const layoutOf = (s: StyleSpecification, id: string) => (s.layers.find((l) => l.id === id)!.layout ?? {}) as Record<string, unknown>

  it('mutes land, parks, water and roads to the four heat greys in light', () => {
    for (const isDark of [false]) {
      const colours = HEAT_BASEMAP[isDark ? 'dark' : 'light']
      const muted = heatBasemapStyle(maptilerStyle(isDark, 'k'), isDark)
      expect(paintOf(muted, 'Background')['background-color']).toBe(colours.land)
      expect(paintOf(muted, 'Grass')['fill-color']).toBe(colours.park)
      expect(paintOf(muted, 'Water')['fill-color']).toBe(colours.water)
      expect(paintOf(muted, 'Road network')['line-color']).toBe(colours.road)
      expect(layoutOf(muted, 'Building').visibility).toBe('none')
      expect(paintOf(muted, 'City labels')['text-color']).toBe('#5a615f')
      expect(paintOf(muted, 'City labels')['text-halo-color']).toBe(colours.land)
      expect(paintOf(muted, 'City labels')['text-halo-width']).toBeGreaterThan(0)
    }
  })

  it('keeps the dark basemap as it is, and drops the sprite no heat layer draws', () => {
    const dark = maptilerStyle(true, 'k')
    expect(heatBasemapStyle(dark, true).layers).toBe(dark.layers)
    expect(heatBasemapStyle(dark, true).sprite).toBeUndefined()
    expect(heatBasemapStyle(maptilerStyle(false, 'k'), false).sprite).toBeUndefined()
  })

  it('leaves the style it was given alone', () => {
    const source = maptilerStyle(false, 'k')
    heatBasemapStyle(source, false)
    expect(paintOf(source, 'Grass')['fill-color']).toBe(MAP_STYLE_COLORS.light.park)
  })
})

describe('shareBasemapStyle (3.0.1)', () => {
  it('deepens the parks and water the card draws, in both themes', () => {
    for (const isDark of [true, false]) {
      const mode = isDark ? 'dark' : 'light'
      const json = JSON.stringify(shareBasemapStyle(maptilerStyle(isDark, 'k'), isDark))
      for (const role of ['park', 'water'] as const) expect(json).not.toContain(MAP_STYLE_COLORS[mode][role])
    }
  })

  it('leaves the style it was given alone', () => {
    const source = maptilerStyle(false, 'k')
    shareBasemapStyle(source, false)
    expect(JSON.stringify(source)).toContain(MAP_STYLE_COLORS.light.park)
  })
})
