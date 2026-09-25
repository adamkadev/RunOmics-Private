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

  it('lists heart and body context in one list: Fitness age, potential and BMI', () => {
    render(
      <AthleteDetails
        athlete={{
          restingHrBpm: 44,
          age: 21,
          fitnessAgeYrs: 22.3,
          achievableFitnessAgeYrs: 18,
          bmi: 20.5,
        }}
      />
    )

    expect(screen.getByText(a.restingHr)).toBeInTheDocument()
    expect(screen.getByText(a.fitnessAge)).toBeInTheDocument()
    expect(screen.getByText(a.achievableFitnessAge)).toBeInTheDocument()
    expect(screen.getByText(a.bmi)).toBeInTheDocument()
    expect(screen.getByText('20.5')).toBeInTheDocument()
    expect(screen.queryByText(a.maxHr)).not.toBeInTheDocument()
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

  it('writes time as "9 min", not "0h09", and totals the week under the table', () => {
    const { container } = render(
      <ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={week} recentZoneTime={recent} />
    )
    expect(within(screen.getByTestId('zone-row-4')).getByText(`9 ${t.units.min}`)).toBeInTheDocument()
    expect(container.textContent).not.toContain('0h09')
    expect(screen.getByText(z.inZonesWeek(`14 ${t.units.min}`))).toBeInTheDocument()
  })

  it('has a single Week / 4 weeks toggle that switches the whole table', async () => {
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={week} recentZoneTime={recent} />)
    expect(screen.getAllByRole('tablist')).toHaveLength(1)

    await userEvent.click(screen.getByRole('tab', { name: z.fourWeeks }))
    expect(screen.getByText(z.inZonesRecent(`2${t.units.hour}05`))).toBeInTheDocument()
    expect(within(screen.getByTestId('zone-row-4')).getByText(`0 ${t.units.min}`)).toBeInTheDocument()
  })

  it('falls back to the last 4 weeks when this week is empty, and says so', () => {
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={[]} recentZoneTime={recent} />)
    expect(screen.getByRole('tab', { name: z.fourWeeks })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(z.emptyWeekFallback)).toBeInTheDocument()
  })
})
