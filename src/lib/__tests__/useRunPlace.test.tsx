import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { runPlace } from '@/lib/useRunPlace'
import { RunPlace } from '@/components/activity/RunPlace'

describe('runPlace', () => {
  it('reads the town and the quartier inside it', () => {
    expect(runPlace({ suburb: 'Robertsau', city: 'Strasbourg' })).toEqual({ town: 'Strasbourg', quartier: 'Robertsau' })
    expect(runPlace({ town: 'Hoenheim' })).toEqual({ town: 'Hoenheim', quartier: null })
    expect(runPlace({ quarter: 'Quartier des XV', city: 'Strasbourg' }).quartier).toBe('Quartier des XV')
    expect(runPlace(undefined)).toEqual({ town: null, quartier: null })
  })
})

describe('RunPlace in the Activity header', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  // One place rule everywhere: the town, as the share card names it.
  it('names the town the run started in from a point a kilometre coarse, in one lookup, and keeps it', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ address: { suburb: 'Robertsau', city: 'Strasbourg' } })),
    )
    render(<RunPlace activityId="a1" start={[7.78342, 48.61273]} />)
    expect(await screen.findByTestId('run-place')).toHaveTextContent('Strasbourg')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]![0])).toContain('lat=48.61&lon=7.78&')
    expect(JSON.parse(localStorage.getItem('ro_runplace_a1')!)).toEqual({ town: 'Strasbourg', quartier: 'Robertsau' })
  })

  it('renders nothing on the server, so the cached name cannot break hydration', () => {
    localStorage.setItem('ro_runplace_a2', JSON.stringify({ town: 'Hoenheim', quartier: null }))
    expect(renderToString(<RunPlace activityId="a2" start={[7.7, 48.6]} />)).toBe('')
  })

  it('uses the cached place without asking again, and nothing without a route', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    localStorage.setItem('ro_runplace_a3', JSON.stringify({ town: 'Hoenheim', quartier: null }))
    render(<RunPlace activityId="a3" start={[7.7, 48.6]} />)
    expect(await screen.findByTestId('run-place')).toHaveTextContent('Hoenheim')
    const { container } = render(<RunPlace activityId="a4" start={null} />)
    await waitFor(() => expect(container.innerHTML).toBe(''))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
