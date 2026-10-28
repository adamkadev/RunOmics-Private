import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import { t } from '@/i18n'
import { RunVerdict } from '../RunVerdict'

const activity = {
  id: 'activity-1',
  type: 'Threshold',
  distanceKm: 10,
  durationSeconds: 2_700,
  paceSecPerKm: 270,
  avgHeartRate: 168,
  rpe: 7,
  aerTrainingEffect: 3.5,
} as Activity

describe('RunVerdict', () => {
  it('falls back to the derived headline when no AI insight exists', () => {
    render(<RunVerdict activity={activity} tone="positive" aiVerdict={null} />)

    expect(screen.getByTestId('run-verdict').textContent).toContain(t.activityTypes.Threshold)
    // No AI verdict, no invented body.
    expect(screen.queryByTestId('run-verdict-body')).toBeNull()
  })

  it('names the session the run was planned as, not the type guessed for it', () => {
    render(<RunVerdict activity={{ ...activity, type: 'VO2Max', rpe: 3 }} type="Base" tone="positive" aiVerdict={null} />)

    expect(screen.getByTestId('run-verdict').textContent).toContain(t.activity.verdict.headline.positive(t.activityTypes.Base))
    expect(screen.getByTestId('run-verdict').textContent).not.toContain(t.activityTypes.VO2Max)
  })

  it('shows the AI headline and body', () => {
    render(<RunVerdict activity={activity} tone="positive" aiVerdict={{ headline: 'Strong threshold', body: 'Held the range.' }} />)

    expect(screen.getByText('Strong threshold')).toBeInTheDocument()
    expect(screen.getByText('Held the range.')).toBeInTheDocument()
  })

  it('shows the tone it is given, the one the written verdict was judged with, not one of its own', () => {
    render(<RunVerdict activity={{ ...activity, rpe: 7 }} tone="caution" aiVerdict={null} />)

    expect(screen.getByTestId('run-verdict').textContent).toContain(t.activity.verdict.eyebrow.caution)
  })

  it('carries no coach evaluation, outcome or planned-versus-actual comparison', () => {
    render(<RunVerdict activity={activity} tone="positive" aiVerdict={null} />)

    expect(screen.queryByText(t.coaching.outcomes.KEEP)).not.toBeInTheDocument()
    expect(screen.queryByText(t.coaching.planned)).not.toBeInTheDocument()
    expect(screen.queryByText(t.coaching.actual)).not.toBeInTheDocument()
  })
})
