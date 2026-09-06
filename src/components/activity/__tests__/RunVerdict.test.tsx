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
  it('falls back to the derived verdict when no AI insight exists', () => {
    render(<RunVerdict activity={activity} aiVerdict={null} />)

    expect(screen.getByText(t.activity.verdict.title)).toBeInTheDocument()
    expect(screen.getByText(t.activity.verdict.effortClause(t.rpeLabels[7] ?? '', 7))).toBeInTheDocument()
  })

  it('prefers the AI headline and body when one exists', () => {
    render(<RunVerdict activity={activity} aiVerdict={{ headline: 'Strong threshold', body: 'Held the range.' }} />)

    expect(screen.getByText('Strong threshold')).toBeInTheDocument()
    expect(screen.getByText('Held the range.')).toBeInTheDocument()
  })

  it('carries no coach evaluation, outcome or planned-versus-actual comparison', () => {
    render(<RunVerdict activity={activity} aiVerdict={null} />)

    expect(screen.queryByText(t.coaching.evaluation)).not.toBeInTheDocument()
    expect(screen.queryByText(t.coaching.outcomes.KEEP)).not.toBeInTheDocument()
    expect(screen.queryByText(t.coaching.planned)).not.toBeInTheDocument()
    expect(screen.queryByText(t.coaching.actual)).not.toBeInTheDocument()
  })
})
