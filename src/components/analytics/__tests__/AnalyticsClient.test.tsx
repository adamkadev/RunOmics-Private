import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import { addDays, isoDate } from '@/lib/calendarDate'
import { t } from '@/i18n'
import { AnalyticsClient, type AnalyticsBoardData } from '../AnalyticsClient'

const TODAY = '2026-09-26'
const day = (i: number) => isoDate(addDays(new Date(`${TODAY}T00:00:00`), -i))

function week(date: string, i: number): WeeklyTrendPoint {
  return {
    date,
    label: date,
    distanceKm: 40 + (i % 3),
    sessionCount: 5,
    easyPace: 360 - i,
    hardPace: 290,
    ef: 1.1,
    efAdjusted: 1.12,
    apparentTempC: null,
    easyAvgHr: null,
    hardAvgHr: null,
    cadenceSpm: null,
    groundContactMs: null,
    verticalOscillationMm: null,
    verticalRatioPct: null,
    strideLengthM: null,
    avgRpe: 3.5,
    aer: null,
    ana: null,
    zoneSeconds: { 1: 1800, 2: 3 * 3600, 3: 600, 4: 1500, 5: 300 },
    longestKm: 16,
    longestDate: date,
    durationSeconds: 4 * 3600,
    thresholdSessions: 1,
    intervalSessions: i % 2,
  }
}

const weeks = Array.from({ length: 60 }, (_, i) => week(isoDate(addDays(new Date('2026-09-21T00:00:00'), -(59 - i) * 7)), i))

const data: AnalyticsBoardData = {
  load: Array.from({ length: 120 }, (_, i) => ({ date: day(119 - i), ctl: 40 + i * 0.03, atl: 45 })),
  status: Array.from({ length: 60 }, (_, i) => ({ date: day(59 - i), status: 'productive' as const })),
  risk: { acwr: 1.13, acute: 412, chronic: 365, acwrZone: 'safe', acwrSource: 'garmin', monotony: 1.5, monotonyZone: 'safe', strain: null, strainZone: null, rampRate: 2.4, rampRateZone: 'safe', daysOfHistory: 400 },
  headline: { title: 'Fitter than early season.', bullets: [{ tone: 'positive', text: 'Easy pace 5:52, faster.' }] },
  insight: null,
  weeks,
  plan: weeks.slice(-12).map((w) => ({ week: w.date, planKm: 44, planQuality: 2 })),
  vo2max: { value: 55, samples: [{ date: day(80), vo2max: 56 }, { date: day(2), vo2max: 55 }] },
  threshold: [{ date: day(300), pace: 254 }, { date: day(10), pace: 263 }],
  predictions: Array.from({ length: 200 }, (_, i) => ({ date: day(199 - i), seconds: { '5k': 1150 + i * 0.4, '10k': 2440 + i } })),
  race: { distance: '10k', date: '2026-11-29', daysUntil: 64, targetSeconds: 2400 },
  heat: null,
  ytd: {
    year: 2026,
    daysInYear: 365,
    todayDay: 269,
    current: [{ day: 0, km: 0 }, { day: 269, km: 1394 }],
    previous: [{ day: 0, km: 0 }, { day: 365, km: 1116 }],
    previousToDate: 640,
    goalKm: 2000,
    projection: { weeklyRate: 26, weeklyNeeded: 44, projectedYearKm: 1757 },
  },
}

async function renderBoard() {
  render(<AnalyticsClient data={data} today={TODAY} />)
  await screen.findByTestId('form-card')
}

async function openTab(name: string, card: string) {
  await act(async () => screen.getByRole('tab', { name }).click())
  await screen.findByTestId(card)
}

describe('Analytics (v4.5)', () => {
  it('names its tabs in whole words', async () => {
    await renderBoard()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      t.analytics.tabs.fitness,
      t.analytics.tabs.performance,
      t.analytics.tabs.volume,
      t.analytics.tabs.health,
    ])
  })

  it('has one period control per tab: 4w/6m/1y on Load and Performance, 4w/12w/1y on Volume and Intensity', async () => {
    await renderBoard()
    const periods = () => within(screen.getByRole('radiogroup')).getAllByRole('radio').map((r) => r.textContent)
    expect(screen.getAllByRole('radiogroup')).toHaveLength(1)
    expect(periods()).toEqual(['4w', '6m', '1y'])
    await openTab(t.analytics.tabs.performance, 'predictions-card')
    expect(periods()).toEqual(['4w', '6m', '1y'])
    expect(screen.getByRole('radio', { checked: true }).textContent).toBe('6m')
    await openTab(t.analytics.tabs.volume, 'weekly-card')
    expect(periods()).toEqual(['4w', '12w', '1y'])
    expect(screen.getByTestId('analytics-range').textContent).toMatch(/^12 weeks · /)
    await openTab(t.analytics.tabs.health, 'easy-hard-card')
    expect(screen.getAllByRole('radiogroup')).toHaveLength(1)
  })

  it('shows the coach read on Load only, one sentence with its signals behind a tap', async () => {
    await renderBoard()
    const coach = screen.getByTestId('coach-read')
    expect(coach.textContent).toContain('Fitter than early season.')
    fireEvent.click(coach)
    expect(screen.getByRole('dialog').textContent).toContain('Easy pace 5:52, faster.')
    fireEvent.keyDown(document, { key: 'Escape' })
    await openTab(t.analytics.tabs.performance, 'predictions-card')
    expect(screen.queryByTestId('coach-read')).toBeNull()
  })

  it('widens every Load card with the period, and resets the range', async () => {
    await renderBoard()
    expect(screen.getByTestId('status-strip').children).toHaveLength(28)
    fireEvent.click(screen.getByRole('radio', { name: '6m' }))
    expect(screen.getByTestId('status-strip').children.length).toBeLessThanOrEqual(10)
    expect(screen.getByTestId('analytics-range').textContent).not.toBe('')
  })

  it('opens a card explanation from its title, with no (i) icons', async () => {
    await renderBoard()
    fireEvent.click(screen.getByRole('button', { name: t.analytics.cards.form.title }))
    expect(screen.getByRole('dialog').textContent).toContain(t.analytics.cards.form.about)
    expect(document.querySelector('[aria-label="' + t.analytics.aboutChart + '"]')).toBeNull()
  })

  it('reads the injury risk against its ranges, and shows the load ratio formula on tap', async () => {
    await renderBoard()
    const card = screen.getByTestId('risk-card')
    expect(card.textContent).toContain(t.analytics.cards.risk.inRange(3, 3))
    fireEvent.click(within(card).getByRole('button', { name: /Load ratio/ }))
    expect(card.textContent).toContain(t.analytics.cards.risk.loadRatioFormula(412, 365))
  })

  it("names the goal race under the predictions, and measures its gap to target", async () => {
    await renderBoard()
    await openTab(t.analytics.tabs.performance, 'predictions-card')
    const card = screen.getByTestId('predictions-card')
    expect(card.textContent).toContain('10K target: ')
    expect(card.textContent).toMatch(/D-\u2060?64/)
    expect(card.textContent).not.toMatch(/\d\.\d{3}/)
    expect(screen.getByTestId('predictions-sentence').textContent).toContain('off your 40:00 target')
    // VO2max as Progress prints it.
    expect(screen.getByTestId('performance-summary').textContent).toContain('55.0')
    expect(screen.getByTestId('performance-summary').textContent).toContain('−1 in 90 d')
  })

  it('ticks the plan on each week and outlines the current one', async () => {
    await renderBoard()
    await openTab(t.analytics.tabs.volume, 'weekly-card')
    expect(screen.getByTestId('weekly-bars').children).toHaveLength(12)
    expect(screen.getAllByTestId('plan-tick')).toHaveLength(12)
    expect(document.querySelectorAll('[data-current]')).toHaveLength(1)
    expect(screen.getByTestId('ytd-footer').textContent).toContain('243 km short')
  })

  it('links the zone ranges instead of repeating the zone table', async () => {
    await renderBoard()
    await openTab(t.analytics.tabs.health, 'zones-card')
    expect(screen.getByTestId('zone-ranges-link').getAttribute('href')).toBe('/athlete')
  })
})

describe('the v4.5 colour rules', () => {
  const dir = path.join(__dirname, '..')
  const sources = readdirSync(dir)
    .filter((f) => /\.(tsx|ts)$/.test(f) && f !== 'MonthlyVolumeChart.tsx')
    .map((f) => [f, readFileSync(path.join(dir, f), 'utf8')] as const)

  it('has no purple or rainbow series in the analytics components', () => {
    for (const [file, src] of sources) {
      expect(src, file).not.toMatch(/violet|purple|#7c3aed|CHART_COLORS|status-peaking/i)
    }
  })

  it('gives no card its own period pills or date arrows', () => {
    for (const [file, src] of sources) {
      expect(src, file).not.toMatch(/ChartWindowNav|PeriodNav|ChevronLeft/)
    }
  })
})

describe('the French tab names', () => {
  // FR called the load tab "Forme", the word it uses for Form (TSB).
  it('names the load tab Charge', async () => {
    const { fr } = await import('@/i18n/fr')
    expect(fr.analytics.tabs).toEqual({ fitness: 'Charge', performance: 'Performance', volume: 'Volume', health: 'Intensité' })
    expect(fr.analytics.cards.risk.title).toBe('Risque de blessure')
    expect(fr.analytics.cards.risk.loadRatio).toBe('Ratio de charge')
    expect(fr.analytics.cards.heatCost.title).toBe('Coût de la chaleur')
  })
})
