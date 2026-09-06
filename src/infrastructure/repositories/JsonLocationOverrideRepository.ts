import fs from 'fs'
import { dataPath } from '../dataPath'

let cache: Record<string, unknown> | null = null

function load(): Record<string, unknown> {
  if (cache) return cache

  try {
    cache = JSON.parse(fs.readFileSync(dataPath('location-overrides.json'), 'utf-8')) as Record<string, unknown>
  } catch {
    cache = {}
  }
  return cache
}

export function getLocationOverride(name: string): string | null {
  const overrides = load()
  if (!Object.hasOwn(overrides, name)) return null

  const override = overrides[name]
  return typeof override === 'string' ? override : null
}
