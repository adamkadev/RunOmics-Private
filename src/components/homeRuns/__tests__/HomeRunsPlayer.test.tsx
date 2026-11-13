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
  const runs = [run('a', '2025-05-02'), run('b', '2025-12-30'), run('c', '2026-03-01'), run('d', '2026-11-02'), run('e', '2026-11-09')]

  it('names all, this year and this month, each with its count', () => {
    const tabs = homeRunPeriods(runs, '2026-11-13')
    expect(tabs.map((tab) => [tab.id, tab.runs.length])).toEqual([['all', 5], ['year', 3], ['month', 2]])
    expect(tabs[1]!.label).toBe('2026')
  })

  it('leaves out a period that adds nothing, and the row when only all is left', () => {
    expect(homeRunPeriods(runs.slice(2), '2026-11-13').map((tab) => tab.id)).toEqual(['all', 'month'])
    expect(homeRunPeriods(runs.slice(3), '2026-11-13')).toEqual([])
  })

  it('switches the replay to the period tapped', async () => {
    render(<HomeRunsPlayer spots={[{ ...spot, runs }]} today="2026-11-13" />)

    const month = screen.getByRole('button', { name: t.homeRuns.period(homeRunPeriods(runs, '2026-11-13')[2]!.label, 2) })
    await userEvent.click(month)
    expect(month).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('home-runs-canvas')).toHaveAttribute('aria-label', t.homeRuns.canvasLabel(2))
  })

  it('offers the other start points under the periods, and opens one from the link', async () => {
    window.history.replaceState(null, '', '/home-runs')
    const other = { ...spot, runs: runs.slice(0, 2) }
    render(<HomeRunsPlayer spots={[{ ...spot, runs }, other]} today="2026-11-13" />)

    const second = screen.getByRole('button', { name: t.homeRuns.spot(2) })
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
