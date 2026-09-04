import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buildCoachingOverview } from '@/application/coaching/GetCoachingView'
import { keepDecision, plan } from '@/domain/coaching/__tests__/fixtures'
import { t } from '@/i18n'
import { CoachPlanOverview } from '../CoachPlanOverview'

describe('CoachPlanOverview', () => {
  it('shows the current coach block, rationale, prescriptions, and Garmin signal separately', () => {
    const coachingPlan = plan()
    const overview = buildCoachingOverview(
      coachingPlan,
      [keepDecision()],
      [],
      [],
      [{ date: '2026-09-09', name: 'Track session', type: 'Threshold', durationSecs: 3_600 }],
      '2026-09-09',
    )

    render(<CoachPlanOverview coaching={overview} />)

    expect(screen.getByText(coachingPlan.block.name)).toBeInTheDocument()
    expect(screen.getByText('Session completed as intended.')).toBeInTheDocument()
    expect(screen.getByText('3 × 8 min threshold')).toBeInTheDocument()
    expect(screen.getByText(t.coaching.garmin.scheduled_match)).toBeInTheDocument()
  })
})
