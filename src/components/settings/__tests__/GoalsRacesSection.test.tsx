import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UpcomingRace } from '@/domain/goals/types'
import { t } from '@/i18n'

const { readGoalsRacesEntries, saveRace, removeRace, saveGoalYear } = vi.hoisted(() => ({
  readGoalsRacesEntries: vi.fn(),
  saveRace: vi.fn(),
  removeRace: vi.fn(),
  saveGoalYear: vi.fn(),
}))
vi.mock('@/lib/goalsRaces', () => ({ readGoalsRacesEntries, saveRace, removeRace, saveGoalYear }))

const { GoalsRacesSection } = await import('../GoalsRacesSection')

const s = t.settings.goalsRaces
const today = '2026-10-27'
const garminRace: UpcomingRace = { garminEventUuid: 'uuid-1', date: '2026-11-29', name: 'Harbor Lights 10K', distance: '10K', isPrimaryEvent: true, targetSeconds: 2_700 }

function renderSection(syncedRaces: UpcomingRace[] = [], onSaved = vi.fn()) {
  render(<GoalsRacesSection syncedRaces={syncedRaces} writtenGoals={[]} today={today} onSaved={onSaved} />)
  return onSaved
}

beforeEach(() => {
  readGoalsRacesEntries.mockReset().mockResolvedValue({ races: [], goals: [] })
  saveRace.mockReset().mockResolvedValue(undefined)
  removeRace.mockReset().mockResolvedValue(undefined)
  saveGoalYear.mockReset().mockResolvedValue(undefined)
})

describe('GoalsRacesSection', () => {
  it('says there is no race ahead and offers this season and the next with no goal', async () => {
    renderSection()
    expect(await screen.findByTestId('races-empty')).toHaveTextContent(s.noRace)
    expect(screen.getByTestId('goal-row-2026')).toHaveTextContent(s.noGoal)
    expect(screen.getByTestId('goal-row-2027')).toHaveTextContent(s.noGoal)
  })

  it('adds a race and saves only once every field is valid', async () => {
    const user = userEvent.setup()
    const onSaved = renderSection()
    await user.click(await screen.findByTestId('race-add'))
    const sheet = screen.getByTestId('race-sheet')

    await user.click(within(sheet).getByRole('button', { name: t.settings.actions.save }))
    expect(within(sheet).getAllByTestId('field-error').map((error) => error.textContent)).toEqual([
      s.errors.nameRequired,
      s.errors.dateInvalid,
      s.errors.distanceRange,
      s.errors.timeInvalid,
    ])
    expect(saveRace).not.toHaveBeenCalled()

    await user.type(within(sheet).getByTestId('race-name'), 'Autumn Trail Half')
    await user.type(within(sheet).getByTestId('race-date'), '2027-05-29')
    await user.click(within(sheet).getByRole('button', { name: t.records.distances.half }))
    await user.type(within(sheet).getByTestId('race-time'), '1:35:00')
    await user.click(within(sheet).getByRole('button', { name: s.priorityName('A') }))
    await user.click(within(sheet).getByRole('button', { name: t.settings.actions.save }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(s.added, true))
    expect(saveRace).toHaveBeenCalledWith({ name: 'Autumn Trail Half', date: '2027-05-29', distanceKm: 21.0975, priority: 'A', targetSeconds: 5_700 }, {})
  })

  it('refuses a new race dated in the past', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.click(await screen.findByTestId('race-add'))
    const sheet = screen.getByTestId('race-sheet')
    await user.type(within(sheet).getByTestId('race-name'), 'Cross')
    await user.type(within(sheet).getByTestId('race-date'), '2026-10-01')
    await user.click(within(sheet).getByRole('button', { name: t.records.distances['5k'] }))
    await user.click(within(sheet).getByTestId('race-just-finish'))
    await user.click(within(sheet).getByRole('button', { name: t.settings.actions.save }))
    expect(within(sheet).getByTestId('field-error')).toHaveTextContent(s.errors.datePast)
    expect(saveRace).not.toHaveBeenCalled()
  })

  it('edits a Garmin race under its Garmin key, and hides it rather than deleting it', async () => {
    const user = userEvent.setup()
    renderSection([garminRace])
    const row = await screen.findByTestId('race-row')
    expect(row).toHaveTextContent('Harbor Lights 10K')
    expect(row).toHaveTextContent('45:00')

    await user.click(row)
    const sheet = screen.getByTestId('race-sheet')
    await user.click(within(sheet).getByTestId('race-just-finish'))
    await user.click(within(sheet).getByRole('button', { name: t.settings.actions.save }))
    await waitFor(() => expect(saveRace).toHaveBeenCalledWith(
      { name: 'Harbor Lights 10K', date: '2026-11-29', distanceKm: 10, priority: 'A' },
      { garminKey: 'uuid-1' },
    ))

    await user.click(await screen.findByTestId('race-row'))
    await user.click(screen.getByTestId('race-remove'))
    expect(removeRace).not.toHaveBeenCalled()
    await user.click(screen.getByTestId('race-remove'))
    await waitFor(() => expect(removeRace).toHaveBeenCalledWith({ garminKey: 'uuid-1' }))
  })

  it('shows the app’s edit of a race over Garmin’s', async () => {
    readGoalsRacesEntries.mockResolvedValue({
      races: [{ id: 'garmin-uuid-1', garminKey: 'uuid-1', name: 'Harbor by Night', date: '2026-11-29', distanceKm: 10, priority: 'B' }],
      goals: [],
    })
    renderSection([garminRace])
    const row = await screen.findByTestId('race-row')
    expect(row).toHaveTextContent('Harbor by Night')
    expect(row).toHaveTextContent(s.justFinish)
  })

  it('sets a season’s distance and a target time', async () => {
    const user = userEvent.setup()
    const onSaved = renderSection()
    await user.click(await screen.findByTestId('goal-row-2027'))
    const sheet = screen.getByTestId('goal-sheet')
    await user.type(within(sheet).getByTestId('goal-annual-km'), '1500')
    await user.click(within(within(sheet).getByRole('group', { name: t.records.distances['10k'] })).getByRole('button', { name: s.targetKind.time }))
    await user.type(within(sheet).getByTestId('goal-time-10k'), '44:30')
    await user.click(within(sheet).getByRole('button', { name: t.settings.actions.save }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(s.saved, true))
    expect(saveGoalYear).toHaveBeenCalledWith({ year: 2027, annualDistanceKm: 1_500, targets: { '10k': 2_670 } })
  })

  it('says so and offers a retry when Firestore cannot be read', async () => {
    const user = userEvent.setup()
    readGoalsRacesEntries.mockRejectedValueOnce(new Error('offline'))
    renderSection()
    expect(await screen.findByTestId('goals-races-error')).toHaveTextContent(s.loadFailed)
    await user.click(screen.getByRole('button', { name: s.retry }))
    expect(await screen.findByTestId('races-empty')).toBeInTheDocument()
  })
})
