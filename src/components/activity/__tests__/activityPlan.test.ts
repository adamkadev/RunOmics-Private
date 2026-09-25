import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'
import { activityPlanRow } from '../activityPlan'

const RUN = { type: 'Threshold' as const, distanceKm: 6.11, durationSeconds: 1_524 }

describe('activityPlanRow', () => {
  it('reads planned against ran for a run that matched its plan', () => {
    expect(activityPlanRow(RUN, { title: 'Threshold', type: 'Threshold', distanceM: 6_000, durationSeconds: 1_500 })).toEqual({
      chipLabel: `✓ ${t.sessionCard.onPlan}`,
      title: `${t.sessionCard.plannedLine('6')} · 25 min Z4`,
      detail: `${t.sessionCard.ranLine('6.11', '25:24')} · +0.11 ${t.units.km}`,
    })
  })

  it('says so when the run was a different session from the plan', () => {
    const row = activityPlanRow({ ...RUN, type: 'Base' }, { title: 'Threshold', type: 'Threshold', distanceM: 6_000, durationSeconds: null })

    expect(row.chipLabel).toBe(`✓ ${t.sessionState.done}`)
    expect(row.detail).toContain(t.plan.plannedVsRecorded(t.activityTypes.Threshold, t.activityTypes.Base))
  })

  // G04: the planned value comes from the plan, never from the run.
  it('takes planned km from the plan when the run was longer', () => {
    const row = activityPlanRow({ ...RUN, distanceKm: 8.4 }, { title: 'Threshold', type: 'Threshold', distanceM: 6_110, durationSeconds: 1_500 })

    expect(row.title).toContain(t.sessionCard.plannedLine('6'))
    expect(row.detail).toContain(t.sessionCard.ranLine('8.40', '25:24'))
    expect(row.detail).toContain(`+2.29 ${t.units.km}`)
  })

  it('states no difference when the run matched the plan', () => {
    expect(activityPlanRow(RUN, { title: 'Threshold', type: 'Threshold', distanceM: 6_110, durationSeconds: 1_500 }).detail).toBe(
      t.sessionCard.ranLine('6.11', '25:24'),
    )
  })

  it('falls back to the plan title when it has no distance or duration', () => {
    expect(activityPlanRow(RUN, { title: 'Track session', distanceM: null, durationSeconds: null }).title).toBe('Track session')
  })
})
