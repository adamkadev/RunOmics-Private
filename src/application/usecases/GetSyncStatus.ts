import fs from 'fs'
import { dataPath } from '@/infrastructure/dataPath'

export function getLastSyncedAt(): string | null {
  const filePath = dataPath('sync_meta.json')
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf-8')
  const parsed = JSON.parse(raw) as { lastSyncedAt: string }
  return parsed.lastSyncedAt ?? null
}
