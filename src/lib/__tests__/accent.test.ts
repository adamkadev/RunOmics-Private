import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ACCENT_CHANGE_EVENT,
  ACCENT_IDS,
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  isAccentId,
  parseAccent,
  persistAccent,
} from '@/lib/accent'

describe('the v4.17 accents', () => {
  it('offers five palettes, teal first and by default', () => {
    expect(ACCENT_IDS).toEqual(['teal', 'cyan', 'violet', 'pink', 'mono'])
    expect(DEFAULT_ACCENT).toBe('teal')
  })

  it('knows its own ids only', () => {
    expect(isAccentId('cyan')).toBe(true)
    expect(isAccentId('lime')).toBe(false)
    expect(isAccentId('performance')).toBe(false)
    expect(isAccentId(null)).toBe(false)
  })
})

describe('reading a stored preference', () => {
  it('reads a palette id as itself', () => {
    expect(parseAccent('pink')).toBe('pink')
  })

  it('reads the retired lime as the default', () => {
    expect(parseAccent('lime')).toBe(DEFAULT_ACCENT)
  })

  it('reads a pre-v4.3 accent as its nearest palette', () => {
    expect(parseAccent('nature')).toBe('teal')
    expect(parseAccent('performance')).toBe('violet')
    expect(parseAccent('endurance')).toBe('violet')
    expect(parseAccent('silver')).toBe('mono')
  })

  it('reads v4.3\'s indigo and lavender, and v4.17\'s periwinkle, as cyan and violet', () => {
    expect(parseAccent('indigo')).toBe('cyan')
    expect(parseAccent('periwinkle')).toBe('cyan')
    expect(parseAccent('lavender')).toBe('violet')
  })

  it('falls back to the default for a custom hue, nothing, or noise', () => {
    expect(parseAccent('custom:225')).toBe(DEFAULT_ACCENT)
    expect(parseAccent(null)).toBe(DEFAULT_ACCENT)
    expect(parseAccent('')).toBe(DEFAULT_ACCENT)
    expect(parseAccent('not-an-accent')).toBe(DEFAULT_ACCENT)
  })
})

describe('persistAccent', () => {
  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-accent')
  })

  it('stores the palette, sets the attribute and announces the change', () => {
    const onChange = vi.fn()
    window.addEventListener(ACCENT_CHANGE_EVENT, onChange)
    localStorage.setItem('runomics-accent-css', 'stale')

    persistAccent('cyan')

    expect(localStorage.getItem(ACCENT_STORAGE_KEY)).toBe('cyan')
    expect(localStorage.getItem('runomics-accent-css')).toBeNull()
    expect(document.documentElement.getAttribute('data-accent')).toBe('cyan')
    expect(onChange).toHaveBeenCalled()
    window.removeEventListener(ACCENT_CHANGE_EVENT, onChange)
  })
})
