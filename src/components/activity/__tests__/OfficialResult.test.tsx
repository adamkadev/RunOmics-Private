import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { OfficialRaceResult } from '@/domain/activity/raceResult'
import { OfficialResult } from '../OfficialResult'

const escher: OfficialRaceResult = {
  activityId: '24249913094',
  eventName: 'Escher Kulturlaf',
  date: '2026-09-05',
  distanceMeters: 5_000,
  chipTimeSeconds: 1_292,
  gunTimeSeconds: 1_293,
  overallPlace: 28,
  finisherCount: 188,
}

const renderResult = (result: OfficialRaceResult, isPersonalBest = false) =>
  render(
    <OfficialResult
      result={result}
      garminDistanceKm={5.25}
      garminDurationSeconds={1_310}
      isPersonalBest={isPersonalBest}
    />,
  )

const remich: OfficialRaceResult = {
  activityId: '20526043740',
  eventName: 'Wine Route Remich',
  date: '2025-09-28',
  distanceMeters: 5_000,
  chipTimeSeconds: 1_242,
  gunTimeSeconds: 1_246,
  overallPlace: 63,
  finisherCount: 512,
}

describe('OfficialResult', () => {
  it('shows the certified distance, chip time and official pace', () => {
    renderResult(escher)

    expect(screen.getByText(/5\.00 km/)).toBeInTheDocument()
    expect(screen.getByText(/21:32/)).toBeInTheDocument()
    expect(screen.getByText(/4:18/)).toBeInTheDocument()
  })

  it('reads the placing against the field size', () => {
    renderResult(escher)
    expect(screen.getByText('28 of 188')).toBeInTheDocument()
  })

  it('shows how far up the field that placing is', () => {
    renderResult(escher)
    expect(screen.getByText('Top 15%')).toBeInTheDocument()
  })

  it('omits the top percentage when the field size is unknown', () => {
    const { finisherCount, ...withoutField } = escher
    expect(finisherCount).toBe(188)
    renderResult(withoutField)

    expect(screen.queryByText(/^Top /)).not.toBeInTheDocument()
    expect(screen.getByText('28th')).toBeInTheDocument()
  })

  it('keeps the watch measurement visible without presenting it as the result', () => {
    renderResult(escher)

    expect(screen.getByText(/Watch recorded/)).toBeInTheDocument()
    expect(screen.getByText(/5\.25 km in 21:50/)).toBeInTheDocument()
    expect(screen.queryByText(/4:09/)).not.toBeInTheDocument()
  })
})

describe('OfficialResult as the personal best', () => {
  it('carries the PR badge on the certified time, not on a device effort', () => {
    renderResult(remich, true)

    expect(screen.getByText(/20:42/)).toBeInTheDocument()
    expect(screen.getByText('PR')).toBeInTheDocument()
  })

  it('shows no PR badge when the result is not the record', () => {
    renderResult(remich, false)

    expect(screen.getByText(/20:42/)).toBeInTheDocument()
    expect(screen.queryByText('PR')).not.toBeInTheDocument()
  })

  it('keeps the placing readable alongside the record badge', () => {
    renderResult(remich, true)

    expect(screen.getByText('63 of 512')).toBeInTheDocument()
    expect(screen.getByText('Top 13%')).toBeInTheDocument()
  })
})
