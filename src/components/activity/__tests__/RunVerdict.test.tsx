import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import { COACHING_SCHEMA_VERSION, type WorkoutEvaluation } from '@/domain/coaching/types'
import { keepDecision, provenance, workout } from '@/domain/coaching/__tests__/fixtures'
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

const evaluation: WorkoutEvaluation = {
  schemaVersion: COACHING_SCHEMA_VERSION,
  id: 'evaluation-1',
  activityId: activity.id,
  activityDate: '2026-09-09',
  prescriptionId: 'workout-threshold',
  planId: 'plan-1',
  planRevision: 1,
  matchStatus: 'matched',
  comparison: {
    plannedDistanceMeters: 10_000,
    actualDistanceMeters: 10_000,
    plannedPaceSecPerKm: { min: 265, max: 270 },
    actualPaceSecPerKm: 270,
  },
  decisionId: 'decision-keep',
  summary: 'Threshold target met with controlled effort.',
  createdAt: '2026-09-09T08:00:00.000Z',
  contextHash: 'context-hash',
  provenance: provenance('post_activity'),
}

describe('RunVerdict coaching integration', () => {
  it('shows the persisted evaluation, lifecycle outcome, and reliable aggregate comparison', () => {
    render(
      <RunVerdict
        activity={activity}
        aiVerdict={null}
        coaching={{ evaluation, decision: keepDecision(), prescription: workout() }}
      />,
    )

    expect(screen.getByText(t.coaching.evaluation)).toBeInTheDocument()
    expect(screen.getByText('Threshold target met with controlled effort.')).toBeInTheDocument()
    expect(screen.getByText(t.coaching.outcomes.KEEP)).toBeInTheDocument()
    expect(screen.getByText('10.0 / 10.0 km')).toBeInTheDocument()
  })

  it('omits aggregate facts when matching is only date-based', () => {
    render(
      <RunVerdict
        activity={activity}
        aiVerdict={null}
        coaching={{ evaluation: { ...evaluation, matchStatus: 'date_only' }, decision: keepDecision(), prescription: workout() }}
      />,
    )

    expect(screen.queryByText('10.0 / 10.0 km')).not.toBeInTheDocument()
  })
})
