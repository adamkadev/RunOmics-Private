import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

vi.mock('fs', () => ({
  default: { existsSync: vi.fn(), readFileSync: vi.fn() },
}))

const { getLastSyncedAt } = await import('../GetSyncStatus')

const existsSync = vi.mocked(fs.existsSync)
const readFileSync = vi.mocked(fs.readFileSync)

function withFile(contents: string | null) {
  existsSync.mockReturnValue(contents !== null)
  readFileSync.mockReturnValue(contents ?? '')
}

describe('getLastSyncedAt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('null when the sync has never written its metadata', () => {
    withFile(null)

    expect(getLastSyncedAt()).toBeNull()
    expect(readFileSync).not.toHaveBeenCalled()
  })

  it('reads the timestamp the last sync recorded', () => {
    withFile(JSON.stringify({ lastSyncedAt: '2026-07-20T05:04:00Z' }))

    expect(getLastSyncedAt()).toBe('2026-07-20T05:04:00Z')
  })

  it('null when the file carries no timestamp', () => {
    withFile(JSON.stringify({ activityCount: 812 }))

    expect(getLastSyncedAt()).toBeNull()
  })

  it('reads the metadata from the server-only data directory', () => {
    withFile(JSON.stringify({ lastSyncedAt: '2026-07-20T05:04:00Z' }))
    getLastSyncedAt()

    expect(readFileSync).toHaveBeenCalledWith(path.join(process.cwd(), 'data', 'sync_meta.json'), 'utf-8')
  })
})
