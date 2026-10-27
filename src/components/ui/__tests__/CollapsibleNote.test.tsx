import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CollapsibleNote } from '../CollapsibleNote'

function contentHeight(px: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(px)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(20)
}

afterEach(() => vi.restoreAllMocks())

describe('CollapsibleNote', () => {
  it('opens on its first line and offers a collapsed toggle when the text runs longer', () => {
    contentHeight(60)
    render(<CollapsibleNote label="Coach’s note" testId="note">Long text</CollapsibleNote>)

    const toggle = screen.getByRole('button', { name: 'Coach’s note' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-controls', screen.getByTestId('note').id)
    expect(screen.getByTestId('note').className).toContain('max-h-[1lh]')
  })

  it('expands on a tap and collapses on the next', async () => {
    contentHeight(60)
    render(<CollapsibleNote label="Coach’s note" testId="note">Long text</CollapsibleNote>)
    const toggle = screen.getByRole('button', { name: 'Coach’s note' })

    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('note').className).not.toContain('max-h-[1lh]')

    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('note').className).toContain('max-h-[1lh]')
  })

  it('has no toggle for a note that fits on one line', () => {
    contentHeight(20)
    render(<CollapsibleNote label="Coach’s note" testId="note">Short</CollapsibleNote>)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByTestId('note')).toHaveTextContent('Short')
  })

  it('keeps each note’s state its own', async () => {
    contentHeight(60)
    render(
      <>
        <CollapsibleNote label="First">One</CollapsibleNote>
        <CollapsibleNote label="Second">Two</CollapsibleNote>
      </>
    )
    await userEvent.click(screen.getByRole('button', { name: 'First' }))
    expect(screen.getByRole('button', { name: 'Second' })).toHaveAttribute('aria-expanded', 'false')
  })
})
