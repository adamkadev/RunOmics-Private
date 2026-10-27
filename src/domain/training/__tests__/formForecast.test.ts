import { describe, expect, it } from 'vitest'
import { DAY_MS } from '@/lib/calendarDate'
import { forecastForm, type FormForecastInput } from '../formForecast'

const TODAY = '2026-10-27'
const RACE = '2026-11-15'
const day = (offset: number) => new Date(Date.parse(`${TODAY}T00:00:00Z`) + offset * DAY_MS).toISOString().slice(0, 10)
const range = (from: number, to: number, every = 1) => Array.from({ length: Math.floor((to - from) / every) + 1 }, (_, i) => from + i * every)

function history(fromOffset: number, load = 60): Pick<FormForecastInput, 'dailyLoad' | 'runDates'> {
  const runDates = range(fromOffset, 0, 2).map(day)
  return { dailyLoad: new Map(runDates.map((date) => [date, load])), runDates }
}

const planned = (offsets: number[], load: number) => offsets.map((offset) => ({ date: day(offset), load }))

describe('forecastForm', () => {
  it('carries form to race day through the planned sessions, the race day itself excluded', () => {
    const base = history(-120)
    const forecast = forecastForm({ ...base, planned: [...planned(range(1, 18, 2), 30), { date: RACE, load: 400 }], today: TODAY, raceDate: RACE })

    expect(forecast.kind).toBe('forecast')
    if (forecast.kind !== 'forecast') return
    expect(forecast.raceDay.tsb).toBeGreaterThan(forecast.tsbToday)
    expect(forecast.points.at(-1)).toMatchObject({ date: RACE, planned: true, tsb: forecast.raceDay.tsb })
    expect(forecast.points[0]!.date).toBe(day(-28))
    expect(forecast.points.find((p) => p.date === TODAY)!.planned).toBe(false)
  })

  it('reads a heavier plan as a lower form on race day', () => {
    const base = history(-120)
    const light = forecastForm({ ...base, planned: planned(range(1, 18), 20), today: TODAY, raceDate: RACE })
    const heavy = forecastForm({ ...base, planned: planned(range(1, 18), 120), today: TODAY, raceDate: RACE })
    expect(light.kind === 'forecast' && heavy.kind === 'forecast' && heavy.raceDay.tsb < light.raceDay.tsb).toBe(true)
  })

  it('counts today’s planned session only until a run is synced for it', () => {
    const base = history(-120)
    const withRun = forecastForm({ ...base, planned: [...planned([0], 500), ...planned(range(1, 18), 30)], today: TODAY, raceDate: RACE })
    const withoutRun = forecastForm({ ...base, dailyLoad: new Map([...base.dailyLoad].filter(([date]) => date !== TODAY)), runDates: base.runDates.filter((date) => date !== TODAY), planned: [...planned([0], 500), ...planned(range(1, 18), 30)], today: TODAY, raceDate: RACE })
    expect(withRun.kind === 'forecast' && withoutRun.kind === 'forecast' && withoutRun.raceDay.atl > withRun.raceDay.atl).toBe(true)
  })

  it('gives no number after fewer than 42 days of running since a long break', () => {
    const before = range(-300, -240, 2).map(day)
    const since = range(-20, 0, 2).map(day)
    const runDates = [...before, ...since]
    const forecast = forecastForm({ dailyLoad: new Map(runDates.map((date) => [date, 40])), runDates, planned: planned(range(1, 18), 30), today: TODAY, raceDate: RACE })
    expect(forecast).toEqual({ kind: 'shortHistory', runningDays: 20, neededDays: 42 })
  })

  it('gives no number without any run', () => {
    expect(forecastForm({ dailyLoad: new Map(), runDates: [], planned: planned(range(1, 18), 30), today: TODAY, raceDate: RACE })).toEqual({ kind: 'shortHistory', runningDays: 0, neededDays: 42 })
  })

  it('waits when the plan stops more than a week before the race, or plans no load', () => {
    const base = history(-120)
    expect(forecastForm({ ...base, planned: planned(range(1, 10), 30), today: TODAY, raceDate: RACE })).toEqual({ kind: 'planShort', plannedThrough: day(10) })
    expect(forecastForm({ ...base, planned: [], today: TODAY, raceDate: RACE })).toEqual({ kind: 'planShort', plannedThrough: null })
    expect(forecastForm({ ...base, planned: planned(range(1, 18), 0), today: TODAY, raceDate: RACE }).kind).toBe('planShort')
  })
})
