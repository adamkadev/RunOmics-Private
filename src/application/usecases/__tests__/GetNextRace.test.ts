import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { UpcomingRace, UpcomingRaceYear } from '../GetGoalsData'

const { getUpcomingRaceYears } = vi.hoisted(() => ({ getUpcomingRaceYears: vi.fn() }))
vi.mock('@/infrastructure/repositories/JsonUpcomingRaceRepository', () => ({ getUpcomingRaceYears }))

const { getNextRace } = await import('../GetNextRace')

const TODAY = '2026-07-20'

const race = (date: string, name = date): UpcomingRace => ({ date, name, distance: '10K' })

function withCalendar(years: UpcomingRaceYear[]) {
  getUpcomingRaceYears.mockReturnValue(years)
}

describe('getNextRace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('null when nothing is on the calendar', async () => {
    withCalendar([])

    expect(await getNextRace()).toBeNull()
  })

  it('null when every race on the calendar has been run', async () => {
    withCalendar([{ year: 2026, races: [race('2026-05-01'), race('2026-06-01')] }])

    expect(await getNextRace()).toBeNull()
  })

  it('picks the soonest race still to come', async () => {
    withCalendar([{ year: 2026, races: [race('2026-11-15'), race('2026-09-06'), race('2026-12-31')] }])

    expect((await getNextRace())?.date).toBe('2026-09-06')
  })

  it('looks across every year on the calendar', async () => {
    withCalendar([
      { year: 2027, races: [race('2027-04-11')] },
      { year: 2026, races: [race('2026-05-01')] },
    ])

    expect((await getNextRace())?.date).toBe('2027-04-11')
  })

  it('still counts a race happening today', async () => {
    withCalendar([{ year: 2026, races: [race(TODAY), race('2026-09-06')] }])

    expect((await getNextRace())?.date).toBe(TODAY)
  })

  it('ignores the ones already behind while keeping the ones ahead', async () => {
    withCalendar([{ year: 2026, races: [race('2026-03-01'), race('2026-07-19'), race('2026-08-30')] }])

    expect((await getNextRace())?.date).toBe('2026-08-30')
  })

  it('hands back the whole race, not just its date', async () => {
    const target: UpcomingRace = {
      date: '2026-09-06',
      name: 'Semi de Luxembourg',
      distance: 'Half-Marathon',
      location: 'Luxembourg',
      targetSeconds: 5400,
    }
    withCalendar([{ year: 2026, races: [target] }])

    expect(await getNextRace()).toEqual(target)
  })
})
