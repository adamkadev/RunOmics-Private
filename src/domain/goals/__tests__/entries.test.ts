import { describe, expect, it } from 'vitest'
import type { GoalYear, UpcomingRace } from '../types'
import {
  garminEntryId,
  mergeGoals,
  mergeRaces,
  parseRaceTime,
  raceDistanceKm,
  raceDistanceLabel,
  raceKey,
  readGoalEntry,
  readRaceEntry,
  targetsOf,
  validateGoalDraft,
  validateRaceDraft,
  type GoalDraft,
  type RaceDraft,
} from '../entries'

const garminRace: UpcomingRace = {
  garminEventUuid: 'uuid-1',
  date: '2026-11-29',
  name: 'Harbor Lights 10K',
  distance: '10K',
  location: 'Fictional Bay',
  isPrimaryEvent: true,
  targetSeconds: 2_700,
}

const tuneUp: UpcomingRace = { garminEventId: 42, date: '2026-11-08', name: 'Ridge Cross', distance: '8 km', isTrainingEvent: true }

describe('mergeRaces', () => {
  it('reads Garmin’s primary event as A and a training event as C, with no entries', () => {
    expect(mergeRaces([garminRace, tuneUp], []).map((race) => [race.name, race.priority])).toEqual([
      ['Ridge Cross', 'C'],
      ['Harbor Lights 10K', 'A'],
    ])
  })

  it('adds an app race with its own id, labelled like a synced one, by date', () => {
    const merged = mergeRaces([garminRace], [
      { id: 'abc', name: 'Autumn Trail Half', date: '2026-11-15', distanceKm: 21.0975, priority: 'B', targetSeconds: 5_700 },
    ])
    expect(merged.map((race) => race.name)).toEqual(['Autumn Trail Half', 'Harbor Lights 10K'])
    expect(merged[0]).toEqual({
      entryId: 'abc',
      name: 'Autumn Trail Half',
      date: '2026-11-15',
      distance: 'Half-Marathon',
      targetSeconds: 5_700,
      priority: 'B',
      isPrimaryEvent: false,
      isTrainingEvent: false,
    })
  })

  it('applies an edit to a Garmin race and keeps its Garmin identity', () => {
    const [edited] = mergeRaces([garminRace], [
      { id: garminEntryId('uuid-1'), garminKey: 'uuid-1', name: 'Harbor Lights 10K', date: '2026-11-29', distanceKm: 10, priority: 'B' },
    ])
    expect(edited).toMatchObject({ garminEventUuid: 'uuid-1', priority: 'B', isPrimaryEvent: false, targetSeconds: null, justFinish: true })
    expect(edited).not.toHaveProperty('location')
    expect(raceKey(edited!)).toBe('uuid-1')
  })

  it('hides a Garmin race the athlete removed', () => {
    expect(mergeRaces([garminRace, tuneUp], [{ id: 'garmin-42', garminKey: '42', removed: true }]).map((race) => race.name)).toEqual(['Harbor Lights 10K'])
  })
})

describe('mergeGoals', () => {
  const written: GoalYear[] = [
    { year: 2026, annualDistanceKm: 1_200, targets: [{ distance: '10K', targetSeconds: 2_700 }, { distance: 'Marathon', targetSeconds: null }] },
    { year: 2025, annualDistanceKm: 1_000, targets: [] },
  ]

  it('replaces a written year whole, adds a new one and hides a removed one', () => {
    const merged = mergeGoals(written, [
      { year: 2026, annualDistanceKm: 1_500, targets: { half: 5_700 } },
      { year: 2027, targets: { marathon: null } },
      { year: 2025, removed: true },
    ])
    expect(merged).toEqual([
      { year: 2026, annualDistanceKm: 1_500, targets: [{ distance: 'Half-Marathon', targetSeconds: 5_700 }] },
      { year: 2027, annualDistanceKm: 0, targets: [{ distance: 'Marathon', targetSeconds: null }] },
    ])
  })

  it('reads a written year back into the editor’s targets', () => {
    expect(targetsOf(written[0]!)).toEqual({ '10k': 2_700, marathon: null })
  })
})

describe('race distances', () => {
  it('labels the standard distances as the sync does and the rest in km', () => {
    expect([5, 10, 21.1, 42.195, 15, 8.5].map(raceDistanceLabel)).toEqual(['5K', '10K', 'Half-Marathon', 'Marathon', '15 km', '8.5 km'])
  })

  it('reads a race’s distance back in km', () => {
    expect([raceDistanceKm(garminRace), raceDistanceKm(tuneUp), raceDistanceKm({ ...tuneUp, distance: '' })]).toEqual([10, 8, null])
  })
})

describe('reading stored entries', () => {
  it('skips a document the rules would refuse', () => {
    expect(readRaceEntry('a', { name: 'x', date: '2027-01-01', distanceKm: 10, priority: 'D' })).toBeNull()
    expect(readRaceEntry('a', { removed: true })).toBeNull()
    expect(readGoalEntry('next', { targets: {} })).toBeNull()
    expect(readGoalEntry('2027', { annualDistanceKm: -5, targets: {} })).toBeNull()
  })

  it('keeps a well-formed race, a removal and a season', () => {
    expect(readRaceEntry('g', { garminKey: 'uuid-1', removed: true })).toEqual({ id: 'g', garminKey: 'uuid-1', removed: true })
    expect(readGoalEntry('2027', { targets: { '5k': 1_170, marathon: null, '15k': 3_600 } })).toEqual({ year: 2027, targets: { '5k': 1_170, marathon: null } })
  })
})

describe('validateRaceDraft', () => {
  const draft: RaceDraft = { name: ' Harbor 10K ', date: '2026-12-06', distanceKm: '10', justFinish: false, time: '44:30', priority: 'A', location: '' }
  const today = '2026-10-27'

  it('turns a valid draft into the fields Firestore stores', () => {
    expect(validateRaceDraft(draft, { today })).toEqual({
      ok: true,
      value: { name: 'Harbor 10K', date: '2026-12-06', distanceKm: 10, priority: 'A', targetSeconds: 2_670 },
    })
  })

  it('stores no time for a just-finish race and takes a decimal comma', () => {
    expect(validateRaceDraft({ ...draft, distanceKm: '21,1', justFinish: true, time: 'x' }, { today })).toMatchObject({
      ok: true,
      value: { distanceKm: 21.1 },
    })
  })

  it('refuses a new race in the past but keeps an unchanged date on an edit', () => {
    expect(validateRaceDraft({ ...draft, date: '2026-10-26' }, { today })).toEqual({ ok: false, errors: { date: 'datePast' } })
    expect(validateRaceDraft({ ...draft, date: '2026-10-26' }, { today, savedDate: '2026-10-26' }).ok).toBe(true)
    expect(validateRaceDraft({ ...draft, date: today }, { today }).ok).toBe(true)
  })

  it('names each field that is wrong', () => {
    expect(validateRaceDraft({ ...draft, name: '  ', date: '2026-02-30', distanceKm: '0.4', time: '45' }, { today })).toEqual({
      ok: false,
      errors: { name: 'nameRequired', date: 'dateInvalid', distance: 'distanceRange', time: 'timeInvalid' },
    })
    expect(validateRaceDraft({ ...draft, date: '2032-01-01' }, { today })).toEqual({ ok: false, errors: { date: 'dateTooFar' } })
  })

  it('refuses a time no one could run, too fast or too slow', () => {
    expect(validateRaceDraft({ ...draft, time: '20:00' }, { today })).toEqual({ ok: false, errors: { time: 'paceRange' } })
    expect(validateRaceDraft({ ...draft, time: '3:30:00' }, { today })).toEqual({ ok: false, errors: { time: 'paceRange' } })
  })
})

describe('validateGoalDraft', () => {
  const none = { kind: 'none' } as const
  const draft: GoalDraft = { annualKm: '1500', targets: { '5k': none, '10k': { kind: 'time', time: '44:30' }, half: none, marathon: { kind: 'finish' } } }

  it('keeps a time, a finish and the year’s distance', () => {
    expect(validateGoalDraft(draft)).toEqual({ ok: true, value: { annualDistanceKm: 1_500, targets: { '10k': 2_670, marathon: null } } })
    expect(validateGoalDraft({ ...draft, annualKm: '' })).toEqual({ ok: true, value: { targets: { '10k': 2_670, marathon: null } } })
  })

  it('refuses an impossible year or time', () => {
    expect(validateGoalDraft({ ...draft, annualKm: '50000', targets: { ...draft.targets, '5k': { kind: 'time', time: '9:00' } } })).toEqual({
      ok: false,
      errors: { annualKm: 'distanceRange', '5k': 'paceRange' },
    })
  })
})

describe('parseRaceTime', () => {
  it('reads h:mm:ss and m:ss, and nothing looser', () => {
    expect(['1:39:30', '44:30', '125:00', '44:75', '1:5:00', '44', ''].map(parseRaceTime)).toEqual([5_970, 2_670, 7_500, null, null, null, null])
  })
})
