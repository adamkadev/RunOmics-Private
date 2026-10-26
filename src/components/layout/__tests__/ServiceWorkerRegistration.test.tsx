import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ServiceWorkerRegistration } from '@/components/layout/ServiceWorkerRegistration'
import { t } from '@/i18n'

function stubWorker({ waitingAtLoad, waitingAtTap }: { waitingAtLoad: boolean; waitingAtTap: boolean }) {
  const postMessage = vi.fn()
  const waiting = { postMessage }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      controller: {},
      register: vi.fn().mockResolvedValue({ waiting: waitingAtLoad ? waiting : null, addEventListener: vi.fn() }),
      getRegistration: vi.fn().mockResolvedValue({ waiting: waitingAtTap ? waiting : null }),
      addEventListener: vi.fn(),
    },
  })
  const reload = vi.fn()
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, pathname: '/', reload } })
  return { reload, postMessage }
}

describe('ServiceWorkerRegistration', () => {
  const location = window.location
  afterEach(() => {
    vi.unstubAllEnvs()
    Reflect.deleteProperty(navigator, 'serviceWorker')
    Object.defineProperty(window, 'location', { configurable: true, value: location })
  })

  it('reloads on Refresh when the new worker has already taken over', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { reload, postMessage } = stubWorker({ waitingAtLoad: true, waitingAtTap: false })

    render(<ServiceWorkerRegistration />)
    await userEvent.click(await screen.findByRole('button', { name: t.pwa.refresh }))

    expect(reload).toHaveBeenCalled()
    expect(postMessage).not.toHaveBeenCalled()
  })

  it('asks a worker still waiting to take over before reloading', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { reload, postMessage } = stubWorker({ waitingAtLoad: true, waitingAtTap: true })

    render(<ServiceWorkerRegistration />)
    await userEvent.click(await screen.findByRole('button', { name: t.pwa.refresh }))

    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(reload).not.toHaveBeenCalled()
  })
})
