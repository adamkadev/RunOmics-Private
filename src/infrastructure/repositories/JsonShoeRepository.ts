import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'
import { buildShoeRegistry, type ShoeInfo, type ShoeRecord } from '@/domain/shoe/types'

let recordsCache: ShoeRecord[] | null = null
let registryCache: Record<string, ShoeInfo> | null = null

export function getShoeRecords(): ShoeRecord[] {
  if (recordsCache) return recordsCache

  recordsCache = readJsonFile<{ shoes?: ShoeRecord[] }>(dataPath('shoes.json'), {}).shoes ?? []
  return recordsCache
}

export function getShoeRegistry(): Record<string, ShoeInfo> {
  if (!registryCache) registryCache = buildShoeRegistry(getShoeRecords())
  return registryCache
}
