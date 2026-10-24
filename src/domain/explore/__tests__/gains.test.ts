import { describe, it, expect } from 'vitest'
import { buildAreaIndex } from '../coverage'
import { exploreGains } from '../gains'
import { line, testArea, track } from './areaFixture'

const index = buildAreaIndex(testArea())
const bravo = track(line(610, 75, 1190, 75, 50))
const alpha = track(line(10, 75, 590, 75, 50))

describe('exploreGains', () => {
  it('credits each cell to the first run through it, with each quartier before and after', () => {
    const { byRun } = exploreGains(index, [
      { id: 'a', coords: bravo },
      { id: 'b', coords: bravo },
      { id: 'c', coords: alpha },
    ])

    expect(byRun.get('a')).toEqual({ newCells: 4, units: [{ id: 'test-bravo', name: 'Bravo', cells: 4, before: 0, after: 100 }] })
    expect(byRun.has('b')).toBe(false)
    expect(byRun.get('c')).toEqual({ newCells: 3, units: [{ id: 'test-alpha', name: 'Alpha', cells: 3, before: 0, after: 21 }] })
  })

  it('lists the quartiers complete after every run', () => {
    expect(exploreGains(index, [{ id: 'a', coords: bravo }, { id: 'c', coords: alpha }]).complete).toEqual([{ id: 'test-bravo', name: 'Bravo', pct: 100 }])
    expect(exploreGains(index, []).complete).toEqual([])
  })
})
