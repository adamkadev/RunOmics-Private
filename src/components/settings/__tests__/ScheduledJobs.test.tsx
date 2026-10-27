import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { ScheduledJobs } from '@/components/settings/ScheduledJobs'
import { t } from '@/i18n'

const { authorizedFetch } = vi.hoisted(() => ({ authorizedFetch: vi.fn() }))
vi.mock('@/lib/ownerFetch', () => ({ authorizedFetch }))

const user = {} as User
const d = t.settings.diagnostics

describe('ScheduledJobs', () => {
  afterEach(() => authorizedFetch.mockReset())

  it('lists each job’s last run with its outcome once opened, a failure with its error', async () => {
    authorizedFetch.mockResolvedValue(
      Response.json({
        jobs: [
          { at: '2026-10-27T06:00:03.000Z', route: 'daily-session', trigger: 'cron', outcome: 'error', status: 500, error: 'TypeError' },
          { at: '2026-10-27T01:00:02.000Z', route: 'nightly-sync', trigger: 'cron', outcome: 'sent', status: 200 },
        ],
      })
    )

    render(<ScheduledJobs user={user} />)
    expect(authorizedFetch).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: d.scheduledJobs }))

    const rows = await screen.findAllByTestId('scheduled-job')
    expect(authorizedFetch).toHaveBeenCalledWith(user, '/api/job-events')
    expect(rows[0]!.textContent).toContain('daily-session')
    expect(rows[0]!.textContent).toContain(`${d.outcome.error} · TypeError`)
    expect(rows[1]!.textContent).toContain(d.outcome.sent)
    expect(rows[1]!.textContent).toContain(d.trigger.cron)
  })

  it('says when nothing ran yet, and when the runs could not be loaded', async () => {
    authorizedFetch.mockResolvedValueOnce(Response.json({ jobs: [] }))
    render(<ScheduledJobs user={user} />)
    const toggle = screen.getByRole('button', { name: d.scheduledJobs })

    await userEvent.click(toggle)
    expect(await screen.findByText(d.jobsNone)).toBeInTheDocument()

    authorizedFetch.mockResolvedValueOnce(new Response(null, { status: 403 }))
    await userEvent.click(toggle)
    await userEvent.click(toggle)
    expect(await screen.findByText(d.jobsLoadFailed)).toBeInTheDocument()
  })
})
