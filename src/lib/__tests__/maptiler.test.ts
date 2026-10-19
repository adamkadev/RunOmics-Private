import { describe, it, expect } from 'vitest'
import type { StyleSpecification } from 'maplibre-gl'
import { heatBasemapStyle, maptilerStyle, shareBasemapStyle, withLanguage } from '../maptiler'
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

describe('heatBasemapStyle (3.0.1)', () => {
  const light = () => maptilerStyle(false, 'k')
  const background = (s: StyleSpecification) => (s.layers.find((l) => l.type === 'background')!.paint as Record<string, unknown>)['background-color']

  it('steps the light ground back toward grey, so the heat is the only saturated colour', () => {
    const muted = heatBasemapStyle(light(), false)
    const json = JSON.stringify(muted)
    expect(background(muted)).not.toBe(MAP_STYLE_COLORS.light.background)
    for (const role of ['park', 'water', 'land'] as const) expect(json).not.toContain(MAP_STYLE_COLORS.light[role])
  })

  it('leaves the dark style, and the style it was given, alone', () => {
    const dark = maptilerStyle(true, 'k')
    expect(heatBasemapStyle(dark, true)).toBe(dark)
    const source = light()
    heatBasemapStyle(source, false)
    expect(background(source)).toBe(MAP_STYLE_COLORS.light.background)
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
