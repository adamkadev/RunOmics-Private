import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { COLLECTIONS, describePlan, planRestore, readBackup } from '../restore_firestore.mjs'

const byName = (name: string) => COLLECTIONS.find((c) => c.name === name)!

describe('restore_firestore', () => {
  it('covers notes, check-ins, route names, avoid spots, shoe picks, races and goals, from the files the nightly sync commits', () => {
    expect(COLLECTIONS.map((c) => [c.name, c.file])).toEqual([
      ['activityNotes', 'activity_notes.json'],
      ['wellness', 'wellness.json'],
      ['routeNames', 'route_names.json'],
      ['avoidSpots', 'avoid_spots.json'],
      ['runShoes', 'shoe_choices.json'],
      ['shoeSettings', 'shoe_choices.json'],
      ['raceEntries', 'race_entries.json'],
      ['goalEntries', 'goal_entries.json'],
    ])
  })

  it('restores a race, a hidden Garmin race and a season, and skips one the rules would refuse', () => {
    const races = planRestore(byName('raceEntries'), {
      a: { name: 'Harbor 10K', date: '2027-04-11', distanceKm: 10, priority: 'A', targetSeconds: 2700 },
      'garmin-uuid-1': { garminKey: 'uuid-1', removed: true },
      bad: { name: 'Harbor 10K', date: '2027-04-11', distanceKm: 10, priority: 'D' },
    }, new Map())
    expect([(races.create as [string, unknown][]).map(([id]) => id), races.invalid]).toEqual([['a', 'garmin-uuid-1'], 1])

    const goals = planRestore(byName('goalEntries'), { 2027: { targets: { '10k': 2700 } }, 2026: { removed: true }, next: { targets: {} } }, new Map())
    expect([(goals.create as [string, unknown][]).map(([id]) => id).sort(), goals.invalid]).toEqual([['2026', '2027'], 1])
  })

  it('writes what Firestore lacks or holds differently, and leaves alone what it has and the backup does not', () => {
    const notes = byName('activityNotes')
    const backup = {
      a: { note: 'Heavy legs', tags: ['tired'] },
      b: { note: 'Fine', tags: [] },
      c: { tags: ['fine'], note: 'Same' },
    }
    const current = new Map<string, unknown>([
      ['b', { note: 'Changed since', tags: [] }],
      ['c', { note: 'Same', tags: ['fine'] }],
      ['z', { note: 'Only in Firestore', tags: [] }],
    ])
    const plan = planRestore(notes, backup, current)
    expect(plan.create).toEqual([['a', backup.a]])
    expect(plan.update).toEqual([['b', backup.b]])
    expect(plan.same).toBe(1)
    expect(plan.invalid).toBe(0)
  })

  it('skips a document the rules would refuse', () => {
    expect(planRestore(byName('wellness'), { 'not-a-date': { sleep: 3 }, '2026-10-01': {} }, new Map()).invalid).toBe(2)
    expect(planRestore(byName('routeNames'), { k: { name: '' } }, new Map()).invalid).toBe(1)
    const spot = { lon: 2.35, lat: 48.85, radiusM: 80, createdAt: '2026-10-01' }
    const spots = planRestore(
      byName('avoidSpots'),
      { ok: spot, dried: { ...spot, expiresOn: '2026-10-22' }, wide: { ...spot, radiusM: 400 }, soon: { ...spot, expiresOn: 'soon' } },
      new Map(),
    )
    expect((spots.create as [string, unknown][]).map(([id]) => id)).toEqual(['ok', 'dried'])
    expect(spots.invalid).toBe(2)
    expect(planRestore(byName('runShoes'), { 1: { gearId: 'a1' }, 2: { gearId: 'not/an id' } }, new Map()).invalid).toBe(1)
    expect(planRestore(byName('shoeSettings'), { default: { gearId: 'a1' }, other: { gearId: 'a1' } }, new Map()).invalid).toBe(1)
  })

  it('reports counts only, never a document', () => {
    const plan = planRestore(byName('activityNotes'), { a: { note: 'Heavy legs', tags: [] } }, new Map())
    const line = describePlan('activityNotes', plan, false)
    expect(line).toBe('activityNotes: would write 1 (1 missing, 0 changed), 0 already as backed up.')
    expect(line).not.toContain('Heavy legs')
  })

  it('tells a missing backup from a broken one', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-'))
    expect(readBackup(dir, byName('routeNames'))).toBeNull()
    fs.writeFileSync(path.join(dir, 'route_names.json'), '{"spots":{}}')
    expect(() => readBackup(dir, byName('routeNames'))).toThrow('no "names" object')
    fs.writeFileSync(path.join(dir, 'route_names.json'), '{"names":{"k":{"name":"Quais"}}}')
    expect(readBackup(dir, byName('routeNames'))).toEqual({ k: { name: 'Quais' } })
  })
})
