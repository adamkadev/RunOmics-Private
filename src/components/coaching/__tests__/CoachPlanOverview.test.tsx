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

  it('shows repeated strides with their prescribed count and recovery', () => {
    const coachingPlan = plan()
    coachingPlan.weeks[0]!.workouts[0]!.blocks = [
      { kind: 'effort', target: { distanceMeters: 5_000 } },
      {
        kind: 'repeat',
        repetitions: 6,
        steps: [
          { kind: 'strides', target: { durationSeconds: 20 } },
          { kind: 'recovery', target: { durationSeconds: 60 } },
        ],
      },
    ]
    const overview = buildCoachingOverview(coachingPlan, [], [], [], [], '2026-09-09')

    render(<CoachPlanOverview coaching={overview} />)

    expect(screen.getByText(new RegExp(`6 × 20s ${t.coaching.segments.strides}`))).toBeInTheDocument()
  })
})
