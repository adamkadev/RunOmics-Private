import 'server-only'
import path from 'path'
import { dataPath } from '../dataPath'
import { dataFs, dataGeneration } from '../dataFs'
import { readJsonFile } from '../readJsonFile'
import { parseAreaFile, parseIndexFile } from '@/domain/explore/areaFile'
import type { ExploreAreaRef, ExploreIndexFile } from '@/domain/explore/types'

/**
 * Optional: a dataset without Explore areas has no Districts layer, not a broken page,
 * so a missing directory or index reads as no areas at all.
 */

type IndexedArea = ExploreIndexFile['areas'][number]

export interface ExploreAreaFileRead {
  version: string
  /** The file as written, served byte for byte. */
  body: string
}

/** The version travels in an ETag, between double quotes, so it keeps to plain characters. */
const ETAG_SAFE = /^[A-Za-z0-9._-]{1,128}$/

const isAbsent = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT'

// Keyed by generation, like the activity cache, so each commit or workspace is read once.
let cache: {
  generation: string
  dir: string
  areas: IndexedArea[]
  refs: ExploreAreaRef[]
  files: Map<string, ExploreAreaFileRead | null>
} | null = null

/**
 * The index whole or not at all, less any area whose version cannot be an ETag. Its file names
 * are bare ones beside the index, so nothing outside `explore/` can be reached through them.
 */
function readIndex(dir: string): IndexedArea[] {
  const indexPath = path.join(dir, 'index.json')
  const json = readJsonFile<unknown>(indexPath, null)
  if (json === null) return []

  const index = parseIndexFile(json)
  if (!index) {
    console.warn(`[explore] ${indexPath} is not a valid index - no areas`)
    return []
  }
  return index.areas.filter((area) => {
    if (ETAG_SAFE.test(area.version)) return true
    console.warn(`[explore] ${indexPath}: skipping "${area.id}", whose version is not a plain tag`)
    return false
  })
}

function load() {
  const dir = dataPath('explore')
  const generation = dataGeneration()
  if (cache?.generation !== generation) {
    const areas = readIndex(dir)
    // The file name stays here: the page needs the rest, never where it sits.
    const refs = areas.map(({ id, name, version, bbox }) => ({ id, name, version, bbox }))
    cache = { generation, dir, areas, refs, files: new Map() }
  }
  return cache
}

export function listExploreAreas(): ExploreAreaRef[] {
  return load().refs
}

/**
 * Checked whole, as the worker will check it, so a refused file is a 404 rather than a broken layer;
 * and against the index, because the version is the ETag and a mismatch would be cached for good.
 */
export function readExploreAreaFile(id: string): ExploreAreaFileRead | null {
  const { dir, areas, files } = load()
  const area = areas.find((a) => a.id === id)
  // Only listed ids are cached, so a stream of made-up ones cannot grow the map.
  if (!area) return null
  if (files.has(id)) return files.get(id) ?? null

  const read = readAreaFile(dir, area)
  files.set(id, read)
  return read
}

/** Null unless the file sits directly inside `dir`: the index already rules that out, and this is the check at the read. */
export function areaFilePath(dir: string, file: string): string | null {
  const root = path.resolve(dir)
  const filePath = path.resolve(root, file)
  return path.dirname(filePath) === root ? filePath : null
}

function readAreaFile(dir: string, area: IndexedArea): ExploreAreaFileRead | null {
  const filePath = areaFilePath(dir, area.file)
  if (!filePath) return null

  let body: string
  try {
    body = dataFs.readFileSync(filePath, 'utf-8')
  } catch (error) {
    if (!isAbsent(error)) console.warn(`[explore] could not read ${filePath}:`, error)
    else console.warn(`[explore] the index lists ${area.file}, which is missing`)
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    parsed = null
  }
  const file = parseAreaFile(parsed)
  if (!file) {
    console.warn(`[explore] ${filePath} is not a valid area file`)
    return null
  }
  if (file.runomics.id !== area.id || file.runomics.version !== area.version) {
    console.warn(`[explore] ${filePath} does not match its index entry "${area.id}" (${area.version})`)
    return null
  }

  return { version: area.version, body }
}
