import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ACCENT_CHANGE_EVENT,
  ACCENT_STORAGE_KEY,
  isAccentId,
  persistAccent,
} from '@/lib/accent'

describe('isAccentId', () => {
  it('accepts known accent ids', () => {
    expect(isAccentId('performance')).toBe(true)
  })

  it('rejects unknown values', () => {
    expect(isAccentId('not-an-accent')).toBe(false)
  })

  it('rejects null', () => {
    expect(isAccentId(null)).toBe(false)
  })
})

describe('persistAccent', () => {
  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-accent')
  })

  it('stores the accent in localStorage', () => {
    persistAccent('impact')
    expect(localStorage.getItem(ACCENT_STORAGE_KEY)).toBe('impact')
  })

  it('sets the data-accent attribute on the document root', () => {
    persistAccent('endurance')
    expect(document.documentElement.getAttribute('data-accent')).toBe('endurance')
  })

  it('dispatches the accent-change event', () => {
    const listener = vi.fn()
    window.addEventListener(ACCENT_CHANGE_EVENT, listener)
    persistAccent('motivation')
    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener(ACCENT_CHANGE_EVENT, listener)
  })
})
