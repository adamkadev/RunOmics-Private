import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  // Design review, Oct 2026: clearing the cache asks first.
  it('asks before it clears anything, and Cancel leaves the cache alone', async () => {
    const keys = vi.fn(async () => ['pages', 'maps'])
    const remove = vi.fn<(key: string) => Promise<boolean>>(async () => true)
    vi.stubGlobal('caches', { keys, delete: remove })
    render(<DataSourceInfo lastSyncedAt={null} activityCount={0} user={USER} />)

    await userEvent.click(screen.getByRole('button', { name: s.rowAction.clear }))
    expect(screen.getByText(s.offlineCache.confirm)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: s.actions.confirmCancel }))
    expect(screen.getByText(s.offlineCache.cost)).toBeInTheDocument()
    expect(keys).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: s.rowAction.clear }))
    await userEvent.click(screen.getByRole('button', { name: s.actions.confirmYes }))
    expect(await screen.findByText(s.offlineCache.cleared)).toBeInTheDocument()
    expect(remove.mock.calls.map(([key]) => key)).toEqual(['pages', 'maps'])
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
