import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
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
  // Flat at the risk card's pair: the load headline stays out of the way.
  loads: Array.from({ length: 60 }, (_, i) => ({ date: day(59 - i), acute: 412, chronic: 365 })),
  recovery: [],
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
      { id: 'mild', label: '', runCount: 20, avgApparentTempC: 17, paceAtRefHr: 363, costSecPerKm: 4 },
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
    vsLastYear: { km: 1394, lastYearKm: 640, since: null },
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
  // The fixture is dated TODAY and the board reads the clock for "today":
  // pinned, so the live window ends on the fixture's last day on any date.
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(`${TODAY}T12:00:00`))
  })
  afterAll(() => vi.useRealTimers())

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
  it('has one period control per tab, 4 wk / 12 wk / 1 yr on all four', async () => {
    await renderBoard()
    const periods = () => within(screen.getByRole('radiogroup')).getAllByRole('radio').map((r) => r.textContent)
    expect(screen.getAllByRole('radiogroup')).toHaveLength(1)
    expect(periods()).toEqual(['4 wk', '12 wk', '1 yr'])
    expect(screen.getByRole('radio', { checked: true }).textContent).toBe('4 wk')
    await openTab(t.analytics.tabs.performance, 'predictions-card')
    expect(periods()).toEqual(['4 wk', '12 wk', '1 yr'])
    expect(screen.getByRole('radio', { checked: true }).textContent).toBe('12 wk')
    expect(screen.getByTestId('predictions-card').textContent).toContain('change in 12 weeks')
    await openTab(t.analytics.tabs.volume, 'weekly-card')
    expect(periods()).toEqual(['4 wk', '12 wk', '1 yr'])
    // One range line on every tab, under the title: first Monday to today.
    expect(screen.getByTestId('analytics-range').textContent).toMatch(/^Jul 6 – Sep 26, 2026$/)
    await openTab(t.analytics.tabs.health, 'easy-hard-card')
    expect(screen.getAllByRole('radiogroup')).toHaveLength(1)
  })

  it('shows the coach read over every tab, one sentence with its signals behind a tap', async () => {
    await renderBoard()
    const coach = screen.getByTestId('coach-read')
    const s = t.analytics.cards.coachRead
    // Easy pace got faster, but threshold and the predictions got slower:
    // Garmin's two estimates of one fitness share a vote, so it reads mixed
    // and names each side (v4.16.4).
    expect(coach.getAttribute('data-tone')).toBe('neutral')
    expect(screen.getByTestId('coach-read-headline').textContent).toBe(s.headline.mixed('Easy pace', false, 'threshold and race predictions', true))
    expect(coach.textContent).toContain(s.eyebrow)
    expect(coach.textContent).toContain(s.why)
    // Outside the tab panel: it stays put across a switch.
    expect(screen.getByRole('tabpanel').contains(coach)).toBe(false)
    fireEvent.click(coach)
    const sheet = screen.getByRole('dialog')
    // The sheet backs its headline (v5.6 L1): the load fact first, then threshold.
    const bullets = [...sheet.querySelectorAll('li')].map((li) => li.textContent)
    expect(bullets[0]).toMatch(/^Fitness \d+, \+\d+ in 12 weeks\.$/)
    expect(bullets[1]).toBe(s.thresholdSlower('4:23', 9))
    expect(sheet.textContent).toContain(s.predictionsSlower(2, 2))
    expect(sheet.textContent).toContain(s.volume('+754'))
    expect(sheet.querySelector('[data-trend="declining"] svg')!.getAttribute('style')).toContain('var(--tone-caution)')
    expect(sheet.innerHTML).not.toContain('var(--accent')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    for (const [tab, card] of [
      [t.analytics.tabs.performance, 'predictions-card'],
      [t.analytics.tabs.volume, 'weekly-card'],
      [t.analytics.tabs.health, 'easy-hard-card'],
    ] as const) {
      await openTab(tab, card)
      expect(screen.getByTestId('coach-read-headline').textContent).toBe(s.headline.mixed('Easy pace', false, 'threshold and race predictions', true))
    }
  })

  // v4.17: a centred dialog, no bottom-sheet handle, with Close and Adjust plan.
  it('opens the coach read in a centred dialog with Close and an Adjust plan link to Plan', async () => {
    await renderBoard()
    fireEvent.click(screen.getByTestId('coach-read'))
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.className).toContain('max-w-[520px]')
    expect(dialog.className).toContain('rounded-[18px]')
    // Focus moves into it, and the page behind it is inert.
    expect(dialog.contains(document.activeElement)).toBe(true)
    const adjust = within(dialog).getByRole('link', { name: t.analytics.cards.coachRead.adjustPlan })
    expect(adjust.getAttribute('href')).toBe('/plan')
    expect(adjust.className).toContain('bg-accent')
    // Close is the outline button; the ✕ in the corner closes it too.
    const closes = within(dialog).getAllByRole('button', { name: t.analytics.cards.close })
    expect(closes).toHaveLength(2)
    fireEvent.click(closes[1]!)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('colours the coach read eyebrow by what the headline says', async () => {
    const { coachTone } = await import('../CoachRead')
    const view = { tone: 'caution' as const, loadUp: false, signals: [] }
    expect(coachTone(view, null)).toBe('warn')
    expect(coachTone({ ...view, tone: 'positive' }, null)).toBe('pos')
    expect(coachTone({ ...view, tone: 'neutral' }, null)).toBe('muted')
    expect(coachTone({ ...view, tone: 'positive' }, { kind: 'spike', change: null })).toBe('warn')
    expect(coachTone(view, { kind: 'building', change: { pct: 12, days: 10 }, recovery: true })).toBe('pos')
  })

  it('widens every Load card with the period, and resets the range', async () => {
    await renderBoard()
    expect(screen.getByTestId('training-status-strip').children).toHaveLength(28)
    fireEvent.click(screen.getByRole('radio', { name: '12 wk' }))
    expect(screen.getByTestId('training-status-strip').children.length).toBeLessThanOrEqual(10)
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
    expect(screen.getByTestId('risk-count').getAttribute('style')).toContain('var(--pos)')
    // Each range under its bar.
    expect(card.textContent).toContain('Safe 0.8 – 1.3')
    expect(card.textContent).toContain('Safe below 2.0')
    expect(card.textContent).toContain('Safe −5 to +5')
    fireEvent.click(within(card).getByRole('button', { name: /Load ratio/ }))
    expect(card.textContent).toContain(t.analytics.cards.risk.loadRatioFormula(412, 365))
  })

  // v4.17: past its alert limit a risk is bad news, neg - never the Z5 pink.
  it('marks a risk past its alert limit in neg, and one just out of range in warn', async () => {
    render(<AnalyticsClient data={{ ...data, risk: { ...data.risk!, acwr: 1.6, monotony: 2.1 } }} today={TODAY} />)
    await screen.findByTestId('form-card')
    const value = (key: string) => within(screen.getByTestId(`risk-${key}`)).getByTestId('risk-value').getAttribute('style')
    expect(value('loadRatio')).toContain('var(--neg)')
    expect(value('rampRate')).toContain('var(--foreground)')
    expect(screen.getByTestId('risk-count').getAttribute('style')).toContain('var(--neg)')
    expect(screen.getByTestId('risk-card').innerHTML).not.toContain('--zone-')
  })

  it('draws the training status in status colours, today outlined', async () => {
    const status = data.status.map((d, i) => ({ ...d, status: i === 58 ? ('overreaching' as const) : i === 57 ? ('recovery' as const) : d.status }))
    render(<AnalyticsClient data={{ ...data, status }} today={TODAY} />)
    await screen.findByTestId('form-card')
    const cells = [...screen.getByTestId('training-status-strip').children] as HTMLElement[]
    // v4.17.2: today at full strength and outlined, the rest at 60%.
    expect(cells.at(-1)!.style.background).toBe('var(--pos)')
    expect(cells.at(-1)!.style.outline).toContain('solid var(--foreground)')
    expect(cells.at(-2)!.style.background).toBe('color-mix(in srgb, var(--neg) 60%, transparent)')
    expect(cells.at(-3)!.style.background).toBe('color-mix(in srgb, var(--zone-1) 60%, transparent)')
    expect(cells.at(-2)!.style.outline).toBe('')
  })

  // v4.17.2: each count right after its name, the items 20 px apart - not
  // spread across the card, where a count read as the next item's.
  it('puts each status count right after its name', async () => {
    render(<AnalyticsClient data={data} today={TODAY} />)
    await screen.findByTestId('form-card')
    const legend = screen.getByTestId('status-legend')
    expect(legend.className).toContain('flex')
    expect(legend.className).toContain('gap-x-5')
    expect(legend.className).not.toMatch(/justify-between|grid/)
    for (const item of within(legend).getAllByTestId('status-legend-item')) {
      expect(item.className).toContain('gap-1.5')
      expect(item.className).not.toContain('justify-between')
    }
  })

  it('draws Form as fitness, fatigue and bars in their band colours', async () => {
    await renderBoard()
    const card = screen.getByTestId('form-card')
    // Fitness rose: good news; fatigue held: muted.
    expect(screen.getByTestId('fitness-delta').parentElement!.className).toContain('--pos')
    const bands = [...screen.getByTestId('form-strip').querySelectorAll<HTMLElement>('[data-band]')]
    expect(bands).toHaveLength(28)
    // v4.17.3: the band fills at the card's --form-fill strength, 60% dark / 70% light.
    for (const bar of bands) expect(bar.style.background).toMatch(/^color-mix\(in srgb, var\(--form-band-fill-(fresh|neutral|tired)\) var\(--form-fill\), transparent\)$/)
    expect(card.className).toContain('[--form-fill:70%]')
    expect(card.className).toContain('dark:[--form-fill:60%]')
    expect(card.querySelector('path[stroke="var(--foreground)"]')).not.toBeNull()
    expect(card.querySelector('path[stroke="var(--muted-foreground)"]')!.getAttribute('stroke-dasharray')).toBe('4 4')
  })

  it("names the goal race under the predictions, and measures its gap to target", async () => {
    await renderBoard()
    await openTab(t.analytics.tabs.performance, 'predictions-card')
    const card = screen.getByTestId('predictions-card')
    expect(screen.getByTestId('predictions-race').textContent).toBe('10K race: Nov 29 · 64 days')
    expect(card.textContent).not.toMatch(/\d\.\d{3}/)
    expect(screen.getByTestId('predictions-sentence').textContent).toContain('off your 40:00 target')
    // VO2max as Progress prints it.
    expect(screen.getByTestId('performance-summary').textContent).toContain('55.0')
    expect(screen.getByTestId('performance-summary').textContent).toContain('−1 in 12 weeks')
    expect(screen.getByTestId('performance-summary').textContent).toContain(`4:23${t.units.perKm}`)
    // v4.7: slower is amber, faster --good, by the same helper everywhere.
    for (const delta of screen.getAllByTestId('prediction-delta')) expect(delta.getAttribute('style')).toContain('var(--tone-caution)')
    // VO2max fell by 1 in 12 weeks: warn on the meaning line, the value stays ink.
    const [vo2] = screen.getAllByTestId('summary-delta')
    expect(vo2!.getAttribute('data-tone')).toBe('warn')
    expect(vo2!.parentElement!.className).toContain('text-[var(--warn)]')
    expect(screen.getByTestId('performance-summary').innerHTML).not.toContain('var(--accent')
  })

  // One subgrid keeps the times and changes aligned; from sm up the sparkline
  // sits right against the time, the slack after the distance.
  it('draws each prediction as one line, the sparkline next to its time', async () => {
    await renderBoard()
    await openTab(t.analytics.tabs.performance, 'predictions-card')
    // v4.17.3: distance, spacer, sparkline up against the time, time with its change.
    expect(screen.getByTestId('predictions-grid').className).toContain('sm:grid-cols-[120px_1fr_minmax(0,360px)_auto]')
    for (const row of screen.getByTestId('predictions-grid').children) {
      expect(row.className).toContain('grid-cols-subgrid')
      const cells = [...row.children]
      expect(cells[2]!.tagName.toLowerCase()).toBe('svg')
      expect(cells[3]!.getAttribute('data-testid')).toBe('prediction-time')
    }
  })

  // v4.17.2: the chart fits its paces, with three of them up the left.
  it('fits the pace trend to its paces and labels three of them', async () => {
    await renderBoard()
    await openTab(t.analytics.tabs.performance, 'pace-trend-card')
    const labels = [...screen.getByTestId('pace-axis').children].map((el) => el.textContent)
    expect(labels).toHaveLength(3)
    for (const label of labels) expect(label).toMatch(/^\d{1,2}:\d\d$/)
    expect(screen.getByTestId('pace-trend-card').querySelectorAll('[data-testid="pace-gridline"]')).toHaveLength(3)
    expect(screen.getByTestId('pace-trend-card').textContent).toContain('higher is faster')
  })

  it('draws the prediction sparklines faster up', async () => {
    await renderBoard()
    await openTab(t.analytics.tabs.performance, 'predictions-card')
    // The 5K got slower over the window, so its line ends lower (a larger y).
    const d = screen.getByTestId('prediction-5k').querySelector('path')!.getAttribute('d')!
    const ys = [...d.matchAll(/[ML][\d.]+,([\d.]+)/g)].map((m) => Number(m[1]))
    expect(ys.at(-1)!).toBeGreaterThan(ys[0]!)
  })

  // v4.17: each bar is the seconds lost against the best temperature band.
  it('draws heat cost as seconds lost vs the best band: best in pos, over 10 s warn, less muted', async () => {
    await renderBoard()
    await openTab(t.analytics.tabs.performance, 'heat-card')
    const row = (id: string) => screen.getByTestId(`heat-${id}`)
    const bar = (id: string) => within(row(id)).queryByTestId('heat-bar')
    const loss = (id: string) => within(row(id)).getByTestId('heat-loss')
    expect(bar('cold')!.style.background).toBe('var(--warn)')
    expect(bar('warm')!.style.background).toBe('var(--warn)')
    expect(bar('mild')!.style.background).toBe('var(--muted-foreground)')
    // 17 s of the 20 s scale.
    expect(bar('warm')!.style.width).toBe('85%')
    expect(bar('cool')).toBeNull()
    expect(loss('cool').textContent).toBe(t.analytics.cards.heatCost.best)
    expect(loss('cool').getAttribute('style')).toContain('var(--pos)')
    expect(loss('mild').textContent).toBe('+4 s')
    expect(loss('mild').getAttribute('style')).toContain('var(--muted-foreground)')
    expect(row('hot').textContent).toContain(t.analytics.cards.heatCost.noRuns)
    expect(screen.getByTestId('heat-card').innerHTML).not.toContain('var(--accent)')
  })

  it('ticks the plan on each week and dashes the current one', async () => {
    await renderBoard()
    await openTab(t.analytics.tabs.volume, 'weekly-card')
    const bars = screen.getByTestId('weekly-bars')
    expect(bars.children).toHaveLength(12)
    expect(screen.getAllByTestId('plan-tick')).toHaveLength(12)
    expect(bars.querySelectorAll('[data-current]')).toHaveLength(1)
    // The athlete's own weeks in the accent: full at or above plan (90%), 40% under it.
    const done = [...bars.querySelectorAll<HTMLElement>('[data-on-plan]:not([data-current])')]
    expect(done.length).toBeGreaterThan(0)
    for (const bar of done) expect(bar.style.background).toBe('var(--accent)')
    const current = bars.querySelector<HTMLElement>('[data-current]')!
    expect(current.style.background).toBe('transparent')
    expect(current.style.border).toBe('1.5px dashed var(--accent)')
    expect(screen.getByTestId('ytd-footer').textContent).toContain('243 km short')
    // The one weekly average, as a stat with its unit.
    expect(screen.getByTestId('weekly-card').textContent).toContain('12-week average26km/week')
    // Year to date in the accent against last year's grey.
    expect(screen.getByTestId('ytd-line').getAttribute('stroke')).toBe('var(--accent)')
    expect(screen.getByTestId('ytd-delta').textContent).toBe(t.analytics.cards.ytd.vs('+754', 2025))
    // This week, dashed in the one "this week" style and never flagged over:
    // its first runs are all of its distance so far.
    const longRun = screen.getByTestId('long-run-bars').querySelector<HTMLElement>('[data-current]')!
    expect(longRun.hasAttribute('data-over')).toBe(false)
    expect(longRun.style.background).not.toBe('var(--warn)')
    expect(longRun.style.outline).toBe('1.5px dashed var(--accent)')
    expect(screen.getByTestId('long-run-guide')).toBeTruthy()
    expect(screen.getByTestId('long-run-card').textContent).toContain('Jul')
  })

  // One large title, in the shell above the tabs, never styled at rest.
  it('keeps one large title above the tabs across a switch', async () => {
    await renderBoard()
    await openTab(t.analytics.tabs.performance, 'predictions-card')
    expect(document.querySelectorAll('h1')).toHaveLength(1)
    const after = screen.getByTestId('analytics-title')
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
    // This week keeps full-strength zone colours and takes the one "this week"
    // mark used on Volume: the dashed accent outline (v4.17).
    const current = screen.getByTestId('zone-bars').querySelector<HTMLElement>('[data-current]')!
    expect(current.style.outline).toBe('1.5px dashed var(--accent)')
    expect(screen.getByTestId('zone-bars').innerHTML).not.toContain('opacity')
    expect(screen.getByTestId('zone-bars').innerHTML).toContain('var(--zone-5)')
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
        <VolumeTab rows={rows} live onShift={() => {}} ytd={null} weeklyAvgKm={null} />
        <IntensityTab rows={rows} live onShift={() => {}} plan={[]} />
      </>,
    )
    expect(within(screen.getByTestId('weekly-bars')).getAllByTestId('empty-week')).toHaveLength(1)
    // Without a plan every week is the accent at 40%: nothing to be on.
    const done = [...screen.getByTestId('weekly-bars').querySelectorAll<HTMLElement>('[style*="background"]:not([data-current])')]
    expect(done.length).toBeGreaterThan(0)
    for (const bar of done) expect(bar.style.background).toBe('color-mix(in srgb, var(--accent) 40%, transparent)')
    expect(within(screen.getByTestId('long-run-bars')).getAllByTestId('empty-week')).toHaveLength(1)
    expect(within(screen.getByTestId('zone-bars')).getAllByTestId('empty-week')).toHaveLength(1)
  })
})

describe('the coach read wording (v4.6, v5.6 #3)', () => {
  // "1 s faster" sat beside a flat arrow: inside the band it is level, in the
  // coach read and on the Easy pace tile alike.
  it('words a change inside the noise band as level, like the Easy pace tile', async () => {
    const { coachText } = await import('../CoachRead')
    const { shiftWords } = await import('../PerformanceTab')
    const view = { tone: 'neutral' as const, loadUp: false, signals: [{ key: 'easy' as const, trend: 'flat' as const, pace: 352, delta: -1 }] }
    expect(coachText(view).signals[0]!.text).toBe(t.analytics.cards.coachRead.easyLevel('5:52'))
    expect(shiftWords(-1, 3)).toBe(t.analytics.cards.summary.same)
    const faster = { ...view, signals: [{ ...view.signals[0]!, trend: 'improving' as const, delta: -8 }] }
    expect(coachText(faster).signals[0]!.text).toBe(t.analytics.cards.coachRead.easyFaster('5:52', 8))
  })

  // v4.16.4: "threshold and race predictions haven't followed" was one fixed
  // sentence, printed whichever reads had slipped.
  it('names only the reads that slipped', async () => {
    const { coachText } = await import('../CoachRead')
    const { coachRead } = await import('../analyticsView')
    const s = t.analytics.cards.coachRead
    const view = coachRead({
      threshold: { now: 263, delta: -6 },
      easy: { now: 352, delta: 1 },
      predictions: [{ distance: '10k', seconds: 2570, delta: 40, series: [] }],
      efficiency: { now: 1.12, delta4w: -0.01, delta12w: -0.03, heatCost: null, trend: 'steady', adjusted: [], measured: [], dates: [] },
      fitness: 48,
      fitnessDelta: 11,
      ytd: null,
    })!
    expect(view.tone).toBe('caution')
    expect(coachText(view).headline).toBe(s.headline.cautionLoadUp('race predictions and aerobic efficiency', true))
    expect(coachText(view).headline).not.toContain('threshold')
  })

  it('never credits load for speed when load did not go up', async () => {
    const { coachText } = await import('../CoachRead')
    const s = t.analytics.cards.coachRead
    const view = { tone: 'positive' as const, loadUp: false, signals: [{ key: 'easy' as const, trend: 'improving' as const, pace: 352, delta: -8 }] }
    expect(coachText(view).headline).toBe(s.headline.positiveSteadyLoad)
    expect(coachText({ ...view, loadUp: true }).headline).toBe(s.headline.positive)
  })

  it('gives aerobic efficiency its unit and what the change means', async () => {
    const { coachText } = await import('../CoachRead')
    const s = t.analytics.cards.coachRead
    const efficiency = (trend: 'improving' | 'flat' | 'declining', delta: number) =>
      coachText({ tone: 'neutral', loadUp: false, signals: [{ key: 'efficiency', trend, value: 1.15, delta }] }).signals[0]!.text
    expect(efficiency('declining', -0.03)).toBe(s.efficiencyDown('1.15', '−0.03'))
    expect(efficiency('declining', -0.03)).toContain('m per heartbeat')
    expect(efficiency('flat', -0.02)).toBe(s.efficiencyLevel('1.15'))
  })

  it('says when last year only counts from the date the history starts', async () => {
    const { coachText } = await import('../CoachRead')
    const s = t.analytics.cards.coachRead
    const volume = (since: string | null) =>
      coachText({ tone: 'neutral', loadUp: false, signals: [{ key: 'volume', trend: 'improving', delta: 312, since }] }).signals[0]!.text
    expect(volume(null)).toBe(s.volume('+312'))
    expect(volume('2025-05-03')).toBe(s.volumeSince('+312', 'May 3'))
  })
})

describe('the coach read under a load headline (v4.16.4)', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(`${TODAY}T12:00:00`))
  })
  afterAll(() => vi.useRealTimers())

  // "Load jumped 30%" sat over six lines about pace that do not back it.
  it('heads the speed lines with the headline they back', async () => {
    const loads = Array.from({ length: 60 }, (_, i) => ({ date: day(59 - i), acute: i < 50 ? 360 : 360 + (i - 49) * 20, chronic: 365 }))
    render(<AnalyticsClient data={{ ...data, loads }} today={TODAY} />)
    const coach = await screen.findByTestId('coach-read')
    expect(coach.getAttribute('data-load')).toBe('spike')
    fireEvent.click(coach)
    const s = t.analytics.cards.coachRead
    expect(within(screen.getByRole('dialog')).getByTestId('coach-read-speed').textContent).toBe(
      s.headline.mixed('Easy pace', false, 'threshold and race predictions', true),
    )
  })

  it('shows no second headline when the card leads with the speed read', async () => {
    render(<AnalyticsClient data={data} today={TODAY} />)
    fireEvent.click(await screen.findByTestId('coach-read'))
    expect(within(screen.getByRole('dialog')).queryByTestId('coach-read-speed')).toBeNull()
  })

  it('compares Year to date from where the history starts when that is partway through last year', async () => {
    const ytd = { ...data.ytd!, vsLastYear: { km: 1020, lastYearKm: 708, since: '2025-05-03' } }
    render(<AnalyticsClient data={{ ...data, ytd }} today={TODAY} />)
    await screen.findByTestId('form-card')
    await act(async () => screen.getByRole('tab', { name: t.analytics.tabs.volume }).click())
    const card = await screen.findByTestId('ytd-card')
    expect(within(card).getByTestId('ytd-delta').textContent).toBe(t.analytics.cards.ytd.vsSince('+312', 2025, 'May 3'))
    expect(card.textContent).toContain(t.analytics.cards.ytd.caption)
  })
})

describe('the race prediction range (v4.8)', () => {
  // "All four slipped 1-9 min" above a 5K that lost 33 s.
  it('prints each end the way its row prints its change', async () => {
    const { changeAmount } = await import('../PerformanceTab')
    const s = t.analytics.cards.predictions
    expect(s.range(changeAmount(33), changeAmount(557))).toBe('33 s–9:17')
    expect(s.slipped('All four', s.range(changeAmount(33), changeAmount(557)), '12 weeks')).toBe('All four slipped 33 s–9:17 over 12 weeks.')
  })
})

describe('Load trend and Recovery (v5.4)', () => {
  const nights = (n: number, hrv: (i: number) => number, rhr: (i: number) => number) =>
    Array.from({ length: n }, (_, i) => ({ date: day(n - 1 - i), hrv: hrv(i), restingHr: rhr(i) }))
  const wobble = (i: number) => [0, 2, -1, 3, -2, 1, -3, 2][i % 8]!
  const steady = nights(90, (i) => 58 + wobble(i), (i) => 46 + (i % 3) - 1)

  async function renderWith(extra: Partial<AnalyticsBoardData>) {
    render(<AnalyticsClient data={{ ...data, ...extra }} today={TODAY} />)
    await screen.findByTestId('form-card')
  }

  it('orders the Load cards coach read, Form, Load trend, Injury risk, Recovery, Training status', async () => {
    await renderWith({ recovery: steady })
    const ids = [...document.querySelectorAll('[data-testid$="-card"], [data-testid="coach-read"]')].map((el) => el.getAttribute('data-testid'))
    expect(ids).toEqual(['coach-read', 'form-card', 'load-trend-card', 'risk-card', 'recovery-card', 'status-card'])
  })

  it('prints the load ratio with its inputs, the last point of Load trend', async () => {
    await renderWith({})
    expect(screen.getByTestId('load-trend-value').textContent).toBe('412')
    expect(screen.getByTestId('load-ratio-inputs').textContent).toBe('412 ÷ 365')
  })

  it('turns the headline amber above the safe range and marks the day', async () => {
    const loads = Array.from({ length: 60 }, (_, i) => ({ date: day(59 - i), acute: i < 50 ? 360 : 360 + (i - 49) * 20, chronic: 365 }))
    await renderWith({ loads })
    const value = screen.getByTestId('load-trend-value')
    expect(value.getAttribute('data-state')).toBe('above')
    expect(value.getAttribute('style')).toContain('var(--warn)')
    expect(screen.getByTestId('today-dot').getAttribute('style')).toContain('var(--warn)')
    expect(screen.getAllByTestId('outside-dot').length).toBeGreaterThan(0)
    expect(screen.getByTestId('coach-read').getAttribute('data-load')).toBe('spike')
  })

  it('hides Recovery under 7 nights of HRV, and never draws it empty', async () => {
    await renderWith({ recovery: steady.slice(-6) })
    expect(screen.queryByTestId('recovery-card')).toBeNull()
  })

  it('shows resting HR alone when the watch is never worn overnight', async () => {
    await renderWith({ recovery: steady.map((n) => ({ ...n, hrv: null })) })
    const card = screen.getByTestId('recovery-card')
    expect(card.textContent).toContain(t.analytics.cards.recovery.captionDaily)
    // One series: its baseline in the sentence.
    expect(card.textContent).toContain(t.analytics.cards.recovery.insideBaseline(45, 47, 'bpm').join(''))
    expect(within(card).queryByTestId('recovery-hrv')).toBeNull()
    expect(within(card).queryByTestId('recovery-hrv-chart')).toBeNull()
    expect(within(card).getByTestId('recovery-rhr-chart')).toBeTruthy()
  })

  it('reads recovery inside the baseline over a pos baseline band, with no dots', async () => {
    await renderWith({ recovery: steady })
    const card = screen.getByTestId('recovery-card')
    expect(card.textContent).toContain(t.analytics.cards.recovery.bothInside[1])
    // v4.17: no accent "now" dot; only a point outside the band is marked.
    expect(within(card).queryByTestId('today-dot')).toBeNull()
    expect(within(card).getAllByTestId('baseline-band')[0]!.getAttribute('fill')).toContain('var(--pos)')
  })

  it('says how many nights HRV has been low, and the coach read takes it into account', async () => {
    const low = nights(90, (i) => (i >= 87 ? 44 : 58 + wobble(i)), (i) => (i >= 87 ? 51 : 46 + (i % 3) - 1))
    await renderWith({ recovery: low })
    const card = screen.getByTestId('recovery-card')
    expect(card.textContent).toContain(t.analytics.cards.recovery.hrvLow(3))
        expect(within(within(card).getByTestId('recovery-hrv')).getByText(/vs/).getAttribute('data-tone')).toBe('worse')
    expect(screen.getByTestId('coach-read').getAttribute('data-load')).toBe('dip')
  })

  it('uses only the four v4.17 colours in the two cards', () => {
    const source = readFileSync(path.join(__dirname, '../LoadRecoveryCards.tsx'), 'utf8')
    const vars = new Set([...source.matchAll(/var\(--([a-z-]+)\)/g)].map((m) => m[1]))
    expect([...vars].sort()).toEqual(['foreground', 'muted-foreground', 'pos', 'warn'])
    expect(source).not.toMatch(/#[0-9a-f]{3,6}\b/i)
  })
})

describe('the pace axis (v4.17.3)', () => {
  it('pads the drawn paces by 5% of their range, at least 5 s, rounded out to 5 s', async () => {
    const { paceAxis } = await import('../PerformanceTab')
    // A 70 s range: 5% is 3.5, so the 5 s floor holds.
    expect(paceAxis([265, 290, 335])).toMatchObject({ lo: 260, hi: 340, ticks: [280, 300, 320] })
    // A 200 s range: 5% is 10.
    expect(paceAxis([240, 440])).toMatchObject({ lo: 230, hi: 450 })
  })

  it('keeps the lines on at least 70% of the chart and three round paces inside it', async () => {
    const { paceAxis } = await import('../PerformanceTab')
    for (const range of [[315, 320], [300, 345], [240, 400], [318, 361], [330, 331]]) {
      const { lo, hi, ticks } = paceAxis(range)
      expect(lo % 5).toBe(0)
      expect(hi % 5).toBe(0)
      for (const tick of ticks) {
        expect(tick).toBeGreaterThanOrEqual(lo)
        expect(tick).toBeLessThanOrEqual(hi)
      }
      expect(new Set(ticks).size).toBe(3)
      if (range[1]! - range[0]! >= 40) expect((range[1]! - range[0]!) / (hi - lo)).toBeGreaterThanOrEqual(0.7)
    }
  })
})

describe('quality session marks (v4.17.2)', () => {
  it('draws intervals as a diamond, in the legend too', async () => {
    const { LegendItem } = await import('@/components/ui/Legend')
    render(<LegendItem swatch="diamond" color="var(--zone-5)">Intervals</LegendItem>)
    const swatch = screen.getByText('Intervals').firstElementChild as HTMLElement
    expect(swatch.style.transform).toBe('rotate(45deg)')
    expect(swatch.style.background).toBe('var(--zone-5)')
  })
})
