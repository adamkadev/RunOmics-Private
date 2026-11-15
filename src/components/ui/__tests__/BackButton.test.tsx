import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BackButton } from '../BackButton'

const router = { back: vi.fn(), push: vi.fn() }
let origin: { path: string; isImmediate: boolean } | null = null
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/components/layout/NavigationHistory', () => ({ useNavigationOrigin: () => origin }))

const fromProgress = [{ href: '/profile', label: 'Progress' }]

describe('BackButton', () => {
  beforeEach(() => {
    router.back.mockClear()
    router.push.mockClear()
  })

  it('returns to the other parent the page was opened from', async () => {
    origin = { path: '/profile', isImmediate: true }
    render(<BackButton label="Plan" fallbackHref="/plan" alsoFrom={fromProgress} />)
    await userEvent.click(screen.getByRole('button', { name: 'Progress' }))

    expect(router.back).toHaveBeenCalledTimes(1)
    expect(router.push).not.toHaveBeenCalled()
  })

  it('goes to its own parent when opened from anywhere else', async () => {
    origin = { path: '/activities', isImmediate: true }
    render(<BackButton label="Plan" fallbackHref="/plan" alsoFrom={fromProgress} />)
    await userEvent.click(screen.getByRole('button', { name: 'Plan' }))

    expect(router.push).toHaveBeenCalledWith('/plan')
  })
})
