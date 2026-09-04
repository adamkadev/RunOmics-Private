import fs from 'fs'
import { dataPath } from '../dataPath'
import { buildShoeRegistry, type ShoeInfo, type ShoeRecord } from '@/domain/shoe/types'

let recordsCache: ShoeRecord[] | null = null
let registryCache: Record<string, ShoeInfo> | null = null

export function getShoeRecords(): ShoeRecord[] {
  if (recordsCache) return recordsCache

  try {
    const { shoes } = JSON.parse(fs.readFileSync(dataPath('shoes.json'), 'utf-8')) as { shoes: ShoeRecord[] }
    recordsCache = shoes
  } catch {
    recordsCache = []
  }
  return recordsCache
}

export function getShoeRegistry(): Record<string, ShoeInfo> {
  if (!registryCache) registryCache = buildShoeRegistry(getShoeRecords())
  return registryCache
}
