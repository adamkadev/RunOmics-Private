import { describe, expect, it } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { ShoeRecord } from '../types'
import { NO_SHOE_CHOICES, withShoeChoices } from '../shoeChoice'

const shoe = (gearId: string, firstUseDate: string | null = null): ShoeRecord => ({
  gearId, brand: 'Brand', model: `Model ${gearId}`, maxKm: 800, retired: false, firstUseDate,
})
const run = (id: string, date: string, gearId: string | null, extra: Partial<Activity> = {}) =>
  ({ id, date, gearId, distanceKm: 5, ...extra }) as Activity

const SHOES = [shoe('road', '2026-03-01'), shoe('trail')]

describe('withShoeChoices', () => {
  it('counts a picked run toward the picked shoe, over Garmin’s, and drops its pending mark', () => {
    const [picked, untouched] = withShoeChoices(
      [run('1', '2026-10-20', 'trail', { gearPending: true }), run('2', '2026-10-21', 'trail')],
      { runs: new Map([['1', 'road']]), defaultGearId: null },
      SHOES,
    )

    expect(picked).toMatchObject({ gearId: 'road', gearSource: 'choice' })
    expect(picked!.gearPending).toBeUndefined()
    expect(untouched).toEqual(run('2', '2026-10-21', 'trail'))
  })

  it('fills only the runs Garmin gave no shoe with the default, from the pair’s first use on', () => {
    const [shod, bare, early] = withShoeChoices(
      [run('1', '2026-10-20', 'trail'), run('2', '2026-10-21T07:00:00', null), run('3', '2026-02-01', null)],
      { runs: new Map(), defaultGearId: 'road' },
      SHOES,
    )

    expect(shod!.gearId).toBe('trail')
    expect(bare).toMatchObject({ gearId: 'road', gearSource: 'default' })
    expect(early!.gearId).toBeNull()
  })

  it('ignores a pick or a default naming a shoe the list does not have', () => {
    const runs = [run('1', '2026-10-20', null), run('2', '2026-10-21', 'trail')]

    expect(withShoeChoices(runs, { runs: new Map([['2', 'gone']]), defaultGearId: 'gone' }, SHOES)).toEqual(runs)
  })

  it('leaves the runs as they are without a shoe list, as on a watch that never had one', () => {
    const runs = [run('1', '2026-10-20', null)]

    expect(withShoeChoices(runs, { runs: new Map([['1', 'road']]), defaultGearId: 'road' }, [])).toBe(runs)
    expect(withShoeChoices(runs, NO_SHOE_CHOICES, SHOES)).toBe(runs)
  })
})
