import { describe, it, expect } from 'vitest'
import { activityCells, buildAreaIndex } from '../coverage'
import { exploreGains } from '../gains'
import { line, testArea, track } from './areaFixture'

const index = buildAreaIndex(testArea())
const run = (id: string, date: string, coords: Float64Array) => ({ id, date, ...activityCells(index, coords) })
const bravo = track(line(610, 75, 1190, 75, 50))
const alpha = track(line(10, 75, 590, 75, 50))

describe('exploreGains', () => {
  it('credits each cell to the first run through it, with each quartier before and after', () => {
    const { byRun } = exploreGains(index, [run('a', '2026-08-09', bravo), run('b', '2026-08-10', bravo), run('c', '2026-10-21', alpha)])

    expect(byRun.get('a')).toEqual({ newCells: 4, units: [{ id: 'test-bravo', name: 'Bravo', cells: 4, before: 0, after: 100 }] })
    expect(byRun.has('b')).toBe(false)
    expect(byRun.get('c')).toEqual({ newCells: 3, units: [{ id: 'test-alpha', name: 'Alpha', cells: 3, before: 0, after: 21 }] })
  })

  it('lists the quartiers complete after every run, with the day each passed 90 %', () => {
    expect(exploreGains(index, [run('a', '2026-08-09', bravo), run('c', '2026-10-21', alpha)]).complete).toEqual([
      { id: 'test-bravo', name: 'Bravo', pct: 100, since: '2026-08-09' },
    ])
    expect(exploreGains(index, []).complete).toEqual([])
  })
})
