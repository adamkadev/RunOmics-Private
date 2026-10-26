import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { t } from '@/i18n'
import { CheckInCard } from '../CheckInCard'

const auth = vi.hoisted(() => ({ isOwner: true }))
const store = vi.hoisted(() => ({ readCheckInDay: vi.fn(), writeCheckInDay: vi.fn(), readCheckInsSince: vi.fn() }))

vi.mock('@/lib/firebaseConfig', () => ({ isClientFirebaseConfigured: true }))
vi.mock('@/lib/useOwnerAuth', () => ({ useOwnerAuth: () => ({ user: null, isOwner: auth.isOwner, loading: false }) }))
vi.mock('@/lib/useToday', () => ({ useToday: (serverToday: string) => serverToday }))
vi.mock('@/lib/wellness', () => store)

const c = t.wellness.checkIn
const score = (field: keyof typeof c.scores, value: number) =>
  within(screen.getByTestId(`checkin-${field}`)).getByRole('button', { name: c.scoreButton(c.scores[field].label, value, c.scores[field].words[value - 1]!) })

describe('CheckInCard', () => {
  beforeEach(() => {
    auth.isOwner = true
    store.readCheckInDay.mockReset().mockResolvedValue(null)
    store.writeCheckInDay.mockReset().mockResolvedValue(undefined)
    window.localStorage.clear()
  })

  it('shows nothing, and reads nothing, for anyone but the owner', async () => {
    auth.isOwner = false
    const { container } = render(<CheckInCard today="2026-10-20" />)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(container).toBeEmptyDOMElement()
    expect(store.readCheckInDay).not.toHaveBeenCalled()
  })

  it('saves the whole day with each tap, holds a niggle until it has a site and a pain, and folds once done', async () => {
    const user = userEvent.setup()
    render(<CheckInCard today="2026-10-21" />)
    await screen.findByTestId('checkin-card')

    await user.click(score('sleep', 4))
    await user.click(score('soreness', 2))
    await user.click(score('stress', 3))
    await user.click(score('mood', 5))
    expect(store.writeCheckInDay).toHaveBeenLastCalledWith('2026-10-21', { sleep: 4, soreness: 2, stress: 3, mood: 5 })

    await user.click(screen.getByTestId('checkin-flag-niggle'))
    const niggle = screen.getByTestId('checkin-niggle')
    await user.click(within(niggle).getByRole('button', { name: t.wellness.sites.calf }))
    expect(store.writeCheckInDay).toHaveBeenCalledTimes(4)
    await user.click(within(niggle).getByRole('button', { name: c.painButton(5) }))
    expect(store.writeCheckInDay).toHaveBeenLastCalledWith('2026-10-21', { sleep: 4, soreness: 2, stress: 3, mood: 5, niggle: { site: 'calf', pain: 5 } })

    await user.click(screen.getByTestId('checkin-done'))
    expect(screen.getByTestId('checkin-summary')).toHaveTextContent(`${t.wellness.niggleName('calf', null)} 5/10`)
  })

  it('opens a morning already answered folded, and hides for the day when put away', async () => {
    const user = userEvent.setup()
    store.readCheckInDay.mockResolvedValue({ sleep: 3, soreness: 3, stress: 3, mood: 3, ill: true })
    render(<CheckInCard today="2026-10-22" />)

    const summary = await screen.findByTestId('checkin-summary')
    expect(summary).toHaveTextContent(c.flags.ill)
    await user.click(within(summary).getByTestId('checkin-hide'))
    await waitFor(() => expect(screen.queryByTestId('checkin-summary')).toBeNull())
    expect(window.localStorage.getItem('ro-checkin-hidden:2026-10-22')).toBe('1')
  })

  it('sits above what it wraps until answered, then folds below it, and edits there', async () => {
    const user = userEvent.setup()
    render(
      <CheckInCard today="2026-10-23">
        <div data-testid="this-week" />
      </CheckInCard>,
    )
    const form = await screen.findByTestId('checkin-card')
    const week = screen.getByTestId('this-week')
    const after = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    expect(after(form, week)).toBe(true)

    for (const field of ['sleep', 'soreness', 'stress', 'mood'] as const) await user.click(score(field, 3))
    expect(after(screen.getByTestId('checkin-card'), week)).toBe(true)
    await user.click(screen.getByTestId('checkin-done'))
    expect(after(week, screen.getByTestId('checkin-summary'))).toBe(true)

    await user.click(screen.getByTestId('checkin-edit'))
    await user.click(score('mood', 4))
    expect(after(week, screen.getByTestId('checkin-card'))).toBe(true)
  })

  it('keeps what it wraps for anyone but the owner', async () => {
    auth.isOwner = false
    render(
      <CheckInCard today="2026-10-20">
        <div data-testid="this-week" />
      </CheckInCard>,
    )
    expect(screen.getByTestId('this-week')).toBeInTheDocument()
  })
})
