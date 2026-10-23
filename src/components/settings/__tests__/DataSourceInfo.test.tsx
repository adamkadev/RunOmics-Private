import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { DataSourceInfo } from '@/components/settings/DataSourceInfo'
import { t } from '@/i18n'

const { saveFileWithFallback } = vi.hoisted(() => ({ saveFileWithFallback: vi.fn<(file: File) => Promise<void>>(async () => {}) }))
vi.mock('@/lib/fileExport', () => ({ saveFileWithFallback }))

const USER = { getIdToken: () => Promise.resolve('test-token') } as unknown as User
const s = t.settings

afterEach(() => {
  saveFileWithFallback.mockClear()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('Clear offline cache', () => {
  it('shows its size, asks before it clears anything, and Cancel leaves the cache alone', async () => {
    const keys = vi.fn(async () => ['pages', 'maps'])
    const remove = vi.fn<(key: string) => Promise<boolean>>(async () => true)
    vi.stubGlobal('caches', { keys, delete: remove })
    vi.stubGlobal('navigator', {
      ...navigator,
      storage: { estimate: async () => ({ usage: 30 * 1024 * 1024, usageDetails: { caches: 24 * 1024 * 1024 } }) },
    })
    render(<DataSourceInfo lastSyncedAt={null} activityCount={0} user={USER} />)

    expect((await screen.findByTestId('cache-size')).textContent).toBe(`24 ${t.units.mb}`)
    expect(screen.getByTestId('cache-row').innerHTML).not.toContain('--neg')

    await userEvent.click(screen.getByTestId('cache-row'))
    expect(screen.getByText(s.offlineCache.confirm)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: s.actions.confirmCancel }))
    expect(screen.getByTestId('cache-row')).toBeInTheDocument()
    expect(keys).not.toHaveBeenCalled()

    await userEvent.click(screen.getByTestId('cache-row'))
    const confirm = screen.getByRole('button', { name: s.offlineCache.confirmAction })
    expect(confirm.className).not.toContain('--neg')
    await userEvent.click(confirm)
    expect(await screen.findByText(s.offlineCache.cleared)).toBeInTheDocument()
    expect(remove.mock.calls.map(([key]) => key)).toEqual(['pages', 'maps'])
  })

  it('leaves the size out where the browser does not give one', async () => {
    vi.stubGlobal('navigator', { ...navigator, storage: undefined })
    render(<DataSourceInfo lastSyncedAt={null} activityCount={0} user={USER} />)
    await waitFor(() => expect(screen.getByTestId('cache-row')).toBeInTheDocument())
    expect(screen.queryByTestId('cache-size')).toBeNull()
  })
})

describe('The device row', () => {
  it('says when it last synced after a green dot, with Sync as a text action on the row', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString()
    render(<DataSourceInfo lastSyncedAt={twoHoursAgo} activityCount={315} device={{ name: 'Forerunner 255 Music' }} user={USER} />)
    const row = screen.getByTestId('garmin-row')
    expect(row.textContent).toContain('Forerunner 255 Music')
    expect(screen.getByTestId('sync-line').textContent).toMatch(/^Synced .* · 315 runs$/)
    expect(screen.getByTestId('garmin-connected').className).toContain('text-[var(--pos)]')
    const sync = screen.getByRole('button', { name: t.settings.sync.action })
    expect(row.contains(sync)).toBe(true)
    expect(sync.className).toContain('text-accent-text')
    expect(sync.className).not.toMatch(/\bbg-/)
  })
})

describe('Export', () => {
  function stubExport(headers: Record<string, string> = {}) {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => new Response('data', { status: 200, headers }))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('has one export row that opens a sheet with the workbook and the CSV, each asking the route for its own format', async () => {
    const fetchMock = stubExport()
    render(<DataSourceInfo lastSyncedAt={null} activityCount={0} user={USER} />)

    await userEvent.click(screen.getByTestId('export-row'))
    await userEvent.click(screen.getByTestId('export-xlsx'))
    await userEvent.click(await screen.findByTestId('export-row'))
    await userEvent.click(screen.getByTestId('export-csv'))

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/activities/export?format=xlsx',
      '/api/activities/export?format=csv',
    ])
    const names = saveFileWithFallback.mock.calls.map(([file]) => file.name)
    expect(names[0]).toMatch(/^runomics-training-data-\d{4}-\d{2}-\d{2}\.xlsx$/)
    expect(names[1]).toMatch(/^runomics-activities-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(screen.queryByText(s.dataExport.notesUnavailable)).not.toBeInTheDocument()
  })

  it('still saves the file but warns when the notes store did not answer', async () => {
    stubExport({ 'X-Runomics-Notes-Unavailable': 'true' })
    render(<DataSourceInfo lastSyncedAt={null} activityCount={0} user={USER} />)

    await userEvent.click(screen.getByTestId('export-row'))
    await userEvent.click(screen.getByTestId('export-csv'))

    expect(await screen.findByText(s.dataExport.notesUnavailable)).toBeInTheDocument()
    expect(saveFileWithFallback).toHaveBeenCalledTimes(1)
  })
})
