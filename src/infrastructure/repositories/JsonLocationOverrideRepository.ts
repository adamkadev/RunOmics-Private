import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'

let cache: Record<string, unknown> | null = null

function load(): Record<string, unknown> {
  if (cache) return cache

  cache = readJsonFile<Record<string, unknown>>(dataPath('location-overrides.json'), {})
  return cache
}

export function getLocationOverride(name: string): string | null {
  const overrides = load()
  if (!Object.hasOwn(overrides, name)) return null

  const override = overrides[name]
  return typeof override === 'string' ? override : null
}
