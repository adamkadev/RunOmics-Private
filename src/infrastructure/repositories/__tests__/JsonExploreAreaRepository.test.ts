import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { areaFilePath, listExploreAreas, readExploreAreaFile } from '../JsonExploreAreaRepository'

// A fictional area near the demo dataset's mid-Pacific home, never a real place.
const BBOX = [-150.05, -0.05, -149.95, 0.05]
const VERSION = 'demo-20261022-0123abcd'

function areaFile(id = 'demo', version = VERSION): string {
  return JSON.stringify({
    type: 'FeatureCollection',
    runomics: {
      schema: 1,
      id,
      name: 'Demo Town',
      version,
      generatedAt: '2026-10-22T12:00:00Z',
      grid: { origin: [-150, 0], cellM: 150 },
      bbox: BBOX,
      sources: [],
    },
    features: [],
  })
}

describe('JsonExploreAreaRepository', () => {
  let root: string
  let explore: string

  const writeIndex = (areas: unknown[], schema: unknown = 1) =>
    fs.writeFileSync(path.join(explore, 'index.json'), JSON.stringify({ schema, areas }))

  beforeEach(() => {
    // A fresh workspace per test: the cache is keyed by directory.
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'explore-root-'))
    explore = path.join(root, 'explore')
    vi.stubEnv('RUNOMICS_DATA_DIR', root)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('reads a dataset without Explore areas as no areas, quietly', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(listExploreAreas()).toEqual([])
    expect(readExploreAreaFile('demo')).toBeNull()
    expect(warn).not.toHaveBeenCalled()
  })

  it('lists the areas without saying where their files sit', () => {
    fs.mkdirSync(explore)
    writeIndex([{ id: 'demo', name: 'Demo Town', version: VERSION, bbox: BBOX, file: 'demo.geojson' }])

    expect(listExploreAreas()).toEqual([{ id: 'demo', name: 'Demo Town', version: VERSION, bbox: BBOX }])
  })

  it("serves a listed area's file as written, with its version", () => {
    fs.mkdirSync(explore)
    writeIndex([{ id: 'demo', name: 'Demo Town', version: VERSION, bbox: BBOX, file: 'demo.geojson' }])
    fs.writeFileSync(path.join(explore, 'demo.geojson'), areaFile())

    expect(readExploreAreaFile('demo')).toEqual({ version: VERSION, body: areaFile() })
    expect(readExploreAreaFile('elsewhere')).toBeNull()
  })

  it.each(['../secret.json', 'sub/nested.geojson', '/etc/hosts', '..', ''])(
    'never follows the file name %j out of the explore directory',
    (file) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      // The index parser refuses these names first; `areaFilePath` is the guard behind it.
      fs.mkdirSync(path.join(explore, 'sub'), { recursive: true })
      fs.writeFileSync(path.join(root, 'secret.json'), areaFile('escape'))
      fs.writeFileSync(path.join(explore, 'sub', 'nested.geojson'), areaFile('escape'))
      writeIndex([{ id: 'escape', name: 'Escape', version: VERSION, bbox: BBOX, file }])

      expect(readExploreAreaFile('escape')).toBeNull()
      expect(areaFilePath(explore, file)).toBeNull()
    },
  )

  it('finds a bare file name beside the index, and only that', () => {
    expect(areaFilePath(explore, 'demo.geojson')).toBe(path.join(path.resolve(explore), 'demo.geojson'))
    expect(areaFilePath(explore + path.sep + '.', 'demo.geojson')).toBe(path.join(path.resolve(explore), 'demo.geojson'))
    expect(areaFilePath(explore, './demo.geojson')).toBe(path.join(path.resolve(explore), 'demo.geojson'))
  })

  it('refuses a file the worker would refuse', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fs.mkdirSync(explore)
    writeIndex([{ id: 'demo', name: 'Demo Town', version: VERSION, bbox: BBOX, file: 'demo.geojson' }])
    fs.writeFileSync(path.join(explore, 'demo.geojson'), JSON.stringify({ type: 'FeatureCollection', runomics: { schema: 1, id: 'demo', version: VERSION }, features: [] }))

    expect(readExploreAreaFile('demo')).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('drops an area whose version could not be sent as an ETag, and keeps the rest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fs.mkdirSync(explore)
    writeIndex([
      { id: 'quoted', name: 'Quoted', version: 'v"1', bbox: BBOX, file: 'quoted.geojson' },
      { id: 'demo', name: 'Demo Town', version: VERSION, bbox: BBOX, file: 'demo.geojson' },
    ])

    expect(listExploreAreas()).toEqual([{ id: 'demo', name: 'Demo Town', version: VERSION, bbox: BBOX }])
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('reads an index with a malformed or repeated entry as no areas', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    fs.mkdirSync(explore)
    writeIndex([
      { id: 'demo', name: 'Demo Town', version: VERSION, bbox: BBOX, file: 'demo.geojson' },
      { id: 'demo', name: 'Demo Again', version: VERSION, bbox: BBOX, file: 'demo2.geojson' },
    ])

    expect(listExploreAreas()).toEqual([])
  })

  it('reads an index of another schema, or not an index at all, as no areas', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    fs.mkdirSync(explore)
    writeIndex([{ id: 'demo', name: 'Demo Town', version: VERSION, bbox: BBOX, file: 'demo.geojson' }], 2)
    expect(listExploreAreas()).toEqual([])

    vi.stubEnv('RUNOMICS_DATA_DIR', fs.mkdtempSync(path.join(os.tmpdir(), 'explore-broken-')))
    fs.mkdirSync(path.join(process.env.RUNOMICS_DATA_DIR!, 'explore'))
    fs.writeFileSync(path.join(process.env.RUNOMICS_DATA_DIR!, 'explore', 'index.json'), '{ not json')
    try {
      expect(listExploreAreas()).toEqual([])
    } finally {
      fs.rmSync(process.env.RUNOMICS_DATA_DIR!, { recursive: true, force: true })
    }
  })

  it('refuses a file whose version is not the one the index promised', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fs.mkdirSync(explore)
    writeIndex([
      { id: 'demo', name: 'Demo Town', version: VERSION, bbox: BBOX, file: 'demo.geojson' },
      { id: 'gone', name: 'Gone', version: VERSION, bbox: BBOX, file: 'gone.geojson' },
    ])
    fs.writeFileSync(path.join(explore, 'demo.geojson'), areaFile('demo', 'demo-20260101-ffffffff'))

    expect(readExploreAreaFile('demo')).toBeNull()
    expect(readExploreAreaFile('gone')).toBeNull()
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('reads each workspace once: the areas only change with a deployment', () => {
    fs.mkdirSync(explore)
    writeIndex([{ id: 'demo', name: 'Demo Town', version: VERSION, bbox: BBOX, file: 'demo.geojson' }])
    fs.writeFileSync(path.join(explore, 'demo.geojson'), areaFile())
    expect(readExploreAreaFile('demo')?.version).toBe(VERSION)

    fs.rmSync(explore, { recursive: true, force: true })
    expect(listExploreAreas()).toHaveLength(1)
    expect(readExploreAreaFile('demo')?.body).toBe(areaFile())
  })
})
