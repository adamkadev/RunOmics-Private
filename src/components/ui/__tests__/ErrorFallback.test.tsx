import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { ErrorFallback } from '@/components/ui/ErrorFallback'
import { t } from '@/i18n'

describe('ErrorFallback', () => {
  it('shows the error message, digest and both actions', () => {
    const error = Object.assign(new Error('boom'), { digest: 'abc123' })
    render(<ErrorFallback error={error} reset={() => {}} />)

    expect(screen.getByText(t.pages.error.heading)).toBeInTheDocument()
    expect(screen.getByText('abc123')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(t.pages.error.retry) })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: new RegExp(t.pages.error.back) })).toHaveAttribute('href', '/')
  })

  it('calls reset when the retry button is clicked', async () => {
    const user = userEvent.setup()
    const reset = vi.fn()
    render(<ErrorFallback error={new Error('boom')} reset={reset} />)

    await user.click(screen.getByRole('button', { name: new RegExp(t.pages.error.retry) }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('has no axe violations', async () => {
    const { container } = render(<ErrorFallback error={new Error('boom')} reset={() => {}} />)
    const results = await axe.run(container)
    expect(results.violations).toEqual([])
  })
})
