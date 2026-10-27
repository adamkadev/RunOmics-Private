import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RouteGeneratorPanel, type RouteGeneratorPanelProps } from '../RouteGeneratorPanel'
import type { AvoidSpot } from '@/domain/explore/avoidSpots'
import type { AvoidSpots } from '../useAvoidSpots'

const avoidSpots = (marking: boolean, setMarking: (on: boolean) => void = () => {}, more: Partial<AvoidSpots> = {}): AvoidSpots => ({
  enabled: true,
  spots: [],
  marking,
  setMarking,
  mark: () => {},
  remove: () => {},
  setReason: () => {},
  setRadius: () => {},
  selectedId: null,
  located: null,
  locate: () => {},
  full: false,
  failed: false,
  ...more,
})

const SPOT: AvoidSpot = { id: 's1', lon: -150, lat: 0, radiusM: 80, createdAt: '2026-10-26', reason: 'mud', expiresOn: '2026-11-16' }

const openOptions = () => fireEvent.click(screen.getByRole('button', { name: /^Route options/ }))

const props = (avoid: AvoidSpots): RouteGeneratorPanelProps => ({
  unitName: 'Bravo',
  distanceKm: 8.5,
  onDistanceChange: () => {},
  plan: null,
  start: { mode: 'pick', waiting: false },
  onStartModeChange: () => {},
  day: { session: null, beforeQuality: false },
  darkness: null,
  avoid,
  prefs: { avoidBusyRoads: true, newStreetsFirst: true, flatForReps: false },
  onPrefsChange: () => {},
  status: 'generating',
  failure: null,
  minKm: null,
  stats: null,
  paceSecPerKm: null,
  routeKey: null,
  gpxFile: () => null,
  onRegenerate: () => {},
  onRetry: () => {},
  onClose: () => {},
})

describe('RouteGeneratorPanel', () => {
  it('shrinks to the prompt and Cancel while a spot is being marked, leaving the map free to tap', () => {
    const { rerender } = render(<RouteGeneratorPanel {...props(avoidSpots(false))} />)
    rerender(<RouteGeneratorPanel {...props(avoidSpots(true))} />)
    expect(screen.getByTestId('route-avoid-marking')).toHaveTextContent('Tap the map where loops must not go.')
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(cancel).toHaveFocus()
    expect(cancel).toHaveAccessibleDescription('Tap the map where loops must not go.')
    expect(screen.queryByRole('button', { name: 'Download GPX' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })

  it('ends the marking on Cancel', () => {
    const setMarking = vi.fn()
    render(<RouteGeneratorPanel {...props(avoidSpots(true, setMarking))} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(setMarking).toHaveBeenCalledWith(false)
  })

  it('comes back whole after the tap, options still open and the focus on Mark a spot', () => {
    const setMarking = vi.fn()
    const { rerender } = render(<RouteGeneratorPanel {...props(avoidSpots(false, setMarking))} />)
    fireEvent.click(screen.getByRole('button', { name: /^Route options/ }))
    fireEvent.click(screen.getByTestId('route-avoid-mark'))
    expect(setMarking).toHaveBeenCalledWith(true)

    rerender(<RouteGeneratorPanel {...props(avoidSpots(true, setMarking))} />)
    expect(screen.queryByRole('button', { name: 'Mark a spot' })).toBeNull()

    rerender(<RouteGeneratorPanel {...props(avoidSpots(false, setMarking))} />)
    expect(screen.queryByTestId('route-avoid-marking')).toBeNull()
    expect(screen.getByRole('button', { name: 'Download GPX' })).toBeVisible()
    expect(screen.getByTestId('route-avoid-mark')).toHaveFocus()
  })

  it('turns Mark a spot off at the cap and says why', () => {
    render(<RouteGeneratorPanel {...props(avoidSpots(false, undefined, { full: true }))} />)
    openOptions()
    expect(screen.getByTestId('route-avoid-mark')).toBeDisabled()
    expect(screen.getByTestId('route-avoid-mark')).toHaveAccessibleDescription('100 spots is the most. Remove one to mark another.')
  })

  it('names how long a spot lasts and flies to it on a tap of its row', () => {
    const locate = vi.fn()
    render(<RouteGeneratorPanel {...props(avoidSpots(false, undefined, { spots: [SPOT], locate }))} />)
    openOptions()
    const row = screen.getByRole('button', { name: /^Show the spot marked/ })
    expect(row).toHaveTextContent(/^Marked .+ · until .+$/)
    fireEvent.click(row)
    expect(locate).toHaveBeenCalledWith('s1')
    expect(screen.queryByTestId('route-avoid-radius')).toBeNull()
  })

  it('offers the three sizes on the spot shown, its own pressed', () => {
    const setRadius = vi.fn()
    render(<RouteGeneratorPanel {...props(avoidSpots(false, undefined, { spots: [SPOT], selectedId: 's1', setRadius }))} />)
    openOptions()
    const sizes = within(screen.getByTestId('route-avoid-radius')).getAllByRole('button')
    expect(sizes.map((b) => b.textContent)).toEqual(['40 m', '80 m', '150 m'])
    expect(sizes.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])
    fireEvent.click(sizes[2]!)
    expect(setRadius).toHaveBeenCalledWith('s1', 150)
  })
})
