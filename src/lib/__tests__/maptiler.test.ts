import { describe, it, expect } from 'vitest'
import type { StyleSpecification } from 'maplibre-gl'
import { HEAT_BASEMAP, heatBasemapStyle, maptilerStyle, shareBasemapStyle, withLanguage } from '../maptiler'
import light from '@/map/styles/runomics-light.json'
import dark from '@/map/styles/runomics-dark.json'

const committedPaint = (style: unknown, id: string) => ((style as StyleSpecification).layers.find((l) => l.id === id)!.paint ?? {}) as Record<string, unknown>

describe('maptilerStyle (v4.17)', () => {
  it('fills the key into every URL and leaves no placeholder', () => {
    for (const isDark of [true, false]) {
      const json = JSON.stringify(maptilerStyle(isDark, 'secret-key'))
      expect(json).not.toContain('{key}')
      expect(json).toContain('key=secret-key')
    }
  })

  it('draws each theme on its own ground, from the committed style', () => {
    const background = (s: StyleSpecification) => s.layers.find((l) => l.type === 'background')!.paint!
    expect(background(maptilerStyle(true, 'k'))).toMatchObject({ 'background-color': committedPaint(dark, 'Background')['background-color'] })
    expect(background(maptilerStyle(false, 'k'))).toMatchObject({ 'background-color': committedPaint(light, 'Background')['background-color'] })
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
    expect(paintOf(source, 'Grass')['fill-color']).toBe(committedPaint(light, 'Grass')['fill-color'])
  })
})

describe('shareBasemapStyle', () => {
  const paintOf = (s: StyleSpecification, id: string) => (s.layers.find((l) => l.id === id)!.paint ?? {}) as Record<string, unknown>

  it('deepens the parks and water the card draws, found by layer, in both themes', () => {
    for (const isDark of [true, false]) {
      const base = maptilerStyle(isDark, 'k')
      const card = shareBasemapStyle(base, isDark)
      expect(paintOf(card, 'Grass')['fill-color']).not.toBe(paintOf(base, 'Grass')['fill-color'])
      expect(paintOf(card, 'Water')['fill-color']).not.toBe(paintOf(base, 'Water')['fill-color'])
      expect(paintOf(card, 'River')['line-color']).toBe(paintOf(card, 'Water')['fill-color'])
      expect(paintOf(card, 'Road network')).toEqual(paintOf(base, 'Road network'))
    }
  })

  it('leaves the style it was given alone', () => {
    const source = maptilerStyle(false, 'k')
    shareBasemapStyle(source, false)
    expect(paintOf(source, 'Grass')['fill-color']).toBe(committedPaint(light, 'Grass')['fill-color'])
  })
})
