import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WearBar } from '../WearBar'
import { shoeWearStatus } from '../shoeWear'

describe('WearBar', () => {
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
    expect(fill(1200)).toBe('var(--warn)')
  })

  it('ticks the retire-from-workouts threshold, and moves it in once the pair is past its limit', () => {
    const { unmount } = render(<WearBar totalKm={676} maxKm={1000} tickKm={800} />)
    expect(screen.getByTestId('wear-tick').style.left).toBe('80%')
    unmount()

    render(<WearBar totalKm={1_375} maxKm={500} />)
    expect(screen.getByTestId('wear-tick').style.left).toBe(`${((500 * 0.8) / 1_375) * 100}%`)
    const limit = `${(500 / 1_375) * 100}%`
    expect(screen.getByTestId('wear-fill').style.width).toBe(limit)
    expect(screen.getByTestId('wear-overrun').style.left).toBe(limit)
    expect(screen.getByTestId('wear-limit-tick').style.left).toBe(limit)
  })

  it('names the limit, not the retire point, once the pair is past it', () => {
    render(<WearBar totalKm={1_000} maxKm={500} tickLabel="400 km · retire from workouts" limitLabel="500 km limit" />)
    const label = screen.getByTestId('wear-limit-label')
    expect(label.textContent).toBe('500 km limit')
    expect((label.firstElementChild as HTMLElement).style.flexBasis).toBe('50%')
    expect(screen.queryByTestId('wear-tick-label')).toBeNull()
  })

  it('draws no limit tick while the pair is within its limit', () => {
    render(<WearBar totalKm={676} maxKm={1000} tickKm={800} limitLabel="1,000 km limit" />)
    expect(screen.queryByTestId('wear-limit-tick')).toBeNull()
    expect(screen.queryByTestId('wear-overrun')).toBeNull()
  })

  it('draws a retired pair full width in muted ink', () => {
    render(<WearBar totalKm={994} maxKm={1000} retired tickLabel="800 km" />)
    expect(screen.getByTestId('wear-fill').style.background).toBe('var(--muted-foreground)')
    expect(screen.getByTestId('wear-fill').style.width).toBe('100%')
    expect(screen.queryByTestId('wear-tick')).toBeNull()
    expect(screen.queryByTestId('wear-tick-label')).toBeNull()
  })

  it('names the tick under it, starting where the tick is', () => {
    const { unmount } = render(<WearBar totalKm={676} maxKm={1000} tickKm={800} tickLabel="800 km · retire from workouts" />)
    let label = screen.getByTestId('wear-tick-label')
    expect(label.textContent).toBe('800 km · retire from workouts')
    expect((label.firstElementChild as HTMLElement).style.flexBasis).toBe('80%')
    unmount()

    // Past the limit the tick moves in, and its label with it.
    render(<WearBar totalKm={1_000} maxKm={500} tickLabel="400 km" />)
    label = screen.getByTestId('wear-tick-label')
    expect((label.firstElementChild as HTMLElement).style.flexBasis).toBe('40%')
  })

  it('writes no label unless asked to', () => {
    render(<WearBar totalKm={676} maxKm={1000} tickKm={800} />)
    expect(screen.getByTestId('wear-tick')).toBeInTheDocument()
    expect(screen.queryByTestId('wear-tick-label')).toBeNull()
  })
})
