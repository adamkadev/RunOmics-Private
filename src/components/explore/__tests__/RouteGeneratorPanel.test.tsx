import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'
import type { RoutePreferences } from '@/domain/explore/types'
import { ROUTE_KM_MAX, ROUTE_KM_MIN } from '../exploreHref'
import { RouteGeneratorPanel, failureMessage, type RouteGeneratorPanelProps } from '../RouteGeneratorPanel'
import type { RouteStats } from '../routeGenerator'

const save = vi.hoisted(() => ({ saveFileWithFallback: vi.fn() }))
vi.mock('@/lib/fileExport', () => save)

const e = t.pages.map.explore
const STATS: RouteStats = { distanceKm: 8.1, timeSeconds: 2835, climbM: 24, newPct: 94 }
const PREFS: RoutePreferences = { avoidBusyRoads: true, newStreetsFirst: true }
const FILE = new File(['<gpx/>'], 'RunOmics-NouvelleVille-8km.gpx', { type: 'application/gpx+xml' })

function renderPanel(over: Partial<RouteGeneratorPanelProps> = {}) {
  const props: RouteGeneratorPanelProps = {
    unitName: 'Nouvelle Ville',
    distanceKm: 8,
    onDistanceChange: vi.fn(),
    plan: { heading: e.todaysPlan, label: 'Easy · 8 km + 6 strides', km: 8 },
    prefs: PREFS,
    onPrefsChange: vi.fn(),
    status: 'ready',
    failure: null,
    stats: STATS,
    paceSecPerKm: 350,
    routeKey: 'r1',
    gpxFile: vi.fn(() => FILE),
    onRegenerate: vi.fn(),
    onRetry: vi.fn(),
    onClose: vi.fn(),
    ...over,
  }
  const view = render(<RouteGeneratorPanel {...props} />)
  return { props, ...view }
}

const stats = () => within(screen.getByTestId('route-stats'))

describe('RouteGeneratorPanel (S3/S4)', () => {
  beforeEach(() => {
    save.saveFileWithFallback.mockReset()
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('is a non-modal sheet named by its title, the map left alone', () => {
    renderPanel()
    const panel = screen.getByRole('dialog', { name: e.title('Nouvelle Ville') })
    expect(panel).toHaveAttribute('aria-modal', 'false')
    expect(panel).toHaveClass('lg', 'lg-sheet')
    // No scrim, nothing made inert.
    expect(document.querySelector('[inert]')).toBeNull()
  })

  it('shows the loop’s numbers: distance, time at the pace, climb, and how new it is', () => {
    renderPanel()
    expect(stats().getByText('8.1 km')).toBeInTheDocument()
    expect(stats().getByText('47 min')).toBeInTheDocument()
    expect(stats().getByText(e.atPace('5:50'))).toBeInTheDocument()
    expect(stats().getByText('+24 m')).toBeInTheDocument()
    const fresh = stats().getByText('94%')
    expect(fresh).toHaveClass('text-accent-text')
    expect(screen.getByText(e.footnote)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: e.download })).toBeEnabled()
  })

  it('names the time stat plainly, with dashes, when there is no pace', () => {
    renderPanel({ paceSecPerKm: null, stats: { ...STATS, timeSeconds: null } })
    expect(stats().getByText(e.timeStat)).toBeInTheDocument()
    expect(stats().getAllByText('—')).toHaveLength(1)
  })

  it('shows today’s plan with a check while the stepper is on its distance; a tap goes back to it', () => {
    const { props, rerender } = renderPanel({ distanceKm: 8 })
    expect(screen.getByText(e.todaysPlan)).toBeInTheDocument()
    expect(screen.getByText('Easy · 8 km + 6 strides')).toBeInTheDocument()
    expect(screen.getByTestId('route-plan-check')).toBeInTheDocument()
    expect(screen.getByTestId('route-plan')).toHaveAttribute('aria-pressed', 'true')

    rerender(<RouteGeneratorPanel {...props} distanceKm={9.5} />)
    expect(screen.queryByTestId('route-plan-check')).toBeNull()
    fireEvent.click(screen.getByTestId('route-plan'))
    expect(props.onDistanceChange).toHaveBeenCalledWith(8)
  })

  it('has no plan row when today has no plan', () => {
    renderPanel({ plan: null })
    expect(screen.queryByText(e.todaysPlan)).toBeNull()
  })

  it('steps the distance by 0.5 km, says it politely, and stops at its bounds', () => {
    const { props, rerender } = renderPanel({ distanceKm: 8 })
    const value = screen.getByTestId('route-distance')
    expect(value).toHaveTextContent('8.0 km')
    expect(value).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('group', { name: e.distance })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: e.longer }))
    expect(props.onDistanceChange).toHaveBeenLastCalledWith(8.5)
    fireEvent.click(screen.getByRole('button', { name: e.shorter }))
    expect(props.onDistanceChange).toHaveBeenLastCalledWith(7.5)

    rerender(<RouteGeneratorPanel {...props} distanceKm={ROUTE_KM_MIN} />)
    expect(screen.getByRole('button', { name: e.shorter })).toBeDisabled()
    expect(screen.getByRole('button', { name: e.longer })).toBeEnabled()
    rerender(<RouteGeneratorPanel {...props} distanceKm={ROUTE_KM_MAX} />)
    expect(screen.getByRole('button', { name: e.longer })).toBeDisabled()
  })

  it('opens the options in place: two switches, both on, each changing its own preference', () => {
    const { props } = renderPanel()
    const row = screen.getByRole('button', { name: `${e.options}: ${e.loop} · ${e.avoidBusyRoads} · ${e.newStreetsFirst}` })
    expect(row).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('switch')).toBeNull()
    fireEvent.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    const busy = screen.getByRole('switch', { name: e.avoidBusyRoads })
    const fresh = screen.getByRole('switch', { name: e.newStreetsFirst })
    expect(busy).toHaveAttribute('aria-checked', 'true')
    expect(fresh).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(busy)
    expect(props.onPrefsChange).toHaveBeenLastCalledWith({ avoidBusyRoads: false, newStreetsFirst: true })
    fireEvent.click(fresh)
    expect(props.onPrefsChange).toHaveBeenLastCalledWith({ avoidBusyRoads: true, newStreetsFirst: false })
  })

  it('lists only the options that are on', () => {
    renderPanel({ prefs: { avoidBusyRoads: false, newStreetsFirst: true } })
    expect(screen.getByText(`${e.loop} · ${e.newStreetsFirst}`)).toBeInTheDocument()
  })

  it('while generating: dashes, “Finding loops…”, and no button to press', () => {
    renderPanel({ status: 'generating', stats: null, routeKey: null })
    expect(screen.getByTestId('route-stats')).toHaveAttribute('aria-busy', 'true')
    expect(stats().getAllByText('—')).toHaveLength(4)
    expect(screen.getByText(e.generating)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: e.regenerate })).toBeDisabled()
    expect(screen.getByRole('button', { name: e.download })).toBeDisabled()
  })

  it('Regenerate asks for the next loop', () => {
    const { props } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: e.regenerate }))
    expect(props.onRegenerate).toHaveBeenCalledOnce()
  })

  it.each([
    ['notConfigured', e.errors.notConfigured, false],
    ['auth', e.errors.auth, false],
    ['dailyQuota', e.errors.dailyQuota, false],
    ['rateLimited', e.errors.rateLimited, true],
    ['providerLimit', e.errors.rateLimited, true],
    ['upstream', e.errors.upstream, true],
    ['noRoute', e.errors.noRoute, false],
  ] as const)('words a %s failure, with a retry only where trying again can help', (failure, message, retry) => {
    const { props } = renderPanel({ status: 'error', failure, stats: null, routeKey: null })
    expect(screen.getByRole('alert')).toHaveTextContent(message)
    expect(failureMessage(failure)).toBe(message)
    expect(screen.queryByTestId('route-stats')).toBeNull()
    expect(screen.getByRole('button', { name: e.download })).toBeDisabled()
    if (retry) {
      fireEvent.click(screen.getByRole('button', { name: e.retry }))
      expect(props.onRetry).toHaveBeenCalledOnce()
    } else {
      expect(screen.queryByRole('button', { name: e.retry })).toBeNull()
      // No loop from these seeds: Regenerate tries the next ones; the others can't be fixed here.
      expect(screen.getByRole('button', { name: e.regenerate })).toHaveProperty('disabled', failure !== 'noRoute')
    }
  })

  it('downloads the GPX, then reads “Saved” - still a download - with Share beside it where files can be shared', async () => {
    save.saveFileWithFallback.mockResolvedValue('downloaded')
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, canShare: vi.fn(() => true), share })
    const { props } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: e.download }))
    await waitFor(() => expect(screen.getByTestId('route-saved')).toBeInTheDocument())
    expect(save.saveFileWithFallback).toHaveBeenCalledWith(FILE)
    expect(props.gpxFile).toHaveBeenCalledOnce()
    expect(screen.getByTestId('route-saved')).toHaveTextContent(e.saved)
    expect(screen.queryByRole('button', { name: e.download })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: e.share }))
    await waitFor(() => expect(share).toHaveBeenCalledWith({ files: [FILE], title: FILE.name }))

    // Saved again: a second download of the same file.
    fireEvent.click(screen.getByTestId('route-saved'))
    await waitFor(() => expect(save.saveFileWithFallback).toHaveBeenCalledTimes(2))
  })

  it('has no Share where files can’t be shared, and stays unsaved when the share sheet is closed', async () => {
    vi.stubGlobal('navigator', { ...navigator, canShare: vi.fn(() => false) })
    save.saveFileWithFallback.mockResolvedValueOnce('cancelled')
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: e.download }))
    await act(async () => {})
    expect(screen.queryByTestId('route-saved')).toBeNull()

    save.saveFileWithFallback.mockResolvedValueOnce('downloaded')
    fireEvent.click(screen.getByRole('button', { name: e.download }))
    await waitFor(() => expect(screen.getByTestId('route-saved')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: e.share })).toBeNull()
  })

  it('is a new file to save once the loop changes', async () => {
    save.saveFileWithFallback.mockResolvedValue('downloaded')
    const { props, rerender } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: e.download }))
    await waitFor(() => expect(screen.getByTestId('route-saved')).toBeInTheDocument())
    rerender(<RouteGeneratorPanel {...props} routeKey="r2" />)
    expect(screen.queryByTestId('route-saved')).toBeNull()
    expect(screen.getByRole('button', { name: e.download })).toBeEnabled()
  })

  it('closes from its X, after the slide off', async () => {
    const { props } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: t.common.close }))
    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce())
  })
})
