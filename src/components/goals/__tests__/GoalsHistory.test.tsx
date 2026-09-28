import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GoalsHistory } from '@/components/goals/GoalsHistory'
import { t } from '@/i18n'

const h = t.goals.history

describe('GoalsHistory (v4.17)', () => {
  it('states each past season against its goal, with the outcome as a pill', () => {
    render(
      <GoalsHistory
        history={[
          {
            year: 2025,
            annualGoal: { targetKm: 1000, actualKm: 1116, achieved: true },
            targets: [
              { distance: '5K', targetSeconds: 1320, pbSeconds: 1242, achieved: true },
              { distance: '10K', targetSeconds: null, pbSeconds: 2650, achieved: null },
            ],
          },
          { year: 2024, annualGoal: { targetKm: 1200, actualKm: 900, achieved: false }, targets: [] },
        ]}
      />,
    )
    const [y2025, y2024] = screen.getAllByTestId('goals-history-year')
    expect(y2025!.textContent).toContain(`${h.annualKm('1,116', '1,000')} · ${h.targetsCount(1, 1)}`)
    expect(screen.getByText(h.achieved).dataset.tone).toBe('pos')
    expect(y2024!.textContent).toContain(h.missed)
    expect(screen.getByText(h.missed).dataset.tone).toBe('neg')
  })

  it('draws nothing without a past season', () => {
    const { container } = render(<GoalsHistory history={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
