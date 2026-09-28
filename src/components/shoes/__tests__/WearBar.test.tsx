import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WearBar } from '../WearBar'
import { shoeWearStatus } from '../shoeWear'

describe('WearBar', () => {
  // v4.17: the accent while the pair has life in it, warn from Replace soon
  // at 70%, neg from Replace at 90% and past the limit - the page's status.
  it('changes colour at 70% and at 90% of the limit', () => {
    expect(shoeWearStatus({ totalKm: 690, maxKm: 1000 })).toBe('ok')
    expect(shoeWearStatus({ totalKm: 699, maxKm: 1000 })).toBe('watch')
    expect(shoeWearStatus({ totalKm: 900, maxKm: 1000 })).toBe('replace')
    expect(shoeWearStatus({ totalKm: 1200, maxKm: 1000 })).toBe('replace')

    const fill = (km: number) => {
      const { unmount } = render(<WearBar totalKm={km} maxKm={1000} />)
      const bg = screen.getByTestId('wear-fill').style.background
      unmount()
      return bg
    }
    expect(fill(530)).toBe('var(--accent)')
    expect(fill(699)).toBe('var(--warn)')
    expect(fill(1200)).toBe('var(--neg)')
  })

  it('ticks the retire-from-workouts threshold, and moves it in once the pair is past its limit', () => {
    const { unmount } = render(<WearBar totalKm={676} maxKm={1000} tickKm={800} />)
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
