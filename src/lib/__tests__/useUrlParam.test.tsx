import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { removeUrlParams, useUrlParam } from '../useUrlParam'

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

  it('writes it back without adding a history entry, or a popstate the app shell would take for Back', () => {
    window.history.replaceState(null, '', '/activities/a1')
    const before = window.history.length
    let popped = 0
    const onPop = () => popped++
    window.addEventListener('popstate', onPop)
    render(<Probe />)

    act(() => screen.getByRole('button').click())
    window.removeEventListener('popstate', onPop)
    expect(window.location.search).toBe('?tab=charts')
    expect(screen.getByRole('button')).toHaveTextContent('charts')
    expect(window.history.length).toBe(before)
    expect(popped).toBe(0)

    act(() => screen.getByRole('button').click())
    expect(window.location.search).toBe('')
  })

  it('takes several params out at once, in one replaced entry, and tells the readers', () => {
    window.history.replaceState(null, '', '/activities?view=map&explore=route&km=9.5&from=plan')
    function Explore() {
      const [explore] = useUrlParam('explore')
      return <p>{explore ?? 'none'}</p>
    }
    render(<Explore />)
    const before = window.history.length
    act(() => removeUrlParams(['explore', 'km', 'pace', 'from']))
    expect(window.location.search).toBe('?view=map')
    expect(window.history.length).toBe(before)
    expect(screen.getByText('none')).toBeInTheDocument()
  })

  it('leaves the address alone when none of them is there', () => {
    window.history.replaceState(null, '', '/activities?view=map')
    let popped = 0
    const onPop = () => popped++
    window.addEventListener('popstate', onPop)
    removeUrlParams(['explore'])
    window.removeEventListener('popstate', onPop)
    expect(window.location.search).toBe('?view=map')
    expect(popped).toBe(0)
  })
})
