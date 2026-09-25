import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useUrlParam } from '../useUrlParam'

function Probe() {
  const [tab, setTab] = useUrlParam('tab')
  return (
    <button type="button" onClick={() => setTab(tab === 'charts' ? null : 'charts')}>
      {tab ?? 'none'}
    </button>
  )
}

describe('useUrlParam', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))

  it('reads the param from the address bar', () => {
    window.history.replaceState(null, '', '/activities/a1?tab=dynamics')
    render(<Probe />)

    expect(screen.getByRole('button')).toHaveTextContent('dynamics')
  })

  it('writes it back without adding a history entry', () => {
    window.history.replaceState(null, '', '/activities/a1')
    const before = window.history.length
    render(<Probe />)

    act(() => screen.getByRole('button').click())
    expect(window.location.search).toBe('?tab=charts')
    expect(screen.getByRole('button')).toHaveTextContent('charts')
    expect(window.history.length).toBe(before)

    act(() => screen.getByRole('button').click())
    expect(window.location.search).toBe('')
  })
})
