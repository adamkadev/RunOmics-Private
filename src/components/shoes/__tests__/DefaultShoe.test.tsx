import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'

const { owner, readDefaultShoe, writeDefaultShoe } = vi.hoisted(() => ({
  owner: { isOwner: true },
  readDefaultShoe: vi.fn(),
  writeDefaultShoe: vi.fn(),
}))
vi.mock('@/lib/useOwnerAuth', () => ({ useOwnerAuth: () => owner }))
vi.mock('@/lib/shoeChoices', () => ({ readDefaultShoe, writeDefaultShoe }))

const { DefaultShoe } = await import('../DefaultShoe')

const OPTIONS = [{ gearId: 'road', name: 'Vomero Plus' }, { gearId: 'trail', name: 'Speedgoat' }]
const d = t.shoes.defaultShoe

describe('DefaultShoe', () => {
  beforeEach(() => {
    owner.isOwner = true
    readDefaultShoe.mockReset().mockResolvedValue('road')
    writeDefaultShoe.mockReset().mockResolvedValue(undefined)
  })

  it('lets the owner set the shoe gear-less runs count toward, and clear it', async () => {
    render(<DefaultShoe options={OPTIONS} initial={null} />)
    const select = screen.getByLabelText(d.label) as HTMLSelectElement
    await waitFor(() => expect(select.value).toBe('road'))

    await userEvent.selectOptions(select, 'trail')
    expect(writeDefaultShoe).toHaveBeenLastCalledWith('trail')
    expect(await screen.findByText(d.saved)).toBeInTheDocument()

    await userEvent.selectOptions(select, '')
    expect(writeDefaultShoe).toHaveBeenLastCalledWith(null)
  })

  it('puts the choice back when Firestore refuses it', async () => {
    writeDefaultShoe.mockRejectedValue(new Error('permission-denied'))
    render(<DefaultShoe options={OPTIONS} initial="road" />)
    const select = screen.getByLabelText(d.label) as HTMLSelectElement

    await userEvent.selectOptions(select, 'trail')
    await waitFor(() => expect(select.value).toBe('road'))
  })

  it('shows nothing to a visitor, or to an athlete with no shoes', () => {
    owner.isOwner = false
    const { container, rerender } = render(<DefaultShoe options={OPTIONS} initial="road" />)
    expect(container.firstChild).toBeNull()

    owner.isOwner = true
    rerender(<DefaultShoe options={[]} initial={null} />)
    expect(container.firstChild).toBeNull()
    expect(readDefaultShoe).not.toHaveBeenCalled()
  })
})
