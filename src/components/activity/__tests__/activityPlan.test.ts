import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'
import { activityPlanRow } from '../activityPlan'

const RUN = { type: 'Threshold' as const, distanceKm: 6.11, durationSeconds: 1_524 }

describe('activityPlanRow', () => {
  it('reads planned against ran for a run that matched its plan', () => {
    expect(activityPlanRow(RUN, { title: 'Threshold', type: 'Threshold', distanceM: 6_000, durationSeconds: 1_500 })).toEqual({
      chipLabel: `✓ ${t.sessionCard.onPlan}`,
      title: `${t.sessionCard.plannedLine('6')} · 25 min Z4`,
      detail: t.sessionCard.ranLine('6.11', '25:24'),
    })
  })

  it('says so when the run was a different session from the plan', () => {
    const row = activityPlanRow({ ...RUN, type: 'Base' }, { title: 'Threshold', type: 'Threshold', distanceM: 6_000, durationSeconds: null })

    expect(row.chipLabel).toBe(`✓ ${t.sessionState.done}`)
    expect(row.detail).toContain(t.plan.plannedVsRecorded(t.activityTypes.Threshold, t.activityTypes.Base))
  })

  it('falls back to the plan title when it has no distance or duration', () => {
    expect(activityPlanRow(RUN, { title: 'Track session', distanceM: null, durationSeconds: null }).title).toBe('Track session')
  })
})
