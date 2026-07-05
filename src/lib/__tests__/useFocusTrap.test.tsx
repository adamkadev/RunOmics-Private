import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useFocusTrap } from '@/lib/useFocusTrap'

function Dialog() {
  const ref = useFocusTrap<HTMLDivElement>()
  return (
    <div ref={ref} role="dialog" aria-modal="true">
      <button>first</button>
      <button>middle</button>
      <button>last</button>
    </div>
  )
}

describe('useFocusTrap', () => {
  it('moves focus to the first focusable element on mount', () => {
    render(<Dialog />)
    expect(screen.getByText('first')).toHaveFocus()
  })

  it('marks sibling body children inert while open and restores on unmount', () => {
    const sibling = document.createElement('div')
    document.body.appendChild(sibling)

    const { unmount } = render(<Dialog />)
    expect(sibling).toHaveAttribute('inert')

    unmount()
    expect(sibling).not.toHaveAttribute('inert')
    sibling.remove()
  })

  it('wraps Tab from the last element back to the first', async () => {
    const user = userEvent.setup()
    render(<Dialog />)

    screen.getByText('last').focus()
    await user.keyboard('{Tab}')
    expect(screen.getByText('first')).toHaveFocus()
  })

  it('wraps Shift+Tab from the first element back to the last', async () => {
    const user = userEvent.setup()
    render(<Dialog />)

    screen.getByText('first').focus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(screen.getByText('last')).toHaveFocus()
  })

  it('restores focus to the previously focused element on unmount', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()

    const { unmount } = render(<Dialog />)
    expect(opener).not.toHaveFocus()

    unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })
})
