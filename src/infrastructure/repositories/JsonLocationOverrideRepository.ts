import { dataPath } from '../dataPath'
import { dataGeneration } from '../dataFs'
import { readJsonFile } from '../readJsonFile'

let cache: { generation: string; overrides: Record<string, unknown> } | null = null

function load(): Record<string, unknown> {
  const generation = dataGeneration()
  if (cache?.generation !== generation) {
    cache = { generation, overrides: readJsonFile<Record<string, unknown>>(dataPath('location-overrides.json'), {}) }
  }
  return cache.overrides
}

export function getLocationOverride(name: string): string | null {
  const overrides = load()
  if (!Object.hasOwn(overrides, name)) return null

  const override = overrides[name]
  return typeof override === 'string' ? override : null
}
