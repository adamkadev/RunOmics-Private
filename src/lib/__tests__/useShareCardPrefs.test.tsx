import { afterEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useShareCardPrefs } from '@/lib/useShareCardPrefs'

describe('useShareCardPrefs', () => {
  afterEach(() => localStorage.clear())

  it('opens on the size picked last time, a feed post until one is picked', () => {
    const first = renderHook(() => useShareCardPrefs('dark', true))
    expect(first.result.current.size).toBe('portrait')
    act(() => first.result.current.setSize('story'))
    expect(first.result.current.size).toBe('story')
    first.unmount()

    expect(renderHook(() => useShareCardPrefs('dark', true)).result.current.size).toBe('story')
  })

  it('keeps the other picks to the sheet they were made in', () => {
    const first = renderHook(() => useShareCardPrefs('dark', true))
    act(() => first.result.current.setTheme('light'))
    first.unmount()
    expect(renderHook(() => useShareCardPrefs('dark', true)).result.current.theme).toBe('dark')
  })
})
