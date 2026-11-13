import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { AthleteStats } from '@/components/profile/ProfileAthleteStats'
import { FitnessAgeCard } from '@/components/profile/FitnessAgeCard'
import { ProfileHrZones } from '@/components/profile/ProfileHrZones'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { t } from '@/i18n'

const z = t.profile.trainingZones
const a = t.settings.athlete

describe('capability-driven athlete metrics', () => {
  it('shows configured HR zones without fabricating an LTHR value', () => {
    render(
      <ProfileHrZones athlete={{ hrZoneBoundsBpm: [100, 120, 140, 160, 180] }} />
    )

    expect(screen.getByText('100–119')).toBeInTheDocument()
    expect(screen.queryByText(/170/)).not.toBeInTheDocument()
  })

  it('derives zone boundaries from a real LTHR', () => {
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} />)
    // Z4 starts at 95% of LTHR, Z5 at LTHR itself.
    expect(within(screen.getByTestId('zone-row-5')).getByText('≥ 172')).toBeInTheDocument()
    expect(within(screen.getByTestId('zone-row-4')).getByText('163–171')).toBeInTheDocument()
  })

  it('lists the zones Z1 first, as the bar above them reads', () => {
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} />)
    const rows = [...document.querySelectorAll('[data-testid^="zone-row-"]')].map((row) => row.getAttribute('data-testid'))
    expect(rows).toEqual(['zone-row-1', 'zone-row-2', 'zone-row-3', 'zone-row-4', 'zone-row-5'])
  })

  it('omits an unavailable threshold pace instead of rendering a placeholder', () => {
    render(<AthleteStats athlete={{ vmaKmh: 15.2 }} />)

    expect(screen.getByText(a.vma)).toBeInTheDocument()
    expect(screen.queryByText(a.thresholdPace)).not.toBeInTheDocument()
  })

  it('shows the heart row, then threshold pace and VMA, in one card', () => {
    render(<AthleteStats athlete={{ restingHrBpm: 45, lthrBpm: 179, maxHrBpm: 200, vmaKmh: 16.3, thresholdPaceSecPerKm: 261 }} />)

    const cells = screen.getAllByTestId('athlete-stat')
    expect(cells.map((cell) => cell.firstElementChild?.textContent)).toEqual([a.restingHr, a.thresholdHr, a.maxHr, a.thresholdPace, a.vma])
    expect(cells.map((cell) => cell.lastElementChild?.textContent)).toEqual([
      `45${t.units.bpm}`, `179${t.units.bpm}`, `200${t.units.bpm}`, `4:21${t.units.perKm}`, `16.3${t.units.kmh}`,
    ])
    const card = screen.getByTestId('athlete-stats')
    expect(card.className).toContain('grid-cols-6')
    expect(card.textContent).not.toMatch(/estimated|zones\)/i)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('draws a line between the rows and between the cells of each', () => {
    render(<AthleteStats athlete={{ restingHrBpm: 45, lthrBpm: 179, maxHrBpm: 200, vmaKmh: 16.3, thresholdPaceSecPerKm: 261 }} />)
    const cells = screen.getAllByTestId('athlete-stat')
    expect(cells.map((cell) => cell.className.includes('border-l'))).toEqual([false, true, true, false, true])
    expect(cells.map((cell) => cell.className.includes('border-t'))).toEqual([false, false, false, true, true])
  })

  it('splits a short last row evenly', () => {
    const spans = () => screen.getAllByTestId('athlete-stat').map((cell) => cell.className.match(/col-span-\d/)?.[0] ?? null)
    const { unmount } = render(<AthleteStats athlete={{ restingHrBpm: 45, lthrBpm: 179, maxHrBpm: 200, vmaKmh: 16.3, thresholdPaceSecPerKm: 261 }} />)
    expect(spans()).toEqual(['col-span-2', 'col-span-2', 'col-span-2', 'col-span-3', 'col-span-3'])
    unmount()
    render(<AthleteStats athlete={{ restingHrBpm: 76, lthrBpm: 165, maxHrBpm: 206, vmaKmh: 10.6 }} />)
    expect(spans()).toEqual(['col-span-2', 'col-span-2', 'col-span-2', 'col-span-6'])
  })

  it('keeps a full last row as thirds', () => {
    render(<AthleteStats athlete={{ restingHrBpm: 76, maxHrBpm: 206, vmaKmh: 10.6 }} />)
    expect(screen.getAllByTestId('athlete-stat').every((cell) => cell.className.includes('col-span-2'))).toBe(true)
  })
})

describe('FitnessAgeCard', () => {
  const trend = [
    { date: '2026-09-28', years: 19.6 },
    { date: '2026-10-05', years: 18.6 },
    { date: '2026-10-19', years: 18.2 },
  ]

  it('reads the fitness age against the real age, the potential beside it, and the year as a line', () => {
    render(<FitnessAgeCard view={{ now: 21.6, age: 25, achievable: 18, trend }} />)
    expect(screen.getByTestId('fitness-age-value').textContent).toBe(`22${a.ofAge(25)}`)
    expect(screen.getByTestId('fitness-age-card').textContent).toContain(a.fitnessAgeBand.younger(3))
    expect(screen.getByTestId('fitness-age-achievable').textContent).toBe(`${a.achievableFitnessAge} 18`)
    expect(screen.getByTestId('fitness-age-real')).toBeInTheDocument()
  })

  it('says on par, and draws no line without a history', () => {
    render(<FitnessAgeCard view={{ now: 21.6, age: 22, achievable: null, trend: [] }} />)
    expect(screen.getByTestId('fitness-age-card').textContent).toContain(a.fitnessAgeBand.onPar)
    expect(screen.queryByTestId('fitness-age-achievable')).toBeNull()
    expect(screen.queryByTestId('fitness-age-trend')).toBeNull()
  })
})

describe('ProfileHrZones table', () => {
  const paceZones = { zones: [2, 3, 4, 5].map((hrZone) => ({ hrZone, paceMinSecPerKm: 200 + hrZone * 20, paceMaxSecPerKm: 219 + hrZone * 20 })) } as unknown as TrainingZonesData

  it('gives the ranges only, how they are set, and leaves time in zones to Analytics', () => {
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} paceZones={paceZones} />)
    const columns = screen.getByTestId('zone-columns')
    expect([...columns.children].map((c) => c.textContent)).toEqual([z.columnZone, z.columnPace, z.columnHr])
    expect(screen.getByTestId('zones-source').textContent).toBe(z.fromThreshold(172))
    expect(screen.getByTestId('time-in-zones-link').getAttribute('href')).toBe('/analytics?tab=health')
    expect(screen.queryByTestId('hr-only')).toBeNull()
  })

  it('says why a watch without pace zones gives heart rate alone', () => {
    render(<ProfileHrZones athlete={{ maxHrBpm: 194, hrZoneBoundsBpm: [120, 140, 155, 170, 182] }} />)
    expect(screen.getByTestId('zones-source').textContent).toBe(z.fromMax(194))
    expect(screen.getByTestId('hr-only').textContent).toBe(z.hrOnly)
  })
})
