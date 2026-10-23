import { dataPath } from '../dataPath'
import { dataGeneration } from '../dataFs'
import { readJsonFile } from '../readJsonFile'
import { buildShoeRegistry, type ShoeInfo, type ShoeRecord } from '@/domain/shoe/types'

let cache: { generation: string; records: ShoeRecord[]; registry: Record<string, ShoeInfo> } | null = null

function load() {
  const generation = dataGeneration()
  if (cache?.generation !== generation) {
    const records = readJsonFile<{ shoes?: ShoeRecord[] }>(dataPath('shoes.json'), {}).shoes ?? []
    cache = { generation, records, registry: buildShoeRegistry(records) }
  }
  return cache
}

export function getShoeRecords(): ShoeRecord[] {
  return load().records
}

export function getShoeRegistry(): Record<string, ShoeInfo> {
  return load().registry
}
