import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'

vi.mock('../SeasonHeadline', () => ({ SeasonHeadline: () => <div data-testid="season-headline" /> }))
vi.mock('../FitnessGroup', () => ({ FitnessGroup: () => null }))
vi.mock('../PerformanceGroup', () => ({ PerformanceGroup: () => null }))
vi.mock('../VolumeGroup', () => ({ VolumeGroup: () => null }))
vi.mock('../HealthGroup', () => ({ HealthGroup: () => null }))

const { AnalyticsClient } = await import('../AnalyticsClient')

function renderAnalytics() {
  const props = {
    data: { years: [2026], byYear: { 2026: {} }, allTime: {}, weeklyTrends: [] },
    comparison: null,
    seasonHeadline: {},
    seasonInsight: null,
    tabInsights: {},
    vo2maxHistory: { points: [] },
    trainingLoad: null,
    loadRisk: null,
    loadBalance: null,
    statusHistory: null,
    racePredictions: null,
    threshold: null,
    vo2maxTopPercent: null,
    activeDays: 0,
    heatmapDays: 0,
    heatImpact: null,
    today: '2026-09-25',
  } as unknown as Parameters<typeof AnalyticsClient>[0]
  return render(<AnalyticsClient {...props} />)
}

describe('AnalyticsClient', () => {
  it('names its tabs in whole words', () => {
    renderAnalytics()

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      t.analytics.tabs.fitness,
      t.analytics.tabs.performance,
      t.analytics.tabs.volume,
      t.analytics.tabs.health,
    ])
  })

  // The same tall card topped all four tabs and pushed each first chart below
  // the fold.
  it('shows the season headline on the first tab only', () => {
    renderAnalytics()
    expect(screen.getByTestId('season-headline')).toBeInTheDocument()

    act(() => screen.getByRole('tab', { name: t.analytics.tabs.performance }).click())
    expect(screen.queryByTestId('season-headline')).not.toBeInTheDocument()
  })
})

describe('the French tab names', () => {
  // FR called the load tab "Forme", the word it uses for Form (TSB).
  it('keeps Forme for TSB alone', async () => {
    const { fr } = await import('@/i18n/fr')

    expect(Object.values(fr.analytics.tabs)).not.toContain('Forme')
    expect(fr.analytics.tabs).toMatchObject({ fitness: 'Charge', health: 'Intensité' })
  })
})
