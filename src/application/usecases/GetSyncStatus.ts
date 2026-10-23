import { dataPath } from '@/infrastructure/dataPath'
import { dataFs } from '@/infrastructure/dataFs'

export function getLastSyncedAt(): string | null {
  const filePath = dataPath('sync_meta.json')
  if (!dataFs.existsSync(filePath)) return null
  const raw = dataFs.readFileSync(filePath, 'utf-8')
  const parsed = JSON.parse(raw) as { lastSyncedAt: string }
  return parsed.lastSyncedAt ?? null
}
