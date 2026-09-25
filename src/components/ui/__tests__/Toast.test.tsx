import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Toast, useToast } from '../Toast'

function Harness() {
  const { toast, leaving, showToast } = useToast()
  return (
    <>
      <button type="button" onClick={() => showToast('First', true)}>first</button>
      <button type="button" onClick={() => showToast('Second', true)}>second</button>
      <Toast toast={toast} leaving={leaving} />
    </>
  )
}

describe('useToast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('announces itself politely to a screen reader', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('first'))

    expect(screen.getByRole('status')).toHaveTextContent('First')
  })

  // The first toast's timers used to keep running: at 2 s they faded the
  // second toast out, and 200 ms later removed it, 1.5 s early.
  it('gives a newer toast its whole time on screen', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('first'))
    act(() => vi.advanceTimersByTime(1_500))
    fireEvent.click(screen.getByText('second'))

    act(() => vi.advanceTimersByTime(700))
    expect(screen.getByRole('status')).toHaveTextContent('Second')
    expect(screen.getByRole('status').className).not.toContain('opacity-0')

    act(() => vi.advanceTimersByTime(1_500))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  // White measured about 2:1 on the dark teal accent (L 0.71): the one
  // confirmation after saving a note was the hardest thing on screen to read.
  it("writes a success toast in the accent's own ink", () => {
    render(<Toast toast={{ msg: 'Saved', ok: true }} />)
    const cls = screen.getByRole('status').className

    expect(cls).toContain('bg-accent')
    expect(cls).toContain('text-accent-foreground')
    expect(cls).not.toContain('text-white')
  })

  it('keeps white ink on the destructive fill', () => {
    render(<Toast toast={{ msg: 'Failed', ok: false }} />)
    const cls = screen.getByRole('status').className

    expect(cls).toContain('bg-destructive')
    expect(cls).toContain('text-white')
  })
})
