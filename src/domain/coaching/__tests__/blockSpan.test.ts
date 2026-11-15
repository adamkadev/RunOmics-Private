import { describe, expect, it } from 'vitest'
import { ownBlockStart, pastBlockSpans } from '../blockSpan'

const session = (id: string) => ({ id }) as never

function plan(id: string, name: string, startDate: string, endDate: string, weeks: [string, string[]][] = [], createdAt = startDate) {
  return {
    id,
    block: { id: `${id}:block`, name, startDate, endDate, focus: '' },
    weeks: weeks.map(([weekStart, ids]) => ({ startDate: weekStart, workouts: ids.map(session) })) as never,
    provenance: { createdAt } as never,
  }
}

describe('ownBlockStart', () => {
  it('opens a renewed block on its own first week, not on the day it carried from the last one', () => {
    const renewed = plan('b2', 'Base', '2026-11-15', '2026-12-13', [['2026-11-15', ['b1:workout:5:5']], ['2026-11-16', ['b2:workout:2:1']]])
    expect(ownBlockStart(renewed)).toBe('2026-11-16')
  })
})

describe('pastBlockSpans', () => {
  it('ends each superseded block where the next began and keeps the latest rewrite of one', () => {
    const current = plan('b3', 'Base', '2026-11-16', '2026-12-13', [['2026-11-16', ['b3:workout:1:1']]])
    const archived = [
      plan('a1', 'Rebuild', '2026-09-23', '2026-10-20', [], '2026-09-22'),
      plan('a2', 'Rebuild', '2026-09-23', '2026-10-20', [], '2026-09-30'),
      plan('b1', 'Base', '2026-10-15', '2026-11-15'),
    ]
    expect(pastBlockSpans(current, archived)).toEqual([
      { name: 'Rebuild', startDate: '2026-09-23', endDate: '2026-10-14' },
      { name: 'Base', startDate: '2026-10-15', endDate: '2026-11-15' },
    ])
  })
})
