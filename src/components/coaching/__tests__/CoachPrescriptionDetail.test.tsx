import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buildCoachingOverview } from '@/application/coaching/GetCoachingView'
import { plan } from '@/domain/coaching/__tests__/fixtures'
import type { CoachingPlan } from '@/domain/coaching/types'
import { t } from '@/i18n'
import { CoachPrescriptionDetail } from '../CoachPrescriptionDetail'

function viewOf(coachingPlan: CoachingPlan, today = '2026-09-09', garminPlanned: Parameters<typeof buildCoachingOverview>[4] = []) {
  const overview = buildCoachingOverview(coachingPlan, [], [], [], garminPlanned, today)
  return overview.workouts[0]!
}

describe('CoachPrescriptionDetail', () => {
  it('spells out the title, intent and every prescribed block', () => {
    const { container } = render(<CoachPrescriptionDetail view={viewOf(plan())} />)

    expect(screen.getByText('3 × 8 min threshold')).toBeInTheDocument()
    expect(screen.getByText('Controlled threshold repetitions.')).toBeInTheDocument()
    // warm-up, the 3 × repeat with its recovery, and the cooldown.
    expect(container.textContent).toContain(`3 × ${t.coaching.repetitions}`)
    expect(container.textContent).toContain('2 km')
    expect(container.textContent).toContain('8 min')
    expect(container.textContent).toContain('10 min')
  })

  it('carries the pace targets of each effort', () => {
    const { container } = render(<CoachPrescriptionDetail view={viewOf(plan())} />)

    expect(container.textContent).toContain('4:25–4:30/km')
  })

  it('renders repeated strides with their count and recovery', () => {
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

    const { container } = render(<CoachPrescriptionDetail view={viewOf(coachingPlan)} />)

    expect(container.textContent).toContain(`6 × 20s ${t.coaching.segments.strides}`)
    expect(container.textContent).toContain(t.coaching.segments.recovery)
  })

  it('surfaces block notes', () => {
    const coachingPlan = plan()
    coachingPlan.weeks[0]!.workouts[0]!.notes = ['Hold the last rep.']
    coachingPlan.weeks[0]!.workouts[0]!.blocks = [
      { kind: 'effort', target: { distanceMeters: 5_000 }, notes: ['Start conservatively.'] },
    ]

    render(<CoachPrescriptionDetail view={viewOf(coachingPlan)} />)

    expect(screen.getByText('Start conservatively.')).toBeInTheDocument()
    expect(screen.getByText('Hold the last rep.')).toBeInTheDocument()
  })

  it('shows the prescription state', () => {
    render(<CoachPrescriptionDetail view={viewOf(plan())} />)

    expect(screen.getByText(t.coaching.states.prescribed)).toBeInTheDocument()
  })

  it('says nothing about Garmin when the session is synced as prescribed', () => {
    const { container } = render(
      <CoachPrescriptionDetail
        view={viewOf(plan(), '2026-09-09', [
          { date: '2026-09-09', name: 'Track session', type: 'Threshold', durationSecs: 3_600 },
        ])}
      />
    )

    expect(container.textContent).not.toMatch(/Garmin/i)
  })

  it('says nothing about Garmin when nothing is scheduled there yet', () => {
    const { container } = render(<CoachPrescriptionDetail view={viewOf(plan())} />)

    expect(container.textContent).not.toMatch(/Garmin/i)
  })

  it('surfaces Garmin only when it holds a session that no longer matches', () => {
    render(
      <CoachPrescriptionDetail
        view={viewOf(plan(), '2026-09-09', [
          { date: '2026-09-09', name: 'Easy jog', type: 'Base', durationSecs: 3_600 },
        ])}
      />
    )

    expect(screen.getByText(t.coaching.garminOutOfDate)).toBeInTheDocument()
  })
})
