import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileAthleteStats } from '@/components/profile/ProfileAthleteStats'
import { ProfileAthleteCard } from '@/components/profile/ProfileAthleteCard'
import { ProfileHrZones } from '@/components/profile/ProfileHrZones'
import { t } from '@/i18n'

describe('capability-driven athlete metrics', () => {
  it('shows configured HR zones without fabricating an LTHR value', () => {
    render(
      <ProfileHrZones
        athlete={{ hrZoneBoundsBpm: [100, 120, 140, 160, 180] }}
        weeklyZoneTime={[]}
        recentZoneTime={[]}
      />
    )

    expect(screen.getByText(/100–119/)).toBeInTheDocument()
    expect(screen.queryByText(t.profile.hrZones.lthr)).not.toBeInTheDocument()
    expect(screen.queryByText('170')).not.toBeInTheDocument()
  })

  it('still displays a real LTHR and can derive zone boundaries from it', () => {
    render(
      <ProfileHrZones
        athlete={{ lthrBpm: 172 }}
        weeklyZoneTime={[]}
        recentZoneTime={[]}
      />
    )

    expect(screen.getByText(t.profile.hrZones.lthr)).toBeInTheDocument()
    expect(screen.getByText('172')).toBeInTheDocument()
  })

  it('omits an unavailable LT pace tile instead of rendering a placeholder', () => {
    render(<ProfileAthleteStats athlete={{ vmaKmh: 15.2 }} latestVo2max={43} />)

    expect(screen.getByText(t.settings.athlete.vma)).toBeInTheDocument()
    expect(screen.queryByText(t.settings.athlete.thresholdPace)).not.toBeInTheDocument()
    expect(screen.queryByText(t.profile.athlete.notSet)).not.toBeInTheDocument()
  })

  it('reflows the profile summary without an unavailable LTHR tile', () => {
    render(
      <ProfileAthleteCard
        athlete={{}}
        latestVo2max={43}
        recentZoneTime={[]}
      />
    )

    expect(screen.getByText(t.profile.athlete.vo2maxShort)).toBeInTheDocument()
    expect(screen.queryByText(t.profile.athlete.lthrShort)).not.toBeInTheDocument()
    expect(screen.queryByText(t.profile.athlete.notSet)).not.toBeInTheDocument()
  })

  it('shows available Fitness Age, achievable age, and BMI metrics', async () => {
    render(
      <ProfileAthleteStats
        athlete={{
          age: 21,
          fitnessAgeYrs: 22.3,
          achievableFitnessAgeYrs: 18,
          bmi: 20.5,
        }}
        latestVo2max={null}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: t.settings.athlete.categories.body }))

    expect(screen.getByText(t.settings.athlete.fitnessAge)).toBeInTheDocument()
    expect(screen.getByText(t.settings.athlete.achievableFitnessAge)).toBeInTheDocument()
    expect(screen.getByText(t.settings.athlete.bmi)).toBeInTheDocument()
    expect(screen.getByText('20.5')).toBeInTheDocument()
  })
})
