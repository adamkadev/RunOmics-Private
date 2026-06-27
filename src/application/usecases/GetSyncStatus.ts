import fs from 'fs'
import path from 'path'

export function getLastSyncedAt(): string | null {
  const filePath = path.join(process.cwd(), 'public', 'data', 'sync_meta.json')
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf-8')
  const parsed = JSON.parse(raw) as { lastSyncedAt: string }
  return parsed.lastSyncedAt ?? null
}
