import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HomeRunSpot } from '@/application/usecases/GetHomeRuns'
import { encodeIntegers, encodePolyline } from '@/lib/polyline'
import { t } from '@/i18n'
import { HomeRunsPlayer, homeRunPeriods } from '../HomeRunsPlayer'

const { encode, share } = vi.hoisted(() => ({ encode: vi.fn(), share: vi.fn() }))
vi.mock('@/lib/canvasVideo', () => ({
  canvasVideoEncoder: () => Promise.resolve('webcodecs'),
  encodeCanvasClip: encode,
  videoExtension: () => 'mp4',
}))
vi.mock('@/lib/shareCardExport', () => ({ shareOrSaveFile: share }))

const spot: HomeRunSpot = {
  runs: [{
    id: 'a',
    date: '2026-01-01',
    durationSeconds: 600,
    distanceKm: 2,
    track: encodePolyline([[6.1, 49.6], [6.12, 49.61]]),
    times: encodeIntegers([0, 600]),
  }],
  firstDate: '2026-01-01',
  lastDate: '2026-01-01',
  totalKm: 2,
  place: null,
}

describe('HomeRunsPlayer video', () => {
  beforeEach(() => {
    encode.mockReset()
    share.mockReset()
  })

  it('makes the video on one tap and opens the share sheet only on the next', async () => {
    encode.mockResolvedValue(new Blob(['x'], { type: 'video/mp4' }))
    render(<HomeRunsPlayer spots={[spot]} today="2026-11-13" />)

    await userEvent.click(await screen.findByRole('button', { name: t.homeRuns.makeVideo }))

    expect(share).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole('button', { name: t.homeRuns.saveVideo }))
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ name: 'runomics-home-runs.mp4' }), t.homeRuns.title)
  })

  it('says so when the browser cannot make the video', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    encode.mockRejectedValue(new Error('no encoder'))
    render(<HomeRunsPlayer spots={[spot]} today="2026-11-13" />)

    await userEvent.click(await screen.findByRole('button', { name: t.homeRuns.makeVideo }))

    expect(await screen.findByTestId('home-runs-failed')).toHaveTextContent(t.homeRuns.videoFailed)
    expect(share).not.toHaveBeenCalled()
  })
})

describe('homeRunPeriods', () => {
  const run = (id: string, date: string) => ({ ...spot.runs[0]!, id, date })
  const days = (year: string, n: number) => Array.from({ length: n }, (_, i) => run(`${year}-${i}`, `${year}-0${1 + (i % 9)}-1${i % 10}`))
  const runs = [...days('2024', 30), ...days('2025', 40), ...days('2026', 25)]

  it('names all and this year once it holds more than 20 runs', () => {
    expect(homeRunPeriods(runs, '2026-11-13').map((tab) => [tab.id, tab.runs.length])).toEqual([['all', 95], ['2026', 25]])
  })

  it('keeps last year until this one has its 21 runs, as in January', () => {
    const january = [...days('2024', 30), ...days('2025', 40), ...days('2026', 3)]
    expect(homeRunPeriods(january, '2026-01-20').map((tab) => [tab.id, tab.runs.length])).toEqual([['all', 73], ['2025', 40]])
  })

  it('leaves the row out when the year would hold every run', () => {
    expect(homeRunPeriods(days('2026', 25), '2026-11-13')).toEqual([])
  })

  it('replays the year when its tab is tapped', async () => {
    render(<HomeRunsPlayer spots={[{ ...spot, runs }]} today="2026-11-13" />)

    const year = screen.getByRole('button', { name: t.homeRuns.period('2026', 25) })
    await userEvent.click(year)
    expect(year).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('home-runs-canvas')).toHaveAttribute('aria-label', t.homeRuns.canvasLabel(25))
  })

  it('names each start point by its town above the periods, and opens one from the link', async () => {
    window.history.replaceState(null, '', '/home-runs')
    const other = { ...spot, runs: runs.slice(0, 2), place: 'Bravo' }
    render(<HomeRunsPlayer spots={[{ ...spot, runs, place: 'Alpha' }, other]} today="2026-11-13" />)

    expect(screen.getByTestId('home-runs-spots').compareDocumentPosition(screen.getByTestId('home-runs-periods'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(screen.getByRole('button', { name: t.homeRuns.spotNamed('Alpha', 95) })).toHaveAttribute('aria-pressed', 'true')
    const second = screen.getByRole('button', { name: t.homeRuns.spotNamed('Bravo', 2) })
    await userEvent.click(second)
    expect(second).toHaveAttribute('aria-pressed', 'true')
    expect(window.location.search).toBe('?start=2')
    expect(screen.getByTestId('home-runs-canvas')).toHaveAttribute('aria-label', t.homeRuns.canvasLabel(2))
  })

  it('shows no start point switcher with one start', () => {
    render(<HomeRunsPlayer spots={[{ ...spot, runs }]} today="2026-11-13" />)
    expect(screen.queryByTestId('home-runs-spots')).toBeNull()
  })
})
