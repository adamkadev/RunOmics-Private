import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HomeRunSpot } from '@/application/usecases/GetHomeRuns'
import { encodeIntegers, encodePolyline } from '@/lib/polyline'
import { t } from '@/i18n'
import { HomeRunsPlayer } from '../HomeRunsPlayer'

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
    render(<HomeRunsPlayer spots={[spot]} />)

    await userEvent.click(await screen.findByRole('button', { name: t.homeRuns.makeVideo }))

    expect(share).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole('button', { name: t.homeRuns.saveVideo }))
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ name: 'runomics-home-runs.mp4' }), t.homeRuns.title)
  })

  it('says so when the browser cannot make the video', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    encode.mockRejectedValue(new Error('no encoder'))
    render(<HomeRunsPlayer spots={[spot]} />)

    await userEvent.click(await screen.findByRole('button', { name: t.homeRuns.makeVideo }))

    expect(await screen.findByTestId('home-runs-failed')).toHaveTextContent(t.homeRuns.videoFailed)
    expect(share).not.toHaveBeenCalled()
  })
})
