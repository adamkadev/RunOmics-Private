import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AthleteDetails, AthleteKeyNumbers } from '@/components/profile/ProfileAthleteStats'
import { ProfileHrZones } from '@/components/profile/ProfileHrZones'
import { t } from '@/i18n'

const z = t.profile.trainingZones
const a = t.settings.athlete

describe('capability-driven athlete metrics', () => {
  it('shows configured HR zones without fabricating an LTHR value', () => {
    render(
      <ProfileHrZones
        athlete={{ hrZoneBoundsBpm: [100, 120, 140, 160, 180] }}
        weeklyZoneTime={[]}
        recentZoneTime={[]}
      />
    )

    expect(screen.getByText('100–119')).toBeInTheDocument()
    expect(screen.queryByText(/170/)).not.toBeInTheDocument()
  })

  it('derives zone boundaries from a real LTHR', () => {
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={[]} recentZoneTime={[]} />)
    // Z4 starts at 95% of LTHR, Z5 at LTHR itself.
    expect(within(screen.getByTestId('zone-row-5')).getByText('≥ 172')).toBeInTheDocument()
    expect(within(screen.getByTestId('zone-row-4')).getByText('163–171')).toBeInTheDocument()
  })

  it('omits an unavailable threshold pace tile instead of rendering a placeholder', () => {
    render(<AthleteKeyNumbers athlete={{ vmaKmh: 15.2 }} />)

    expect(screen.getByText(a.vma)).toBeInTheDocument()
    expect(screen.queryByText(a.thresholdPace)).not.toBeInTheDocument()
    expect(screen.queryByText(t.profile.athlete.notSet)).not.toBeInTheDocument()
  })

  // v5.3: VO₂max left the grid for the grade card; fitness age took its place.
  it('shows VMA, fitness age, threshold HR and threshold pace, each labelled, with no category toggle', () => {
    render(
      <AthleteKeyNumbers
        athlete={{ vmaKmh: 17.5, lthrBpm: 172, thresholdPaceSecPerKm: 258, fitnessAgeYrs: 20.3, age: 29 }}
      />
    )

    const labels = screen.getAllByTestId('athlete-key-number').map((tile) => tile.firstElementChild?.textContent)
    expect(labels).toEqual([a.vma, a.fitnessAge, a.thresholdHr, a.thresholdPace])
    expect(screen.queryByText(a.vo2max)).not.toBeInTheDocument()
    expect(screen.getByText('4:18')).toBeInTheDocument()
    expect(screen.getByTestId('athlete-key-numbers').textContent).toContain(`20${a.ofAge(29)}`)
    expect(screen.getAllByRole('button', { name: /^What is/ })).toHaveLength(3)
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  // v5.3: resting and max HR stay as they are; fitness age is in the grid now.
  it('shows heart as one row: resting HR and max HR', () => {
    render(
      <AthleteDetails
        athlete={{
          restingHrBpm: 44,
          maxHrBpm: 201,
          age: 29,
          fitnessAgeYrs: 20.3,
          achievableFitnessAge: 18,
          bmi: 20.5,
        } as never}
      />
    )

    const row = screen.getByTestId('athlete-details')
    expect(within(row).getByText(a.restingHr)).toBeInTheDocument()
    expect(within(row).getByText(a.maxHr)).toBeInTheDocument()
    expect(within(row).queryByText(a.fitnessAge)).toBeNull()
    expect(screen.queryByText(a.bmi)).not.toBeInTheDocument()
    expect(row.querySelector('svg')).toBeNull()
  })

  // C2: one card, the labels open their definitions; v4.17: a strip, 2 x 2 on a phone.
  it('puts the four key numbers in one card, 2 x 2 on a phone and one row from sm', () => {
    render(<AthleteKeyNumbers athlete={{ vmaKmh: 17.5, lthrBpm: 172, thresholdPaceSecPerKm: 258, fitnessAgeYrs: 20 }} />)
    expect(screen.getAllByTestId('athlete-key-numbers')).toHaveLength(1)
    expect(screen.getAllByTestId('athlete-key-number')).toHaveLength(4)
    const card = screen.getByTestId('athlete-key-numbers')
    expect(card.className).toContain('grid-cols-2')
    expect(card.className).toContain('sm:grid-cols-[repeat(var(--cells),minmax(0,1fr))]')
    expect(card.style.getPropertyValue('--cells')).toBe('4')
  })
})

describe('ProfileHrZones table', () => {
  const week = [
    { zone: 4, seconds: 9 * 60, percent: 0 },
    { zone: 5, seconds: 5 * 60, percent: 0 },
  ]
  const recent = [{ zone: 2, seconds: 125 * 60, percent: 0 }]

  it('labels Pace, HR and Time as their own columns', () => {
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={week} recentZoneTime={recent} />)
    const header = screen.getByTestId('zone-columns')
    for (const column of [z.columnZone, z.columnPace, z.columnHr, z.columnTime]) {
      expect(within(header).getByText(column)).toBeInTheDocument()
    }
  })

  // v4.17: time is "9 min" under an hour, "2 h 05" over; the window's total
  // and its Z4-Z5 share sit over one bar of zone segments. The week under way
  // is not a week's split yet: no verdict and no colour.
  it('writes time with its units and puts the total and the hard share over the zone bar', () => {
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={week} recentZoneTime={recent} />)
    expect(within(screen.getByTestId('zone-row-4')).getByText(`9 ${t.units.min}`)).toBeInTheDocument()
    expect(screen.getByTestId('zone-total').textContent).toBe(`14${t.units.min}`)
    const share = screen.getByTestId('zone-hard-share')
    expect(share.textContent).toBe(z.hardShare(100, z.soFar))
    expect(share.className).toContain('text-muted-foreground')
    const stack = screen.getByTestId('zone-stack')
    expect([...stack.querySelectorAll('[data-zone]')].map((el) => el.getAttribute('data-zone'))).toEqual(['4', '5'])
  })

  // Design review, Oct 2026: "Hard 7 %" read amber here against a 10-15 %
  // target while Analytics > Intensity read the same weeks "In range". One
  // split and one verdict now, and too little hard is never a caution.
  it('reads four weeks by the verdict Analytics gives the same time', () => {
    const inRange = [
      { zone: 2, seconds: 93 * 60, percent: 0 },
      { zone: 4, seconds: 7 * 60, percent: 0 },
    ]
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={[]} recentZoneTime={inRange} />)
    const share = screen.getByTestId('zone-hard-share')
    expect(share.textContent).toBe(z.hardShare(7, t.analytics.cards.easyHard.inRange))
    expect(share.className).toContain('text-[var(--pos)]')
    expect(screen.getByTestId('zone-total').textContent).toBe(`1${t.units.hour} 40${t.units.min}`)
  })

  it('reads too much hard over four weeks as a caution', () => {
    const tooHard = [
      { zone: 2, seconds: 60 * 60, percent: 0 },
      { zone: 4, seconds: 40 * 60, percent: 0 },
    ]
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={[]} recentZoneTime={tooHard} />)
    const share = screen.getByTestId('zone-hard-share')
    expect(share.textContent).toBe(z.hardShare(40, t.analytics.cards.easyHard.tooHard))
    expect(share.className).toContain('text-[var(--warn)]')
  })

  // v4.4.1: a zone under 1% of the window is not drawn at all, not a sliver.
  it('leaves a zone under 1% out of the bar', () => {
    const withSliver = [
      { zone: 2, seconds: 100 * 60, percent: 0 },
      { zone: 5, seconds: 20, percent: 0 },
    ]
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={withSliver} recentZoneTime={[]} />)
    const zones = [...screen.getByTestId('zone-stack').querySelectorAll('[data-zone]')].map((el) => el.getAttribute('data-zone'))
    expect(zones).toEqual(['2'])
  })

  it('has a single Week / 4 weeks toggle that switches the whole table', async () => {
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={week} recentZoneTime={recent} />)
    expect(screen.getAllByRole('tablist')).toHaveLength(1)

    await userEvent.click(screen.getByRole('tab', { name: z.fourWeeks }))
    expect(screen.getByTestId('zone-total').textContent).toBe(`2${t.units.hour} 5${t.units.min}`)
    expect(within(screen.getByTestId('zone-row-2')).getByText(`2 ${t.units.hour} 05`)).toBeInTheDocument()
    expect(within(screen.getByTestId('zone-row-4')).getByText(`0 ${t.units.min}`)).toBeInTheDocument()
  })

  it('falls back to the last 4 weeks when this week is empty, and says so', () => {
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={[]} recentZoneTime={recent} />)
    expect(screen.getByRole('tab', { name: z.fourWeeks })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(z.emptyWeekFallback)).toBeInTheDocument()
  })
})
