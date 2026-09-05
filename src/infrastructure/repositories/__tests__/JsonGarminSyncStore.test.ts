import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { emptyGarminSyncState, type GarminSyncState } from '@/application/coaching/garminSyncState'
import { JsonGarminSyncStore } from '../JsonGarminSyncStore'

const roots: string[] = []

function workspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runomics-garmin-sync-'))
  roots.push(root)
  return root
}

function state(): GarminSyncState {
  return {
    schemaVersion: 1,
    planId: 'plan-1',
    updatedAt: '2026-09-06T12:00:00.000Z',
    entries: [
      {
        prescriptionId: 'plan-1:workout:1:2',
        date: '2026-09-08',
        contentHash: 'abc123',
        garminWorkoutId: '1688039319',
        garminWorkoutScheduleId: '1767663613',
        status: 'scheduled',
        lastSyncedAt: '2026-09-06T12:00:00.000Z',
      },
    ],
  }
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

describe('sync state location', () => {
  it('writes under the configured data workspace, never into this repository', () => {
    const root = workspace()

    const store = new JsonGarminSyncStore(root)

    expect(store.location).toBe(path.join(root, 'coaching', 'garmin-sync.json'))
    expect(path.relative(root, store.location).startsWith('..')).toBe(false)
  })

  it('keeps Garmin ids only in that workspace', () => {
    const root = workspace()
    const store = new JsonGarminSyncStore(root)

    store.write(state())

    const written = fs.readFileSync(store.location, 'utf-8')
    expect(written).toContain('1688039319')
    expect(fs.existsSync(path.join(process.cwd(), 'data', 'coaching', 'garmin-sync.json'))).toBe(false)
  })
})

describe('reading and writing', () => {
  it('returns an empty state before anything has been synced', () => {
    const store = new JsonGarminSyncStore(workspace())

    expect(store.read()).toEqual(emptyGarminSyncState())
  })

  it('round-trips the mapping', () => {
    const store = new JsonGarminSyncStore(workspace())

    store.write(state())

    expect(store.read()).toEqual(state())
  })

  it('creates the coaching directory on first write', () => {
    const root = workspace()
    const store = new JsonGarminSyncStore(root)

    store.write(emptyGarminSyncState())

    expect(fs.existsSync(path.join(root, 'coaching'))).toBe(true)
  })

  it('rejects a file written by an unknown schema version rather than guessing', () => {
    const root = workspace()
    const store = new JsonGarminSyncStore(root)
    fs.mkdirSync(path.dirname(store.location), { recursive: true })
    fs.writeFileSync(store.location, JSON.stringify({ schemaVersion: 99, entries: [] }))

    expect(() => store.read()).toThrow(/Unsupported Garmin sync schema version/)
  })

  it('rejects an entry with no Garmin workout id', () => {
    const root = workspace()
    const store = new JsonGarminSyncStore(root)
    fs.mkdirSync(path.dirname(store.location), { recursive: true })
    fs.writeFileSync(
      store.location,
      JSON.stringify({ schemaVersion: 1, entries: [{ prescriptionId: 'a', date: '2026-09-08', contentHash: 'x', status: 'scheduled' }] }),
    )

    expect(() => store.read()).toThrow(/missing garminWorkoutId/)
  })
})
