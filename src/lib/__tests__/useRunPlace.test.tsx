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
    vi.unstubAllEnvs()
  })

  it('names the town MapTiler puts the start in, from a point about 110 m coarse, as the share card does', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPTILER_TOKEN', 'key')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ features: [
      { text: "Cité de l'Ill", place_type: ['place'] },
      { text: 'Strasbourg', place_type: ['municipality'] },
    ] })))
    render(<RunPlace activityId="m1" start={[7.78342, 48.61273]} />)
    expect(await screen.findByTestId('run-place')).toHaveTextContent('Strasbourg')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/geocoding/7.783,48.613.json')
  })

  it('asks Nominatim when MapTiler names no town', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPTILER_TOKEN', 'key')
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ features: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ address: { town: 'Hoenheim' } })))
    render(<RunPlace activityId="m2" start={[7.75, 48.62]} />)
    expect(await screen.findByTestId('run-place')).toHaveTextContent('Hoenheim')
    expect(String(fetchMock.mock.calls[1]![0])).toContain('nominatim')
  })

  it('names the town the run started in from a point a kilometre coarse without a MapTiler token, and keeps it', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPTILER_TOKEN', '')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ address: { suburb: 'Robertsau', city: 'Strasbourg' } })),
    )
    render(<RunPlace activityId="a1" start={[7.78342, 48.61273]} />)
    expect(await screen.findByTestId('run-place')).toHaveTextContent('Strasbourg')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]![0])).toContain('lat=48.61&lon=7.78&')
    expect(JSON.parse(localStorage.getItem('ro_runplace_v2_a1')!)).toEqual({ town: 'Strasbourg', quartier: 'Robertsau' })
  })

  it('renders nothing on the server, so the cached name cannot break hydration', () => {
    localStorage.setItem('ro_runplace_v2_a2', JSON.stringify({ town: 'Hoenheim', quartier: null }))
    expect(renderToString(<RunPlace activityId="a2" start={[7.7, 48.6]} />)).toBe('')
  })

  it('uses the cached place without asking again, and nothing without a route', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    localStorage.setItem('ro_runplace_v2_a3', JSON.stringify({ town: 'Hoenheim', quartier: null }))
    render(<RunPlace activityId="a3" start={[7.7, 48.6]} />)
    expect(await screen.findByTestId('run-place')).toHaveTextContent('Hoenheim')
    const { container } = render(<RunPlace activityId="a4" start={null} />)
    await waitFor(() => expect(container.innerHTML).toBe(''))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
