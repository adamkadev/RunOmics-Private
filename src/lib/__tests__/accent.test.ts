import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ACCENT_CHANGE_EVENT,
  ACCENT_CSS_STORAGE_KEY,
  ACCENT_STORAGE_KEY,
  CUSTOM_ACCENT_STYLE_ID,
  FALLBACK_ACCENT,
  isAccentId,
  isReservedHue,
  parseAccent,
  persistAccent,
  resolveAccent,
  serializeAccent,
} from '@/lib/accent'

describe('isAccentId', () => {
  it('accepts known accent ids', () => {
    expect(isAccentId('performance')).toBe(true)
    expect(isAccentId('teal')).toBe(true)
    expect(isAccentId('silver')).toBe(true)
  })

  it('rejects unknown values', () => {
    expect(isAccentId('not-an-accent')).toBe(false)
  })

  it('rejects null', () => {
    expect(isAccentId(null)).toBe(false)
  })
})

describe('reading a stored preference', () => {
  it('round-trips a curated accent', () => {
    expect(parseAccent(serializeAccent({ kind: 'curated', id: 'endurance' }))).toEqual({
      kind: 'curated',
      id: 'endurance',
    })
  })

  it('round-trips a custom hue', () => {
    expect(parseAccent(serializeAccent({ kind: 'custom', hue: 225 }))).toEqual({ kind: 'custom', hue: 225 })
  })

  it('resolves an id the app has dropped to blue rather than to undefined', () => {
    // 'motivation' was orange, which now sits inside the reserved band.
    expect(parseAccent('motivation')).toEqual({ kind: 'curated', id: FALLBACK_ACCENT })
    expect(parseAccent('impact')).toEqual({ kind: 'curated', id: FALLBACK_ACCENT })
    expect(parseAccent('custom:')).toEqual({ kind: 'curated', id: FALLBACK_ACCENT })
    expect(parseAccent('custom:not-a-number')).toEqual({ kind: 'curated', id: FALLBACK_ACCENT })
    expect(resolveAccent(parseAccent('impact')).hue).toBeTypeOf('number')
  })

  it('rejects a reserved hue injected straight into storage', () => {
    for (const reserved of [15, 30, 45, 60, 75, 90]) {
      const resolved = resolveAccent(parseAccent(`custom:${reserved}`))
      expect(resolved.hue, `custom:${reserved}`).not.toBe(reserved)
      expect(isReservedHue(resolved.hue)).toBe(false)
    }
  })

  it('quantises a hue that was never on the wheel', () => {
    expect(resolveAccent(parseAccent('custom:227')).hue).toBe(225)
  })

  it('reads an empty store as the accent the base stylesheet already paints', () => {
    expect(parseAccent(null)).toEqual({ kind: 'curated', id: 'nature' })
  })
})

describe('persistAccent', () => {
  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-accent')
    document.getElementById(CUSTOM_ACCENT_STYLE_ID)?.remove()
  })

  it('stores the accent in localStorage', () => {
    persistAccent('teal')
    expect(localStorage.getItem(ACCENT_STORAGE_KEY)).toBe('teal')
  })

  it('sets the data-accent attribute on the document root', () => {
    persistAccent('endurance')
    expect(document.documentElement.getAttribute('data-accent')).toBe('endurance')
  })

  it('dispatches the accent-change event', () => {
    const listener = vi.fn()
    window.addEventListener(ACCENT_CHANGE_EVENT, listener)
    persistAccent('silver')
    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener(ACCENT_CHANGE_EVENT, listener)
  })

  it('ships a custom hue as its own stylesheet, stored for the next load', () => {
    persistAccent({ kind: 'custom', hue: 225 })

    expect(localStorage.getItem(ACCENT_STORAGE_KEY)).toBe('custom:225')
    expect(document.documentElement.getAttribute('data-accent')).toBe('custom')

    const css = localStorage.getItem(ACCENT_CSS_STORAGE_KEY)
    expect(css).toContain('--accent:')
    expect(document.getElementById(CUSTOM_ACCENT_STYLE_ID)?.textContent).toBe(css)
  })

  it('clears the custom stylesheet when a curated accent is chosen again', () => {
    persistAccent({ kind: 'custom', hue: 225 })
    persistAccent('performance')

    expect(localStorage.getItem(ACCENT_CSS_STORAGE_KEY)).toBeNull()
    expect(document.getElementById(CUSTOM_ACCENT_STYLE_ID)).toBeNull()
    expect(document.documentElement.getAttribute('data-accent')).toBe('performance')
  })
})
