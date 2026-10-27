import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SERVICE_WORKER_URL, ServiceWorkerRegistration } from '@/components/layout/ServiceWorkerRegistration'
import { t } from '@/i18n'

const OTHER_BUILD = 'http://localhost:3000/sw.js?v=0.0.0-other'

function stubWorker({ waitingAtLoad, waitingAtTap, scriptURL = OTHER_BUILD }: { waitingAtLoad: boolean; waitingAtTap: boolean; scriptURL?: string }) {
  const postMessage = vi.fn()
  const waiting = { postMessage, scriptURL }
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
  Object.defineProperty(window, 'location', { configurable: true, value: { href: 'http://localhost:3000/', pathname: '/', reload } })
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

  it('shows no update for a waiting worker of the build the page already runs', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    stubWorker({ waitingAtLoad: true, waitingAtTap: true, scriptURL: `http://localhost:3000${SERVICE_WORKER_URL}` })

    render(<ServiceWorkerRegistration />)
    await vi.waitFor(() => expect(navigator.serviceWorker.register).toHaveBeenCalled())

    expect(screen.queryByTestId('update-banner')).toBeNull()
  })

  it('sits above the tab bar and can be dismissed', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    stubWorker({ waitingAtLoad: true, waitingAtTap: true })

    render(<ServiceWorkerRegistration />)
    const banner = await screen.findByTestId('update-banner')
    expect(banner.className).toContain('bottom-[calc(var(--tab-bar-float)+var(--tab-bar-h)+12px)]')

    await userEvent.click(screen.getByRole('button', { name: t.pwa.dismiss }))
    expect(screen.queryByTestId('update-banner')).toBeNull()
  })
})
