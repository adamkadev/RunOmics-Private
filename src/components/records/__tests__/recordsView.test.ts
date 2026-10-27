import { describe, expect, it } from 'vitest'
import {
  EFFORT_LIST_MAX,
  allEffortsLabel,
  effortGap,
  formatGap,
  groupMilestonesByMonth,
  parseRecordTab,
  recordTabs,
  predictionGap,
  routeLatest,
  trailBars,
} from '../recordsView'
import type { RecurringRoute } from '@/application/usecases/GetRecurringRoutes'
import type { Milestone } from '@/application/usecases/GetMilestones'
import { t } from '@/i18n'

describe('recordTabs', () => {
  it('offers the comeback tab only while a return is under way', () => {
    expect(recordTabs(true)).toEqual(['best', 'milestones', 'return', 'routes'])
    expect(recordTabs(false)).toEqual(['best', 'milestones', 'routes'])
    expect(parseRecordTab('return', recordTabs(false))).toBe('best')
    expect(parseRecordTab('return', recordTabs(true))).toBe('return')
  })
})

describe('parseRecordTab', () => {
  it('reads the tab from ?tab=, Best times by default', () => {
    expect(parseRecordTab('milestones')).toBe('milestones')
    expect(parseRecordTab('routes')).toBe('routes')
    expect(parseRecordTab(null)).toBe('best')
    expect(parseRecordTab('prs')).toBe('best')
  })
})

describe('formatGap', () => {
  it('writes seconds under a minute and the clock from there', () => {
    expect(formatGap(5)).toBe(t.records.gapSeconds(5))
    expect(formatGap(-20)).toBe(t.records.gapSeconds(20))
    expect(formatGap(103)).toBe('1:43')
  })
})

describe('predictionGap', () => {
  it('says how much faster the prediction is', () => {
    expect(predictionGap(211, 206)).toEqual({ kind: 'faster', text: t.records.faster(t.records.gapSeconds(5)) })
    expect(predictionGap(2650, 2547)).toEqual({ kind: 'faster', text: t.records.faster('1:43') })
  })

  it('calls a prediction equal to the best to the second "at potential"', () => {
    expect(predictionGap(345, 345.4)).toEqual({ kind: 'at', text: t.records.atPotential })
  })

  it('says how much slower when the prediction trails the best', () => {
    expect(predictionGap(1242, 1250)).toEqual({ kind: 'slower', text: t.records.slower(t.records.gapSeconds(8)) })
  })
})

describe('effortGap', () => {
  it('gives every effort but the best its gap to it', () => {
    expect(effortGap(211, 211)).toBeNull()
    expect(effortGap(214, 211)).toBe(`+${t.records.gapSeconds(3)}`)
  })
})

describe('allEffortsLabel', () => {
  it('says "All" only when the list holds every effort', () => {
    expect(allEffortsLabel('1K', 12)).toBe(t.records.allEfforts('1K'))
    expect(allEffortsLabel('1K', EFFORT_LIST_MAX)).toBe(t.records.topEfforts(EFFORT_LIST_MAX, '1K'))
  })
})

describe('groupMilestonesByMonth', () => {
  it('groups by calendar month, keeping the order they arrive in', () => {
    const ms = [
      { type: 'distance-tier', date: '2026-10-08', label: 'a' },
      { type: 'activity-count', date: '2026-06-18', label: 'b' },
      { type: 'record', date: '2026-06-16', label: 'c' },
      { type: 'record', date: '2025-06-02', label: 'd' },
    ] as Milestone[]
    expect(groupMilestonesByMonth(ms).map((g) => [g.key, g.items.map((m) => m.label)])).toEqual([
      ['2026-10', ['a']],
      ['2026-06', ['b', 'c']],
      ['2025-06', ['d']],
    ])
  })
})

const route = (paces: number[], bestIndex: number): RecurringRoute => ({
  id: 'r',
  start: null,
  far: null,
  shape: 'loop',
  runCount: paces.length,
  distanceKm: 7.3,
  outline: '',
  runs: paces.map((paceSecPerKm, i) => ({ activityId: `a${i}`, date: `2026-01-${String(i + 1).padStart(2, '0')}`, paceSecPerKm })),
  bestPaceSecPerKm: paces[bestIndex]!,
  bestActivityId: `a${bestIndex}`,
  bestDate: `2026-01-${String(bestIndex + 1).padStart(2, '0')}`,
})

describe('trailBars', () => {
  it('stands the fastest run tallest and the slowest shortest', () => {
    const bars = trailBars(route([330, 307, 319], 1))
    expect(bars.map((b) => b.heightPct)).toEqual([30, 100, 63])
    expect(bars.map((b) => b.tone)).toEqual(['other', 'best', 'latest'])
  })

  it('gives the latest bar the accent when it is the best', () => {
    expect(trailBars(route([330, 320, 316], 2)).map((b) => b.tone)).toEqual(['other', 'other', 'best'])
  })
})

describe('routeLatest', () => {
  it('measures the latest run against the best', () => {
    expect(routeLatest(route([307, 319], 0))).toMatchObject({ kind: 'behind', gapSeconds: 12 })
  })

  it('calls it a new best when the latest run is the best', () => {
    expect(routeLatest(route([330, 316], 1))).toEqual({ kind: 'new-best', date: '2026-01-02' })
  })
})
