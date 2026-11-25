import { fireEvent, render, screen, within } from '@testing-library/react'
import { t } from '@/i18n'
import { describe, expect, it, vi } from 'vitest'
import { RouteGeneratorPanel, type RouteGeneratorPanelProps } from '../RouteGeneratorPanel'

const props = (): RouteGeneratorPanelProps => ({
  title: 'Run from Rue de la Paix',
  distanceKm: 8.5,
  onDistanceChange: () => {},
  plan: null,
  start: { waiting: false },
  day: { session: null, beforeQuality: false },
  darkness: null,
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
  it('opens on the tap-to-start prompt, its Generate and GPX buttons off until there is a start and a route', () => {
    const base = props()
    render(<RouteGeneratorPanel {...base} start={{ ...base.start, waiting: true }} />)
    expect(screen.getByTestId('route-pick-prompt')).toHaveTextContent(t.pages.map.explore.start.pickPrompt)
    expect(screen.getByRole('button', { name: 'Download GPX' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Generate 8.5 km loop' })).toBeDisabled()
  })

  it('names the loop’s quartier, the suggested one marked, and switches on a pick', () => {
    const onDistrictChange = vi.fn()
    const districts = [
      { id: 'test-c', name: 'Charlie', pct: 0, auto: true },
      { id: 'test-a', name: 'Alpha', pct: 40, auto: false },
    ]
    render(<RouteGeneratorPanel {...props()} districts={districts} districtId="test-c" onDistrictChange={onDistrictChange} />)
    const picker = screen.getByRole('combobox', { name: t.pages.map.explore.district })
    expect(picker).toHaveValue('test-c')
    expect(within(picker).getAllByRole('option').map((o) => o.textContent)).toEqual(['Charlie · 0% · suggested', 'Alpha · 40%'])
    fireEvent.change(picker, { target: { value: 'test-a' } })
    expect(onDistrictChange).toHaveBeenCalledWith('test-a')
  })

  it('shows no quartier row before the choices are in', () => {
    render(<RouteGeneratorPanel {...props()} onDistrictChange={() => {}} />)
    expect(screen.queryByTestId('route-district')).toBeNull()
  })

  it('says where the loop starts, and how the next day bounds its climb', () => {
    const base = props()
    render(
      <RouteGeneratorPanel
        {...base}
        startLine="0.9 km from home · tap the map to move the start"
        day={{ session: 'easy', beforeQuality: true }}
        nextKind="Threshold"
      />,
    )
    expect(screen.getByTestId('route-start-line')).toHaveTextContent('0.9 km from home · tap the map to move the start')
    expect(screen.getByTestId('route-notes')).toHaveTextContent('Threshold tomorrow, so climb stays under 12 m/km.')
    expect(screen.getByTestId('route-footnote')).toHaveTextContent(t.pages.map.explore.generating)
  })

  it('switches Avoid busy roads alone, keeping the other preferences', () => {
    const onPrefsChange = vi.fn()
    render(<RouteGeneratorPanel {...props()} prefs={{ avoidBusyRoads: true, newStreetsFirst: true, flatForReps: true }} onPrefsChange={onPrefsChange} />)
    expect(screen.queryByRole('button', { name: /^Route options/ })).toBeNull()
    expect(screen.queryByText('Flat for the reps')).toBeNull()
    expect(screen.queryByText('New streets first')).toBeNull()
    fireEvent.click(screen.getByRole('switch', { name: 'Avoid busy roads' }))
    expect(onPrefsChange).toHaveBeenCalledWith({ avoidBusyRoads: false, newStreetsFirst: true, flatForReps: true })
  })

})
