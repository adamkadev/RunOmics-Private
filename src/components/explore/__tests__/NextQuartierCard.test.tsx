import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UnitCoverage } from '@/domain/explore/types'
import { t } from '@/i18n'
import { NextQuartierCard } from '../NextQuartierCard'

const d = t.pages.map.districts

const UNIT: UnitCoverage = {
  id: 'test-bravo',
  name: 'Bravo',
  kind: 'quartier',
  commune: 'Testville',
  label: [-149.99, 45.001],
  visited: 12,
  total: 150,
  pct: 8,
  state: 'fog',
  kmRun: 2.4,
  lastRunDate: '2026-08-14',
  distanceKm: 1.9,
}

const card = () => screen.getByTestId('next-quartier-card')

describe('NextQuartierCard', () => {
  afterEach(cleanup)

  it('names the next quartier, how much of it is explored and how far it is', () => {
    render(<NextQuartierCard unit={UNIT} onOpen={() => {}} />)
    expect(card()).toHaveTextContent(d.nextToExplore)
    expect(card()).toHaveTextContent('Bravo')
    expect(card()).toHaveTextContent('8% explored · 1.9 km from home')
  })

  it('leaves the distance out without a home', () => {
    render(<NextQuartierCard unit={{ ...UNIT, distanceKm: null }} onOpen={() => {}} />)
    expect(card()).toHaveTextContent(/8% explored$/)
  })

  it('is sheet glass: one surface, its layers inside', () => {
    render(<NextQuartierCard unit={UNIT} onOpen={() => {}} />)
    expect(card()).toHaveClass('lg', 'lg-sheet')
    expect(card().querySelectorAll(':scope > .lg-blur, :scope > .lg-edge, :scope > .lg-tint')).toHaveLength(3)
  })

  it('without a way to plan a run, is one button that opens the quartier’s sheet', () => {
    const onOpen = vi.fn()
    render(<NextQuartierCard unit={UNIT} onOpen={onOpen} />)
    expect(screen.queryByRole('button', { name: d.planRun })).toBeNull()
    expect(card().tagName).toBe('BUTTON')
    expect(card()).toHaveAttribute('aria-haspopup', 'dialog')
    fireEvent.click(card())
    expect(onOpen).toHaveBeenCalledWith('test-bravo')
  })

  it('with one, holds the Plan a run button, and the card itself is not a button', () => {
    const onOpen = vi.fn()
    const onPlanRun = vi.fn()
    render(<NextQuartierCard unit={UNIT} onOpen={onOpen} onPlanRun={onPlanRun} />)
    expect(card().tagName).not.toBe('BUTTON')
    expect(card()).toHaveClass('lg', 'lg-sheet')
    fireEvent.click(screen.getByRole('button', { name: d.planRun }))
    expect(onPlanRun).toHaveBeenCalledWith('test-bravo')
    expect(onOpen).not.toHaveBeenCalled()
  })
})
