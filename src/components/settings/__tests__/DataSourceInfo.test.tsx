import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { DataSourceInfo } from '@/components/settings/DataSourceInfo'
import { t } from '@/i18n'

const USER = { getIdToken: () => Promise.resolve('test-token') } as unknown as User
const s = t.settings

afterEach(() => {
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
