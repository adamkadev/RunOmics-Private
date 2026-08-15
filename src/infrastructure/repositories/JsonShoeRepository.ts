import fs from 'fs'
import { dataPath } from '../dataPath'
import { buildShoeRegistry, type ShoeInfo, type ShoeRecord } from '@/domain/shoe/types'

let cache: Record<string, ShoeInfo> | null = null

export function getShoeRegistry(): Record<string, ShoeInfo> {
  if (cache) return cache

  try {
    const { shoes } = JSON.parse(fs.readFileSync(dataPath('shoes.json'), 'utf-8')) as { shoes: ShoeRecord[] }
    cache = buildShoeRegistry(shoes)
  } catch {
    cache = {}
  }
  return cache
}
