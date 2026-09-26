import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WearBar } from '../WearBar'
import { wearTone } from '../shoeWear'

describe('WearBar', () => {
  // C4, v4.4b: the accent under 80%, amber from 80 to 100%, Z5 past it.
  it('changes colour at 80% and at 100% of the limit', () => {
    expect(wearTone({ totalKm: 790, maxKm: 1000 })).toBe('ok')
    expect(wearTone({ totalKm: 800, maxKm: 1000 })).toBe('near')
    expect(wearTone({ totalKm: 1000, maxKm: 1000 })).toBe('near')
    expect(wearTone({ totalKm: 1001, maxKm: 1000 })).toBe('over')

    const fill = (km: number) => {
      const { unmount } = render(<WearBar totalKm={km} maxKm={1000} />)
      const bg = screen.getByTestId('wear-fill').style.background
      unmount()
      return bg
    }
    expect(fill(676)).toBe('var(--accent)')
    expect(fill(850)).toBe('var(--tone-caution)')
    expect(fill(1200)).toBe('var(--zone-5)')
  })

  it('ticks 80% of the limit, and moves the tick in once the pair is past it', () => {
    const { unmount } = render(<WearBar totalKm={676} maxKm={1000} />)
    expect(screen.getByTestId('wear-tick').style.left).toBe('80%')
    unmount()

    render(<WearBar totalKm={1_375} maxKm={500} />)
    expect(screen.getByTestId('wear-tick').style.left).toBe(`${((500 * 0.8) / 1_375) * 100}%`)
    expect(screen.getByTestId('wear-fill').style.width).toBe('100%')
  })

  // C5: a retired pair's bar is full and muted, with no tick.
  it('draws a retired pair full width in muted ink', () => {
    render(<WearBar totalKm={994} maxKm={1000} retired />)
    expect(screen.getByTestId('wear-fill').style.background).toBe('var(--muted-foreground)')
    expect(screen.getByTestId('wear-fill').style.width).toBe('100%')
    expect(screen.queryByTestId('wear-tick')).toBeNull()
  })
})
