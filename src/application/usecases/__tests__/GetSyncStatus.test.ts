import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

vi.mock('fs', () => ({
  default: { existsSync: vi.fn(), readFileSync: vi.fn() },
}))

const { getGarminSeriesStatus, getLastSyncedAt, getOldShoeListDate, getSyncMeta } = await import('../GetSyncStatus')

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

describe('getSyncMeta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads the warnings, the newest sample of each series and the shoe list date', () => {
    withFile(JSON.stringify({
      lastSyncedAt: '2026-10-27T03:00:00Z',
      warnings: [{ step: 'training status', message: 'HTTP 500' }],
      warningsAt: '2026-10-27T03:00:00Z',
      seriesFreshness: { trainingStatus: '2026-10-20', vo2max: null, notASeries: '2026-10-01' },
      shoesCheckedAt: '2026-10-27T03:05:00Z',
    }))

    expect(getSyncMeta()).toEqual({
      lastSyncedAt: '2026-10-27T03:00:00Z',
      warnings: [{ step: 'training status', message: 'HTTP 500' }],
      warningsAt: '2026-10-27T03:00:00Z',
      seriesNewest: { trainingStatus: '2026-10-20', vo2max: null },
      shoesCheckedAt: '2026-10-27T03:05:00Z',
    })
  })

  it('reads a file written before the sync recorded them as none', () => {
    withFile(JSON.stringify({ lastSyncedAt: '2026-07-20T05:04:00Z', warnings: 'garbled' }))

    expect(getSyncMeta()).toEqual({ lastSyncedAt: '2026-07-20T05:04:00Z', warnings: [], warningsAt: null, seriesNewest: {}, shoesCheckedAt: null })
  })
})

describe('what the pages say about the sync report', () => {
  const NOW = Date.parse('2026-10-27T08:00:00Z')

  it('names each series, the warned steps once each, and how many requests failed', () => {
    withFile(JSON.stringify({
      lastSyncedAt: '2026-10-27T03:00:00Z',
      warnings: [{ step: 'VO2max history', message: 'a' }, { step: 'VO2max history', message: 'b' }],
      seriesFreshness: { restingHr: '2026-10-19' },
    }))

    const status = getGarminSeriesStatus(NOW)
    expect(status.warningSteps).toEqual(['VO2max history'])
    expect(status.warningCount).toBe(2)
    expect(status.series.find((row) => row.series === 'restingHr')).toMatchObject({ stale: true, newest: '2026-10-19' })
  })

  it('dates the shoe list only once it is more than two weeks old', () => {
    withFile(JSON.stringify({ lastSyncedAt: '2026-10-27T03:00:00Z', shoesCheckedAt: '2026-10-20T03:05:00Z' }))
    expect(getOldShoeListDate(NOW)).toBeNull()

    withFile(JSON.stringify({ lastSyncedAt: '2026-10-27T03:00:00Z', shoesCheckedAt: '2026-10-01T03:05:00Z' }))
    expect(getOldShoeListDate(NOW)).toBe('2026-10-01')

    withFile(JSON.stringify({ lastSyncedAt: '2026-10-27T03:00:00Z' }))
    expect(getOldShoeListDate(NOW)).toBeNull()
  })
})
