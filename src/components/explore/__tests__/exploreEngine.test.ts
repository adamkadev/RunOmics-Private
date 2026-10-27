import { describe, it, expect, vi } from 'vitest'
import type { ExploreAreaRef } from '@/domain/explore/types'
import { testArea } from '@/domain/explore/__tests__/areaFixture'
import { aggregateCoverage, activityCells, buildAreaIndex } from '@/domain/explore/coverage'
import { at } from '@/domain/explore/__tests__/areaFixture'
import { createExploreEngine } from '../exploreEngine'
import { NO_CACHE } from '../idb'
import { flattenTracks } from '../trackBuffers'
import { createWorkerState, handleMessage } from '../workerCore'
import type { ExploreRequest, ExploreResponse } from '../workerProtocol'
import { FakeWorker, flush } from './fakeWorker'

const AREA = testArea()
const REF: ExploreAreaRef = {
  id: AREA.runomics.id,
  name: AREA.runomics.name,
  version: AREA.runomics.version,
  bbox: AREA.runomics.bbox,
}
const KEY = `${REF.id}:${REF.version}`

/** A worker that answers every request the way the real one would, in shape. */
function happy(message: ExploreRequest): ExploreResponse {
  switch (message.type) {
    case 'loadArea':
      return { id: message.id, result: AREA }
    case 'addTracks':
      return { id: message.id, result: { added: message.ids } }
    default:
      return { id: message.id, result: null }
  }
}

function setup(respond: ConstructorParameters<typeof FakeWorker>[0] = happy) {
  const workers: FakeWorker[] = []
  const createWorker = vi.fn(() => {
    const worker = new FakeWorker(respond)
    workers.push(worker)
    return worker as unknown as Worker
  })
  return { engine: createExploreEngine(createWorker), workers, createWorker }
}

const tracks = (ids: string[]) =>
  flattenTracks(
    ids.map((_, k): [number, number][] => [
      [-150 + k * 0.001, 45],
      [-150 + k * 0.001, 45.001],
    ]),
    ids.map((_, k) => k),
    ids.map((id) => ({ id, date: '2026-10-01' })),
  )

describe('createExploreEngine', () => {
  it('starts no worker until the first call', async () => {
    const { engine, createWorker } = setup()

    expect(createWorker).not.toHaveBeenCalled()
    await engine.loadArea(REF)
    expect(createWorker).toHaveBeenCalledTimes(1)
  })

  it('hands each answer to the call with the same id, in any order', async () => {
    const { engine, workers } = setup((m) => (m.type === 'loadArea' ? happy(m) : null))
    await engine.loadArea(REF)
    const worker = workers[0]!

    const first = engine.coverage(REF, { home: null })
    const second = engine.coverage(REF, { home: [1, 2] })
    await flush()
    const [a, b] = worker.sent('coverage')
    expect(a!.id).not.toBe(b!.id)

    worker.reply({ id: b!.id, result: 'second' as never })
    worker.reply({ id: a!.id, result: 'first' as never })

    await expect(first).resolves.toBe('first')
    await expect(second).resolves.toBe('second')
  })

  it('rejects only the call whose request failed', async () => {
    const { engine, workers } = setup((m) =>
      m.type === 'coverage' && m.home === null ? { id: m.id, error: 'boom' } : happy(m),
    )

    const failing = engine.coverage(REF, { home: null })
    const fine = engine.coverage(REF, { home: [0, 0] })

    await expect(failing).rejects.toThrow('boom')
    await expect(fine).resolves.toBeNull()
    expect(workers).toHaveLength(1)
  })

  it('ignores an answer nobody is waiting for', async () => {
    const { engine, workers } = setup()
    await engine.loadArea(REF)

    expect(() => workers[0]!.reply({ id: 999, result: null })).not.toThrow()
  })

  it('loads an area once per id and version, and again after a failure', async () => {
    let fail = true
    const { engine, workers } = setup((m) => {
      if (m.type === 'loadArea' && fail) {
        fail = false
        return { id: m.id, error: 'HTTP 503' }
      }
      return happy(m)
    })

    await expect(engine.loadArea(REF)).rejects.toThrow('HTTP 503')
    await expect(engine.loadArea(REF)).resolves.toBe(AREA)
    await engine.loadArea(REF)
    await engine.coverage(REF, { home: null })
    await engine.loadArea({ ...REF, version: 'test-20261101-00000000' })

    const loads = workers[0]!.sent('loadArea')
    expect(loads).toHaveLength(3)
    expect(loads.map((m) => m.type === 'loadArea' && m.ref.version)).toEqual([
      REF.version,
      REF.version,
      'test-20261101-00000000',
    ])
  })

  it('sends only the ref itself to the worker', async () => {
    const { engine, workers } = setup()
    await engine.loadArea({ ...REF, file: 'test.geojson', extra: () => 1 } as ExploreAreaRef)

    const [load] = workers[0]!.sent('loadArea')
    expect(load).toEqual({ type: 'loadArea', id: load!.id, ref: REF })
  })

  it('rejects every pending call when the worker dies, and starts a new one next time', async () => {
    const { engine, workers, createWorker } = setup((m) => (m.type === 'loadArea' ? happy(m) : null))
    await engine.loadArea(REF)
    const adding = engine.addTracks(REF, tracks(['a']))
    const one = engine.coverage(REF, { home: null })
    const two = engine.scoreRoutes(REF, { candidates: [], targetM: 5000, prefs: { avoidBusyRoads: true, newStreetsFirst: true, flatForReps: false } })
    await flush()
    expect(engine.unsent(REF, ['a'])).toEqual([])

    workers[0]!.fail('Script error')

    await expect(adding).rejects.toThrow('Script error')
    await expect(one).rejects.toThrow('Script error')
    await expect(two).rejects.toThrow('Script error')
    expect(workers[0]!.terminated).toBe(true)

    // The new worker knows nothing: the area is loaded again.
    const again = engine.coverage(REF, { home: null })
    await flush()
    expect(createWorker).toHaveBeenCalledTimes(2)
    expect(workers[1]!.sent('loadArea')).toHaveLength(1)
    workers[1]!.reply({ id: workers[1]!.sent('coverage')[0]!.id, result: 'ok' as never })
    await expect(again).resolves.toBe('ok')
    expect(engine.unsent(REF, ['a'])).toEqual(['a'])
  })

  it('rejects pending calls on dispose', async () => {
    const { engine, workers } = setup((m) => (m.type === 'loadArea' ? happy(m) : null))
    await engine.loadArea(REF)
    const pending = engine.coverage(REF, { home: null })
    await flush()

    engine.dispose()

    await expect(pending).rejects.toThrow('disposed')
    expect(workers[0]!.terminated).toBe(true)
  })
})

describe('addTracks', () => {
  it('transfers both buffers to the worker', async () => {
    const { engine, workers } = setup()
    const batch = tracks(['a', 'b'])
    const { offsets, coords } = batch

    await expect(engine.addTracks(REF, batch)).resolves.toEqual({ added: ['a', 'b'] })

    const [post] = workers[0]!.posted.filter((p) => p.message.type === 'addTracks')
    expect(post!.transfer).toHaveLength(2)
    expect(post!.transfer).toContain(offsets.buffer)
    expect(post!.transfer).toContain(coords.buffer)
    expect(post!.message).toMatchObject({ type: 'addTracks', areaKey: KEY, ids: ['a', 'b'] })
  })

  it('does not send a run twice', async () => {
    const { engine, workers } = setup()
    await engine.addTracks(REF, tracks(['a', 'b']))

    expect(engine.unsent(REF, ['a', 'b', 'c'])).toEqual(['c'])
    await expect(engine.addTracks(REF, tracks(['a', 'b']))).resolves.toEqual({ added: [] })
    expect(workers[0]!.sent('addTracks')).toHaveLength(1)
  })

  it('sends only the new runs, in fresh buffers, leaving the caller’s alone', async () => {
    const { engine, workers } = setup()
    await engine.addTracks(REF, tracks(['a']))
    const mixed = tracks(['a', 'b', 'c'])

    await engine.addTracks(REF, mixed)

    const post = workers[0]!.posted.filter((p) => p.message.type === 'addTracks')[1]!
    expect(post.message).toMatchObject({ ids: ['b', 'c'] })
    expect(post.transfer).not.toContain(mixed.coords.buffer)
    expect(mixed.coords).toHaveLength(12)
    const sent = post.message as Extract<ExploreRequest, { type: 'addTracks' }>
    expect(Array.from(sent.coords)).toEqual(Array.from(mixed.coords.subarray(4)))
  })

  it('keeps runs separate per area', async () => {
    const { engine } = setup()
    const other = { ...REF, version: 'test-20261101-00000000' }
    await engine.addTracks(REF, tracks(['a']))

    expect(engine.unsent(other, ['a'])).toEqual(['a'])
  })

  it('does not count runs as sent when the worker refused them', async () => {
    const { engine } = setup((m) => (m.type === 'addTracks' ? { id: m.id, error: 'Invalid track buffers' } : happy(m)))

    await expect(engine.addTracks(REF, tracks(['a']))).rejects.toThrow('Invalid track buffers')
    expect(engine.unsent(REF, ['a'])).toEqual(['a'])
  })

  it('does not resend runs while a first send is still on its way', async () => {
    const { engine, workers } = setup()

    await Promise.all([engine.addTracks(REF, tracks(['a', 'b'])), engine.addTracks(REF, tracks(['b', 'c']))])

    const sent = workers[0]!.sent('addTracks').map((m) => (m.type === 'addTracks' ? m.ids : []))
    expect(sent).toEqual([['a', 'b'], ['c']])
  })
})

describe('coverage, scoreRoutes and routeStart', () => {
  it('pass their options through, after the area is loaded', async () => {
    const { engine, workers } = setup()
    const prefs = { avoidBusyRoads: false, newStreetsFirst: true, flatForReps: false }

    await engine.coverage(REF, { activityIds: ['a'], home: [1, 2], homeFromTracks: false })
    await engine.scoreRoutes(REF, { candidates: [], targetM: 8000, prefs })
    await engine.routeStart(REF, { unitId: 'test-alpha' })

    const types = workers[0]!.posted.map((p) => p.message.type)
    expect(types).toEqual(['loadArea', 'coverage', 'scoreRoutes', 'routeStart'])
    expect(workers[0]!.sent('coverage')[0]).toMatchObject({ areaKey: KEY, activityIds: ['a'], home: [1, 2] })
    expect(workers[0]!.sent('scoreRoutes')[0]).toMatchObject({ areaKey: KEY, targetM: 8000, prefs })
    expect(workers[0]!.sent('routeStart')[0]).toEqual({ type: 'routeStart', id: expect.any(Number), areaKey: KEY, unitId: 'test-alpha' })
  })

  it('fails the call when the area cannot be loaded', async () => {
    const { engine, workers } = setup((m) => (m.type === 'loadArea' ? { id: m.id, error: 'Unknown area' } : happy(m)))

    await expect(engine.coverage(REF, { home: null })).rejects.toThrow('Unknown area')
    expect(workers[0]!.sent('coverage')).toHaveLength(0)
  })
})

describe('with the real worker core behind it', () => {
  it('moves tracks across by transfer and gets the domain’s coverage back', async () => {
    const state = createWorkerState()
    const deps = {
      fetch: async () => ({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(AREA)) }),
      cache: NO_CACHE,
    }
    // What postMessage does: a structured clone that moves the transferred buffers.
    const { engine } = setup((message, transfer) =>
      handleMessage(state, structuredClone(message, { transfer }), deps),
    )
    const batch = tracks(['a', 'b'])
    const expected = aggregateCoverage(
      buildAreaIndex(AREA),
      [0, 1].map((k) => ({
        id: ['a', 'b'][k]!,
        date: '2026-10-01',
        ...activityCells(buildAreaIndex(AREA), batch.coords.slice(4 * k, 4 * k + 4)),
      })),
      at(0, 0),
    )

    await expect(engine.addTracks(REF, batch)).resolves.toEqual({ added: ['a', 'b'] })
    // Transferred: the caller's buffers are now empty.
    expect(batch.coords.byteLength).toBe(0)
    expect(batch.offsets.byteLength).toBe(0)
    await expect(engine.coverage(REF, { home: at(0, 0) })).resolves.toEqual(expected)
  })
})
