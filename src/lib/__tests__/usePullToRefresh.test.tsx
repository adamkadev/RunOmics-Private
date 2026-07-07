import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { usePullToRefresh } from '../usePullToRefresh'

function Harness({ onRefresh }: { onRefresh: () => void }) {
  const { containerRef, pullPx, refreshing } = usePullToRefresh(onRefresh)
  return (
    <div ref={containerRef} data-testid="container">
      <span data-testid="pull">{pullPx}</span>
      <span data-testid="refreshing">{String(refreshing)}</span>
    </div>
  )
}

function touch(clientY: number) {
  return { touches: [{ clientY }] }
}

describe('usePullToRefresh', () => {
  it('grows pullPx while dragging down from the top', () => {
    const { getByTestId } = render(<Harness onRefresh={() => {}} />)
    const el = getByTestId('container')

    fireEvent.touchStart(el, touch(0))
    fireEvent.touchMove(el, touch(60))

    expect(Number(getByTestId('pull').textContent)).toBeGreaterThan(0)
  })

  it('does not grow when dragging up', () => {
    const { getByTestId } = render(<Harness onRefresh={() => {}} />)
    const el = getByTestId('container')

    fireEvent.touchStart(el, touch(0))
    fireEvent.touchMove(el, touch(-60))

    expect(Number(getByTestId('pull').textContent)).toBe(0)
  })

  it('calls onRefresh once the pull crosses the threshold on release', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const { getByTestId } = render(<Harness onRefresh={onRefresh} />)
    const el = getByTestId('container')

    fireEvent.touchStart(el, touch(0))
    fireEvent.touchMove(el, touch(200)) // well past the threshold after damping
    fireEvent.touchEnd(el)

    expect(onRefresh).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(getByTestId('refreshing').textContent).toBe('false'))
  })

  it('does not call onRefresh for a short pull', () => {
    const onRefresh = vi.fn()
    const { getByTestId } = render(<Harness onRefresh={onRefresh} />)
    const el = getByTestId('container')

    fireEvent.touchStart(el, touch(0))
    fireEvent.touchMove(el, touch(10))
    fireEvent.touchEnd(el)

    expect(onRefresh).not.toHaveBeenCalled()
  })
})
