import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'
import { RunEffortCard } from '../RunEffortCard'

const ZONES = [
  { zone: 1, seconds: 1270, percent: 42, minBpm: 100, maxBpm: 130 },
  { zone: 2, seconds: 1760, percent: 58, minBpm: 130, maxBpm: 150 },
  { zone: 3, seconds: 0, percent: 0, minBpm: 150, maxBpm: 165 },
]

describe('RunEffortCard', () => {
  it('holds the zone bar, the aerobic effect and the decoupling rows', () => {
    render(<RunEffortCard hrZones={ZONES} aer={3.1} ana={0} decoupling={{ percent: 3.1, drift: 'stable' } as never} />)

    const card = screen.getByTestId('run-effort')
    expect(card.textContent).toContain(`Z1 ${t.zoneLabels[1]} 42%`)
    expect(card.textContent).toContain(`Z2 ${t.zoneLabels[2]} 58%`)
    expect(screen.getByTestId('zone-stack').children).toHaveLength(2)
    expect(card.textContent).toContain('3.1')
    expect(card.textContent).toContain(t.activity.trainingEffect.levels.improving)
    expect(card.textContent).toContain(t.activity.decoupling.held)
    expect(card.textContent).not.toContain(t.activity.trainingEffect.anaerobic)
  })

  it('labels every zone it draws and drops those under 1%', () => {
    const zones = [
      { zone: 1, seconds: 100, percent: 60, minBpm: 100, maxBpm: 130 },
      { zone: 4, seconds: 100, percent: 38.6, minBpm: 165, maxBpm: 178 },
      { zone: 5, seconds: 10, percent: 1, minBpm: 178, maxBpm: 200 },
      { zone: 3, seconds: 1, percent: 0.4, minBpm: 150, maxBpm: 165 },
    ]
    render(<RunEffortCard hrZones={zones} aer={null} ana={null} decoupling={null} />)
    const text = screen.getByTestId('run-effort').textContent ?? ''
    for (const label of [`Z1 ${t.zoneLabels[1]} 60%`, `Z4 ${t.zoneLabels[4]} 39%`, `Z5 ${t.zoneLabels[5]} 1%`]) expect(text).toContain(label)
    expect(text).not.toContain('Z3')
    expect(screen.getByTestId('zone-stack').children).toHaveLength(3)
  })

  it('opens Charts from the decoupling value', async () => {
    const onShowCharts = vi.fn()
    render(<RunEffortCard hrZones={ZONES} aer={null} ana={null} decoupling={{ percent: 7.2, drift: 'drifting' } as never} onShowCharts={onShowCharts} />)

    expect(screen.getByTestId('run-effort').textContent).toContain(t.activity.decoupling.faded)
    await userEvent.click(screen.getByRole('button', { name: t.activity.decoupling.seeInCharts }))
    expect(onShowCharts).toHaveBeenCalled()
  })

  it('colours the effects and the decoupling by meaning', () => {
    render(<RunEffortCard hrZones={ZONES} aer={3.4} ana={0.1} decoupling={{ percent: 7.2, drift: 'drifting' } as never} />)

    expect(screen.getByText(t.activity.trainingEffect.levels.improving).className).toContain('--pos')
    expect(screen.getByText(t.activity.trainingEffect.levels.noBenefit).className).toContain('text-muted-foreground')
    expect(screen.getByText(t.activity.decoupling.faded).className).toContain('--warn')
  })

  it('draws nothing with nothing to show', () => {
    const { container } = render(<RunEffortCard hrZones={[]} aer={null} ana={null} decoupling={null} />)
    expect(container.innerHTML).toBe('')
  })
})
