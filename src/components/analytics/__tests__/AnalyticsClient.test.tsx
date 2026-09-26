import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
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
  weeks,
  plan: weeks.slice(-12).map((w) => ({ week: w.date, planKm: 44, planQuality: 2 })),
  vo2max: { value: 55, samples: [{ date: day(80), vo2max: 56 }, { date: day(2), vo2max: 55 }] },
  threshold: [{ date: day(300), pace: 254 }, { date: day(10), pace: 263 }],
  predictions: Array.from({ length: 200 }, (_, i) => ({ date: day(199 - i), seconds: { '5k': 1150 + i * 0.4, '10k': 2440 + i } })),
  race: { distance: '10k', date: '2026-11-29', daysUntil: 64, targetSeconds: 2400 },
  heat: {
    refHeartRate: 149,
    bands: [
      { id: 'cold', label: '', runCount: 9, avgApparentTempC: 2, paceAtRefHr: 372, costSecPerKm: 13 },
      { id: 'cool', label: '', runCount: 40, avgApparentTempC: 10, paceAtRefHr: 359, costSecPerKm: 0 },
      { id: 'warm', label: '', runCount: 12, avgApparentTempC: 22, paceAtRefHr: 376, costSecPerKm: 17 },
    ],
  },
  weeklyAvgKm: 26.4,
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

  // v4.6: one set of periods on every tab; Performance defaults to 12w.
  it('has one period control per tab, 4w/12w/1y on all four', async () => {
    await renderBoard()
    const periods = () => within(screen.getByRole('radiogroup')).getAllByRole('radio').map((r) => r.textContent)
    expect(screen.getAllByRole('radiogroup')).toHaveLength(1)
    expect(periods()).toEqual(['4w', '12w', '1y'])
    expect(screen.getByRole('radio', { checked: true }).textContent).toBe('4w')
    await openTab(t.analytics.tabs.performance, 'predictions-card')
    expect(periods()).toEqual(['4w', '12w', '1y'])
    expect(screen.getByRole('radio', { checked: true }).textContent).toBe('12w')
    expect(screen.getByTestId('predictions-card').textContent).toContain('change in 12 wk')
    await openTab(t.analytics.tabs.volume, 'weekly-card')
    expect(periods()).toEqual(['4w', '12w', '1y'])
    // One range line on every tab: first Monday to today, no "12 weeks ·".
    expect(screen.getByTestId('analytics-range').textContent).toMatch(/^Jul 6 – Sep 26$/)
    await openTab(t.analytics.tabs.health, 'easy-hard-card')
    expect(screen.getAllByRole('radiogroup')).toHaveLength(1)
  })

  it('shows the coach read on Load only, one sentence with its signals behind a tap', async () => {
    await renderBoard()
    const coach = screen.getByTestId('coach-read')
    const s = t.analytics.cards.coachRead
    // Easy pace got faster but the predictions got slower: neither praise nor alarm.
    expect(coach.getAttribute('data-tone')).toBe('neutral')
    expect(coach.textContent).toContain(s.headline.neutral)
    fireEvent.click(coach)
    const sheet = screen.getByRole('dialog')
    expect(sheet.textContent).toContain(s.predictionsSlower(2, 2))
    expect(sheet.textContent).toContain(s.volume('+754'))
    expect(sheet.querySelector('[data-trend="declining"] svg')!.getAttribute('style')).toContain('var(--tone-caution)')
    expect(sheet.innerHTML).not.toContain('var(--accent')
    fireEvent.keyDown(document, { key: 'Escape' })
    await openTab(t.analytics.tabs.performance, 'predictions-card')
    expect(screen.queryByTestId('coach-read')).toBeNull()
  })

  it('widens every Load card with the period, and resets the range', async () => {
    await renderBoard()
    expect(screen.getByTestId('status-strip').children).toHaveLength(27)
    fireEvent.click(screen.getByRole('radio', { name: '12w' }))
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
    expect(screen.getByTestId('performance-summary').textContent).toContain('−1 in 12 wk')
    // v4.7: slower is amber, faster --good, by the same helper everywhere.
    for (const delta of screen.getAllByTestId('prediction-delta')) expect(delta.getAttribute('style')).toContain('var(--tone-caution)')
    // VO2max fell by 1 in 12 weeks: amber on the delta, the value stays ink.
    const [vo2] = screen.getAllByTestId('summary-delta')
    expect(vo2!.firstElementChild!.getAttribute('style')).toContain('var(--tone-caution)')
    expect(screen.getByTestId('performance-summary').innerHTML).not.toContain('var(--accent')
  })

  it('draws the prediction sparklines faster up', async () => {
    await renderBoard()
    await openTab(t.analytics.tabs.performance, 'predictions-card')
    // The 5K got slower over the window, so its line ends lower (a larger y).
    const d = screen.getByTestId('prediction-5k').querySelector('path')!.getAttribute('d')!
    const ys = [...d.matchAll(/[ML][\d.]+,([\d.]+)/g)].map((m) => Number(m[1]))
    expect(ys.at(-1)!).toBeGreaterThan(ys[0]!)
  })

  it('draws heat bars in the comparison grey with the best band in ink, and no accent', async () => {
    await renderBoard()
    await openTab(t.analytics.tabs.performance, 'heat-card')
    const bar = (id: string) => screen.getByTestId(`heat-${id}`).querySelector<HTMLElement>('.absolute')!
    expect(bar('cold').style.background).toBe('var(--series-2)')
    expect(bar('warm').style.background).toBe('var(--series-2)')
    expect(bar('cool').style.background).toBe('var(--foreground)')
    expect(screen.getByTestId('heat-card').innerHTML).not.toContain('var(--accent)')
  })

  it('ticks the plan on each week and outlines the current one', async () => {
    await renderBoard()
    await openTab(t.analytics.tabs.volume, 'weekly-card')
    expect(screen.getByTestId('weekly-bars').children).toHaveLength(12)
    expect(screen.getAllByTestId('plan-tick')).toHaveLength(12)
    expect(screen.getByTestId('weekly-bars').querySelectorAll('[data-current]')).toHaveLength(1)
    expect(screen.getByTestId('ytd-footer').textContent).toContain('243 km short')
    // The one weekly average, on both cards.
    expect(screen.getByTestId('weekly-card').textContent).toContain('26km/wk avg')
    // This week, flagged over 35% and still outlined, in the one "this week" style.
    const longRun = screen.getByTestId('long-run-bars').lastElementChild as HTMLElement
    expect(longRun.hasAttribute('data-over')).toBe(true)
    expect(longRun.style.boxShadow).toBe('inset 0 0 0 2px var(--accent)')
    expect(screen.getByTestId('long-run-card').textContent).toContain('Jul')
  })

  // v4.6 2b: one large title, in the shell, painted fresh on every switch
  // and never styled at rest.
  it('keeps one large title and paints it anew on a tab switch', async () => {
    await renderBoard()
    const before = screen.getByTestId('analytics-title')
    await openTab(t.analytics.tabs.performance, 'predictions-card')
    expect(document.querySelectorAll('h1')).toHaveLength(1)
    const after = screen.getByTestId('analytics-title')
    expect(after).not.toBe(before)
    expect(after.getAttribute('style')).toBeNull()
    // Above the tabs, outside the panel that changes.
    expect(screen.getByRole('tabpanel').contains(after)).toBe(false)
  })

  // v4.6 2b: a tab switched to was left a point or two down, enough on iOS
  // for the scroll-edge blur over the large title.
  it('starts a switched-to tab at the very top', async () => {
    await renderBoard()
    const scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 1 })
    try {
      await openTab(t.analytics.tabs.performance, 'predictions-card')
      expect(scrollTo.mock.calls.some(([opts]) => (opts as ScrollToOptions).top === 0)).toBe(true)
    } finally {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
      vi.unstubAllGlobals()
    }
  })

  it('links the zone ranges instead of repeating the zone table', async () => {
    await renderBoard()
    await openTab(t.analytics.tabs.health, 'zones-card')
    expect(screen.getByTestId('zone-ranges-link').getAttribute('href')).toBe('/athlete')
    // This week keeps full-strength zone colours and gets the accent outline.
    const current = screen.getByTestId('zone-bars').querySelector<HTMLElement>('[data-current]')!
    expect(current.style.outline).toContain('var(--accent)')
    expect(screen.getByTestId('zone-bars').innerHTML).not.toContain('opacity')
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

  // v4.7: delta colours come from lib/deltaTone only.
  it('hard-codes no delta colour', () => {
    for (const [file, src] of sources) expect(src, file).not.toMatch(/var\(--good\)/)
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

describe('a week with nothing run (v4.6)', () => {
  it('draws a baseline stub in Weekly distance, Long run and Time in zones', async () => {
    const { VolumeTab } = await import('../VolumeTab')
    const { IntensityTab } = await import('../IntensityTab')
    const { weekRows, weekWindow } = await import('../analyticsView')
    const window = weekWindow(TODAY, '4w')
    const weeksWithGap = window.weeks.map((d, i) => (i === 1 ? { ...week(d, i), distanceKm: 0, longestKm: 0, zoneSeconds: {} } : week(d, i)))
    const rows = weekRows(weeksWithGap, [], window, TODAY)
    render(
      <>
        <VolumeTab rows={rows} live onShift={() => {}} ytd={null} today={TODAY} weeklyAvgKm={null} />
        <IntensityTab rows={rows} live onShift={() => {}} plan={[]} />
      </>,
    )
    expect(within(screen.getByTestId('weekly-bars')).getAllByTestId('empty-week')).toHaveLength(1)
    expect(within(screen.getByTestId('long-run-bars')).getAllByTestId('empty-week')).toHaveLength(1)
    expect(within(screen.getByTestId('zone-bars')).getAllByTestId('empty-week')).toHaveLength(1)
  })
})

describe('the coach read wording (v4.6)', () => {
  // The Easy pace tile said "1 s faster" while the coach read said "level".
  it('words the easy pace the way the Easy pace tile does', async () => {
    const { coachText } = await import('../LoadTab')
    const view = { tone: 'neutral' as const, loadUp: false, signals: [{ key: 'easy' as const, trend: 'flat' as const, pace: 352, delta: -1 }] }
    expect(coachText(view).signals[0]!.text).toBe(t.analytics.cards.coachRead.easyFaster('5:52', 1))
    expect(coachText({ ...view, signals: [{ ...view.signals[0]!, delta: 0 }] }).signals[0]!.text).toBe(t.analytics.cards.coachRead.easyLevel('5:52'))
  })
})
