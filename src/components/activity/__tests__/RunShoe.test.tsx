import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'

const { owner, readRunShoe, writeRunShoe } = vi.hoisted(() => ({
  owner: { isOwner: true },
  readRunShoe: vi.fn(),
  writeRunShoe: vi.fn(),
}))
vi.mock('@/lib/useOwnerAuth', () => ({ useOwnerAuth: () => owner }))
vi.mock('@/lib/shoeChoices', () => ({ readRunShoe, writeRunShoe }))

const { RunShoe } = await import('../RunShoe')

const ROAD = { gearId: 'road', name: 'Vomero Plus', dotColor: '#111' }
const TRAIL = { gearId: 'trail', name: 'Speedgoat', dotColor: '#222' }
const s = t.activity.shoe

describe('RunShoe', () => {
  beforeEach(() => {
    owner.isOwner = true
    readRunShoe.mockReset().mockResolvedValue(null)
    writeRunShoe.mockReset().mockResolvedValue(undefined)
  })

  it('lets the owner pick another shoe for the run, and says the mileage follows after the sync', async () => {
    render(<RunShoe activityId="42" shoe={ROAD} options={[ROAD, TRAIL]} garminUrl={null} />)

    await userEvent.click(screen.getByRole('button', { name: s.change(ROAD.name) }))
    expect(await screen.findByText(s.countsAfterSync)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: TRAIL.name }))

    expect(writeRunShoe).toHaveBeenCalledWith('42', 'trail')
    expect(await screen.findByText(s.saved)).toBeInTheDocument()
    expect(screen.getByTestId('run-shoe').textContent).toBe(TRAIL.name)
  })

  it('shows today’s pick from Firestore before the nightly copy has it, and can hand the run back to Garmin', async () => {
    readRunShoe.mockResolvedValue('trail')
    render(<RunShoe activityId="42" shoe={ROAD} options={[ROAD, TRAIL]} garminUrl={null} />)

    await waitFor(() => expect(screen.getByTestId('run-shoe').textContent).toBe(TRAIL.name))
    await userEvent.click(screen.getByTestId('run-shoe'))
    await userEvent.click(await screen.findByRole('button', { name: s.clearPick }))

    expect(writeRunShoe).toHaveBeenCalledWith('42', null)
    await waitFor(() => expect(screen.getByTestId('run-shoe').textContent).toBe(ROAD.name))
  })

  it('offers no picker to a visitor, who gets Garmin’s page for the run', () => {
    owner.isOwner = false
    render(<RunShoe activityId="42" shoe={ROAD} options={[ROAD, TRAIL]} garminUrl="https://connect.garmin.com/modern/activity/42" />)

    expect(screen.getByTestId('run-shoe').getAttribute('href')).toBe('https://connect.garmin.com/modern/activity/42')
    expect(readRunShoe).not.toHaveBeenCalled()
  })

  it('draws nothing for an athlete with no shoes and no Garmin page, owner included', () => {
    const { container } = render(<RunShoe activityId="local-1" shoe={null} options={[]} garminUrl={null} />)

    expect(container.querySelector('[data-testid="run-shoe"]')).toBeNull()
    expect(readRunShoe).not.toHaveBeenCalled()
  })
})
