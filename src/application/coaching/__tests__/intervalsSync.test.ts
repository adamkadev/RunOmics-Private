import { describe, expect, it } from 'vitest'
import {
  IntervalsNotFoundError,
  IntervalsRateLimitError,
  type IntervalsCalendarGateway,
  type IntervalsEventRecord,
} from '@/application/ports/IntervalsCalendarGateway'
import type { CoachingPlan, WorkoutPrescription } from '@/domain/coaching/types'
import {
  applyIntervalsSyncPlan,
  buildIntervalsSyncPlan,
  formatIntervalsSyncPreview,
  intervalsRetirementPlan,
  verifyIntervalsSync,
} from '../intervalsSync'
import { intervalsContentHash, type IntervalsSyncState } from '../intervalsSyncState'
import { toIntervalsWorkoutEvent, type IntervalsWorkoutEvent } from '../intervalsWorkoutEncoding'

const TODAY = '2026-11-02'
const NOW = '2026-11-02T08:00:00.000Z'

function workout(overrides: Partial<WorkoutPrescription> & { id: string; date: string }): WorkoutPrescription {
  return {
    revision: 1,
    type: 'easy',
    title: 'Easy Run',
    description: 'Easy.',
    status: 'prescribed',
    blocks: [{ kind: 'effort', target: { distanceMeters: 6_000, paceSecPerKm: { min: 330, max: 384 } } }],
    provenance: { source: 'manual', trigger: 'bootstrap', createdAt: '2026-10-28T08:00:00.000Z' },
    ...overrides,
  }
}

function plan(workouts: WorkoutPrescription[], id = 'plan-1'): CoachingPlan {
  return {
    schemaVersion: 1,
    id,
    revision: 1,
    status: 'active',
    block: { id: 'b', name: 'Block', startDate: '2026-11-02', endDate: '2026-11-29', focus: 'Build' },
    goal: { kind: 'time', targetSeconds: 2_400, description: 'Sub 40' },
    weeks: [{ id: 'w1', index: 1, startDate: '2026-11-02', endDate: '2026-11-08', focus: 'Build', workouts }],
    provenance: { source: 'manual', trigger: 'bootstrap', createdAt: '2026-10-28T08:00:00.000Z' },
  }
}

const easy = workout({ id: 'plan-1:a', date: '2026-11-03' })
const tempo = workout({ id: 'plan-1:b', date: '2026-11-05', type: 'tempo', title: 'Tempo' })

function stateWith(entries: { workout: WorkoutPrescription; eventId: string; status?: 'synced' | 'unverified'; hash?: string }[]): IntervalsSyncState {
  return {
    schemaVersion: 1,
    athleteId: '0',
    planId: 'plan-1',
    updatedAt: NOW,
    entries: entries.map(({ workout: source, eventId, status, hash }) => ({
      prescriptionId: source.id,
      date: source.date,
      contentHash: hash ?? intervalsContentHash(toIntervalsWorkoutEvent(source)),
      eventId,
      externalId: `runomics:${source.id}`,
      status: status ?? 'synced',
      lastSyncedAt: NOW,
    })),
  }
}

class FakeIntervals implements IntervalsCalendarGateway {
  readonly events = new Map<string, IntervalsEventRecord>()
  readonly calls: string[] = []
  private nextId = 100

  constructor(private readonly failures: { rateLimitOnCreate?: boolean; dropCreates?: boolean } = {}) {}

  seed(id: string, externalId: string | null, date: string): void {
    this.events.set(id, { id, externalId, date, name: 'seeded' })
  }

  async getEvent(eventId: string) {
    this.calls.push(`get ${eventId}`)
    return this.events.get(eventId) ?? null
  }

  async createEvent(event: IntervalsWorkoutEvent) {
    this.calls.push(`create ${event.external_id}`)
    if (this.failures.rateLimitOnCreate) throw new IntervalsRateLimitError()
    const saved = { id: String(this.nextId++), externalId: event.external_id, date: event.start_date_local.slice(0, 10), name: event.name }
    if (!this.failures.dropCreates) this.events.set(saved.id, saved)
    return saved
  }

  async updateEvent(eventId: string, event: IntervalsWorkoutEvent) {
    this.calls.push(`update ${eventId}`)
    if (!this.events.has(eventId)) throw new IntervalsNotFoundError()
    const saved = { id: eventId, externalId: event.external_id, date: event.start_date_local.slice(0, 10), name: event.name }
    this.events.set(eventId, saved)
    return saved
  }

  async deleteEvent(eventId: string) {
    this.calls.push(`delete ${eventId}`)
    if (!this.events.delete(eventId)) throw new IntervalsNotFoundError()
  }

  async listWorkoutEvents(oldest: string, newest: string) {
    return [...this.events.values()].filter((event) => event.date >= oldest && event.date <= newest)
  }
}

async function run(syncPlan: ReturnType<typeof buildIntervalsSyncPlan>, state: IntervalsSyncState | null, gateway: FakeIntervals) {
  const persisted: IntervalsSyncState[] = []
  const report = await applyIntervalsSyncPlan(syncPlan, state, gateway, { athleteId: '0', now: () => NOW, persist: (next) => persisted.push(next) })
  return { report, persisted }
}

describe('the sync plan', () => {
  it('creates every future session the state does not know', () => {
    const syncPlan = buildIntervalsSyncPlan(plan([easy, tempo]), [], null, { today: TODAY })

    expect(syncPlan.operations.map((operation) => [operation.action, operation.prescriptionId])).toEqual([
      ['create', 'plan-1:a'],
      ['create', 'plan-1:b'],
    ])
  })

  it('keeps a session whose payload hash is unchanged and updates one that changed', () => {
    const state = stateWith([{ workout: easy, eventId: '1' }, { workout: tempo, eventId: '2', hash: 'old' }])
    const syncPlan = buildIntervalsSyncPlan(plan([easy, tempo]), [], state, { today: TODAY })

    expect(syncPlan.operations.map((operation) => operation.action)).toEqual(['keep', 'update'])
  })

  it('pushes again a session intervals.icu did not confirm', () => {
    const state = stateWith([{ workout: easy, eventId: '1', status: 'unverified' }])

    expect(buildIntervalsSyncPlan(plan([easy]), [], state, { today: TODAY }).operations[0]!.action).toBe('update')
  })

  it('deletes a recorded session that left the plan, and only within the window', () => {
    const past = workout({ id: 'plan-1:old', date: '2026-10-30' })
    const state = stateWith([{ workout: past, eventId: '7' }, { workout: tempo, eventId: '2' }])
    const syncPlan = buildIntervalsSyncPlan(plan([easy]), [], state, { today: TODAY })

    expect(syncPlan.operations.map((operation) => [operation.action, operation.prescriptionId])).toEqual([
      ['create', 'plan-1:a'],
      ['delete', 'plan-1:b'],
    ])
  })

  it('skips a race unless asked to sync races', () => {
    const race = workout({ id: 'plan-1:race', date: '2026-11-08', type: 'race', title: '10K' })

    expect(buildIntervalsSyncPlan(plan([race]), [], null, { today: TODAY }).operations[0]!.action).toBe('skip')
    expect(buildIntervalsSyncPlan(plan([race]), [], null, { today: TODAY }, { syncRaces: true }).operations[0]!.action).toBe('create')
  })

  it('skips a session intervals.icu cannot encode, with the reason', () => {
    const open = workout({ id: 'plan-1:open', date: '2026-11-04', blocks: [{ kind: 'effort', target: {} }] })
    const operation = buildIntervalsSyncPlan(plan([open]), [], null, { today: TODAY }).operations[0]!

    expect(operation.action).toBe('skip')
    expect(operation.reason).toMatch(/duration or distance/)
  })

  it('previews UPDATE and KEEP lines and a summary', () => {
    const state = stateWith([{ workout: easy, eventId: '1' }])
    const preview = formatIntervalsSyncPreview(buildIntervalsSyncPlan(plan([easy, tempo]), [], state, { today: TODAY }))

    expect(preview).toContain('KEEP    2026-11-03  Easy Run')
    expect(preview).toContain('CREATE  2026-11-05  Tempo')
    expect(preview).toContain('Create: 1')
  })
})

describe('applying', () => {
  it('creates the events and records each one as it lands', async () => {
    const gateway = new FakeIntervals()
    const { report, persisted } = await run(buildIntervalsSyncPlan(plan([easy, tempo]), [], null, { today: TODAY }), null, gateway)

    expect(report.state.entries.map((entry) => [entry.prescriptionId, entry.eventId, entry.externalId])).toEqual([
      ['plan-1:a', '100', 'runomics:plan-1:a'],
      ['plan-1:b', '101', 'runomics:plan-1:b'],
    ])
    expect(persisted).toHaveLength(2)
    expect(report.state.athleteId).toBe('0')
  })

  it('updates in place an event it owns', async () => {
    const gateway = new FakeIntervals()
    gateway.seed('1', 'runomics:plan-1:a', '2026-11-03')
    const state = stateWith([{ workout: easy, eventId: '1', hash: 'old' }])
    const { report } = await run(buildIntervalsSyncPlan(plan([easy]), [], state, { today: TODAY }), state, gateway)

    expect(gateway.calls).toEqual(['get 1', 'update 1'])
    expect(report.state.entries[0]!.eventId).toBe('1')
  })

  it('never updates or deletes an event whose external id is not its own', async () => {
    const gateway = new FakeIntervals()
    gateway.seed('1', 'someone-else', '2026-11-03')
    gateway.seed('2', null, '2026-11-05')
    const state = stateWith([{ workout: easy, eventId: '1', hash: 'old' }, { workout: tempo, eventId: '2' }])
    const { report } = await run(buildIntervalsSyncPlan(plan([easy]), [], state, { today: TODAY }), state, gateway)

    expect(gateway.calls).toEqual(['get 1', 'get 2'])
    expect(report.results.filter((result) => result.outcome === 'failed').map((result) => result.error)).toEqual([
      expect.stringMatching(/not created by RunOmics/),
      expect.stringMatching(/not created by RunOmics/),
    ])
    expect(gateway.events.size).toBe(2)
  })

  it('creates again an event deleted by hand', async () => {
    const gateway = new FakeIntervals()
    const state = stateWith([{ workout: easy, eventId: '1', hash: 'old' }])
    const { report } = await run(buildIntervalsSyncPlan(plan([easy]), [], state, { today: TODAY }), state, gateway)

    expect(gateway.calls).toEqual(['get 1', 'create runomics:plan-1:a'])
    expect(report.state.entries[0]!.eventId).toBe('100')
  })

  it('forgets a deleted event even when it was already gone', async () => {
    const gateway = new FakeIntervals()
    const state = stateWith([{ workout: tempo, eventId: '2' }])
    const { report } = await run(buildIntervalsSyncPlan(plan([]), [], state, { today: TODAY }), state, gateway)

    expect(report.results[0]!.outcome).toBe('applied')
    expect(report.state.entries).toEqual([])
  })

  it('stops at a rate limit and keeps what it recorded', async () => {
    const gateway = new FakeIntervals({ rateLimitOnCreate: true })
    const { report } = await run(buildIntervalsSyncPlan(plan([easy, tempo]), [], null, { today: TODAY }), null, gateway)

    expect(report.rateLimited).toBe(true)
    expect(report.results).toHaveLength(1)
  })

  it('refuses a state written for another intervals.icu athlete', async () => {
    const state = { ...stateWith([]), athleteId: 'i42' }

    await expect(run(buildIntervalsSyncPlan(plan([easy]), [], state, { today: TODAY }), state, new FakeIntervals())).rejects.toThrow(/athlete i42/)
  })
})

describe('verifying', () => {
  it('confirms an event found on its date with its external id', async () => {
    const gateway = new FakeIntervals()
    const { report } = await run(buildIntervalsSyncPlan(plan([easy]), [], null, { today: TODAY }), null, gateway)
    const verified = await verifyIntervalsSync(report, gateway)

    expect(verified.results[0]!.verified).toBe(true)
    expect(verified.state.entries[0]!.status).toBe('synced')
  })

  it('marks unverified an event intervals.icu does not list', async () => {
    const gateway = new FakeIntervals({ dropCreates: true })
    const { report } = await run(buildIntervalsSyncPlan(plan([easy]), [], null, { today: TODAY }), null, gateway)
    const verified = await verifyIntervalsSync(report, gateway)

    expect(verified.results[0]!.outcome).toBe('failed')
    expect(verified.state.entries[0]!.status).toBe('unverified')
  })

  it('reports a duplicate RunOmics event instead of touching it', async () => {
    const gateway = new FakeIntervals()
    gateway.seed('9', 'runomics:plan-1:a', '2026-11-03')
    const { report } = await run(buildIntervalsSyncPlan(plan([easy]), [], null, { today: TODAY }), null, gateway)
    const verified = await verifyIntervalsSync(report, gateway)

    expect(verified.results[0]!.error).toMatch(/Duplicate RunOmics event\(s\) 9/)
    expect(gateway.events.has('9')).toBe(true)
  })
})

describe('retiring the intervals.icu route', () => {
  it('deletes only the recorded events from today on', async () => {
    const gateway = new FakeIntervals()
    const past = workout({ id: 'plan-1:old', date: '2026-10-30' })
    gateway.seed('7', 'runomics:plan-1:old', past.date)
    gateway.seed('1', 'runomics:plan-1:a', easy.date)
    gateway.seed('55', 'my-own', easy.date)
    const state = stateWith([{ workout: past, eventId: '7' }, { workout: easy, eventId: '1' }])
    const { report } = await run(intervalsRetirementPlan(state, TODAY), state, gateway)

    expect([...gateway.events.keys()].sort()).toEqual(['55', '7'])
    expect(report.state.entries.map((entry) => entry.prescriptionId)).toEqual(['plan-1:old'])
  })
})
