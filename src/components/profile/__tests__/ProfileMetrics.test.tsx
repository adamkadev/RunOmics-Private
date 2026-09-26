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
    render(<AthleteKeyNumbers athlete={{ vmaKmh: 15.2 }} latestVo2max={43} />)

    expect(screen.getByText(a.vma)).toBeInTheDocument()
    expect(screen.queryByText(a.thresholdPace)).not.toBeInTheDocument()
    expect(screen.queryByText(t.profile.athlete.notSet)).not.toBeInTheDocument()
  })

  it('shows the four key numbers at once, each under a glossary term, with no category toggle', () => {
    render(
      <AthleteKeyNumbers
        athlete={{ vmaKmh: 17.5, lthrBpm: 172, thresholdPaceSecPerKm: 258 }}
        latestVo2max={50}
      />
    )

    for (const label of [a.vo2max, a.vma, a.thresholdHr, a.thresholdPace]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByText('50.0')).toBeInTheDocument()
    expect(screen.getByText('4:18')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^What is/ })).toHaveLength(4)
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  // C2, v4.4: heart and body is one compact row; fitness age reads against
  // the real age, with no check badge; BMI and potential are not here.
  it('shows heart and body as one row: resting HR, max HR, fitness age of age', () => {
    render(
      <AthleteDetails
        athlete={{
          restingHrBpm: 44,
          maxHrBpm: 201,
          age: 29,
          fitnessAgeYrs: 20.3,
          achievableFitnessAgeYrs: 18,
          bmi: 20.5,
        }}
      />
    )

    const row = screen.getByTestId('athlete-details')
    expect(within(row).getByText(a.restingHr)).toBeInTheDocument()
    expect(within(row).getByText(a.maxHr)).toBeInTheDocument()
    expect(row.textContent).toContain(`20${a.ofAge(29)}`)
    expect(screen.queryByText(a.achievableFitnessAge)).not.toBeInTheDocument()
    expect(screen.queryByText(a.bmi)).not.toBeInTheDocument()
    expect(row.querySelector('svg')).toBeNull()
  })

  // C2: one card, 2 x 2, the labels open their definitions.
  it('puts the four key numbers in one card, 2 x 2', () => {
    render(<AthleteKeyNumbers athlete={{ vmaKmh: 17.5, lthrBpm: 172, thresholdPaceSecPerKm: 258 }} latestVo2max={50} />)
    expect(screen.getAllByTestId('athlete-key-numbers')).toHaveLength(1)
    expect(screen.getAllByTestId('athlete-key-number')).toHaveLength(4)
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

  // C2: time is "9′" under an hour, "2h05" over; the window's total and its
  // Z4-Z5 share sit over one stacked bar with the target's two ticks.
  it('writes time compactly and puts the total and the hard share over a stacked bar', () => {
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={week} recentZoneTime={recent} />)
    expect(within(screen.getByTestId('zone-row-4')).getByText('9′')).toBeInTheDocument()
    expect(screen.getByTestId('zone-total').textContent).toBe(`0${t.units.hour}14`)
    expect(screen.getByTestId('zone-hard-share').textContent).toBe(z.hardShare(100))
    const stack = screen.getByTestId('zone-stack')
    expect([...stack.querySelectorAll('[data-zone]')].map((el) => el.getAttribute('data-zone'))).toEqual(['4', '5'])
    // v4.4.1: the target is a bracket under the bar, over 85-90%; nothing on it.
    const bracket = screen.getByTestId('zone-target-bracket')
    expect([bracket.style.left, bracket.style.width]).toEqual(['85%', '5%'])
    expect(screen.getByTestId('zone-target').textContent).toBe(z.target)
    expect(stack.querySelector('[data-testid="zone-target-tick"]')).toBeNull()
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
    expect(screen.getByTestId('zone-total').textContent).toBe(`2${t.units.hour}05`)
    expect(within(screen.getByTestId('zone-row-4')).getByText('0′')).toBeInTheDocument()
  })

  it('falls back to the last 4 weeks when this week is empty, and says so', () => {
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={[]} recentZoneTime={recent} />)
    expect(screen.getByRole('tab', { name: z.fourWeeks })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(z.emptyWeekFallback)).toBeInTheDocument()
  })
})
