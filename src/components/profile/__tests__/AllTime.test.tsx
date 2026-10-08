import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { allTimeView } from '@/application/usecases/GetAllTime'
import { AllTime, monthlyScale } from '../AllTime'

const run = (date: string, distanceKm: number) => ({ date, distanceKm, durationSeconds: distanceKm * 330 })

describe('monthlyScale', () => {
  // Design review, Oct 2026: the monthly km had no scale to read a month by.
  it('picks the smallest round step that needs three lines at most', () => {
    expect(monthlyScale(194)).toEqual({ top: 200, ticks: [100, 200] })
    expect(monthlyScale(101)).toEqual({ top: 150, ticks: [50, 100, 150] })
    expect(monthlyScale(58)).toEqual({ top: 60, ticks: [20, 40, 60] })
    expect(monthlyScale(200)).toEqual({ top: 200, ticks: [100, 200] })
  })

  it('still draws one line for a first month with next to nothing in it', () => {
    expect(monthlyScale(0)).toEqual({ top: 5, ticks: [5] })
  })
})

describe('AllTime monthly km', () => {
  it('labels the scale up the side and draws each month against it', () => {
    const view = allTimeView([run('2026-08-05', 100), run('2026-09-10', 194)], '2026-10-07')
    render(<AllTime view={view} />)

    const axis = screen.getByTestId('monthly-axis')
    expect([...axis.children].map((label) => label.textContent)).toEqual(['100', '200'])
    expect(screen.getAllByTestId('monthly-gridline').map((line) => line.style.bottom)).toEqual(['50%', '100%'])
    // Against the scale's 200 km top, not the best month's 194.
    const bars = Object.fromEntries(screen.getAllByTestId('month-bar').map((bar) => [bar.dataset.month, bar.style.height]))
    expect(bars).toEqual({ '2026-08': '48px', '2026-09': '93px', '2026-10': '3px' })
  })
})
