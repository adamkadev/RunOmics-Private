import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  missed: [],
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
    km: 1394,
    vsLastYear: { km: 1394, lastYearKm: 640, since: null },
    goalKm: 2000,
    projection: { projectedYearKm: 1757 },
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

  it('has one period control per tab, 4 wk / 12 wk / 1 yr on all four', async () => {
    await renderBoard()
    const periods = () => within(screen.getByRole('radiogroup')).getAllByRole('radio').map((r) => r.textContent)
    expect(screen.getAllByRole('radiogroup')).toHaveLength(1)
    expect(periods()).toEqual(['4W', '12W', '1Y'])
    expect(screen.getByRole('radio', { checked: true }).textContent).toBe('4W')
    await openTab(t.analytics.tabs.performance, 'predictions-card')
    expect(periods()).toEqual(['4W', '12W', '1Y'])
    expect(screen.getByRole('radio', { checked: true }).textContent).toBe('12W')
    expect(screen.getByTestId('predictions-card').textContent).toContain('change in 12 weeks')
    await openTab(t.analytics.tabs.volume, 'weekly-card')
    expect(periods()).toEqual(['4W', '12W', '1Y'])
    // First Monday to today.
    expect(screen.getByTestId('analytics-range').textContent).toMatch(/^Jul 6 – Sep 26, 2026$/)
    await openTab(t.analytics.tabs.health, 'easy-hard-card')
    expect(screen.getAllByRole('radiogroup')).toHaveLength(1)
  })

  it('reads each tab over its own period, and says which', async () => {
    await renderBoard()
    const s = t.analytics.cards.coachRead
    const words = t.analytics.cards.period.words
    const coach = () => screen.getByTestId('coach-read')
    const headline = () => screen.getByTestId('coach-read-headline').textContent
    // Load, at its 4 weeks: steady load inside its range, so the card's own sentence.
    expect(coach().textContent).toContain(s.eyebrow(words['4w']!, t.analytics.tabs.fitness))
    expect(coach().getAttribute('data-tone')).toBe('muted')
    expect(headline()).toBe(t.analytics.cards.loadTrend.steady(t.analytics.cards.loadTrend.today).join(''))
    // Outside the tab panel: it stays put across a switch.
    expect(screen.getByRole('tabpanel').contains(coach())).toBe(false)

    // Performance, at its 12 weeks: easy pace faster, threshold and the predictions slower; Garmin's two estimates
    // share a vote, so it reads mixed and names each side.
    await openTab(t.analytics.tabs.performance, 'predictions-card')
    expect(coach().textContent).toContain(s.eyebrow(words['12w']!, t.analytics.tabs.performance))
    expect(headline()).toBe(s.headline.mixed('Easy pace', false, 'threshold and race predictions', true))
    fireEvent.click(screen.getByTestId('coach-read-why'))
    const sheet = screen.getByRole('dialog')
    // The case for the headline, worse first, and nothing from another tab.
    const bullets = [...sheet.querySelectorAll('li')]
    expect(bullets.map((li) => li.getAttribute('data-trend'))).toEqual([...bullets.map((li) => li.getAttribute('data-trend'))].sort((a, b) => ['declining', 'flat', 'improving'].indexOf(a!) - ['declining', 'flat', 'improving'].indexOf(b!)))
    expect(bullets[0]!.textContent).toBe(s.thresholdSlower('4:23', 9, s.ago['12w']!))
    expect(sheet.textContent).toContain(s.predictionsSlower(2, 2, s.ago['12w']!))
    expect(sheet.textContent).not.toContain(s.volume('+754'))
    expect(sheet.querySelector('[data-trend="declining"] svg')!.getAttribute('style')).toContain('var(--tone-caution)')
    expect(sheet.innerHTML).not.toContain('var(--accent')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // The period control is the read's period too.
    fireEvent.click(screen.getByRole('radio', { name: '4 weeks' }))
    expect(coach().textContent).toContain(s.eyebrow(words['4w']!, t.analytics.tabs.performance))

    // Volume: its own claim, the plan first. Every week made its 44 km plan,
    // this one already; the 16 km long run, over 35% of 40-42 km in every
    // finished week, leads the case.
    await openTab(t.analytics.tabs.volume, 'weekly-card')
    expect(coach().textContent).toContain(s.eyebrow(words['12w']!, t.analytics.tabs.volume))
    expect(headline()).toBe(s.volumeTab.onPlan(12, 12))
    expect(coach().getAttribute('data-tone')).toBe('pos')
    fireEvent.click(screen.getByTestId('coach-read-why'))
    expect(screen.getByRole('dialog').querySelector('li')!.textContent).toBe(s.volumeTab.longRunRow(11))
    fireEvent.keyDown(document, { key: 'Escape' })

    // Intensity: the one easy / moderate / hard verdict.
    await openTab(t.analytics.tabs.health, 'easy-hard-card')
    expect(headline()).toBe(s.intensityTab.inRange(84))
    expect(coach().getAttribute('data-tone')).toBe('pos')
  })

  it('dates the header range by the period chosen, as the coach eyebrow names it', async () => {
    await renderBoard()
    const s = t.analytics.cards.coachRead
    const words = t.analytics.cards.period.words
    const cases = [
      { tab: 'fitness', card: 'form-card', ranges: ['Aug 30 – Sep 26, 2026', 'Jul 5 – Sep 26, 2026', 'Sep 27, 2025 – Sep 26, 2026'] },
      { tab: 'volume', card: 'weekly-card', ranges: ['Aug 31 – Sep 26, 2026', 'Jul 6 – Sep 26, 2026', 'Sep 29, 2025 – Sep 26, 2026'] },
    ] as const
    for (const { tab, card, ranges } of cases) {
      await openTab(t.analytics.tabs[tab], card)
      for (const [i, period] of (['4w', '12w', '1y'] as const).entries()) {
        fireEvent.click(screen.getByRole('radio', { name: t.analytics.cards.period.words[period] }))
        expect(screen.getByRole('radio', { checked: true }).textContent).toBe(t.analytics.cards.period.short[period])
        expect(screen.getByTestId('analytics-range').textContent).toBe(ranges[i])
        expect(screen.getByTestId('coach-read').textContent).toContain(s.eyebrow(words[period]!, t.analytics.tabs[tab]))
      }
    }
  })

  it('opens the coach read in a bottom sheet with Open plan beside Close', async () => {
    await renderBoard()
    expect(screen.getByTestId('coach-open-plan').getAttribute('href')).toBe('/plan')
    fireEvent.click(screen.getByTestId('coach-read-why'))
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const panel = screen.getByTestId('why-sheet')
    expect(panel.getAttribute('data-detent')).toBe('medium')
    expect(panel.className).toMatch(/\blg lg-sheet\b/)
    expect(panel.className).toContain('rounded-[var(--radius-sheet)]')
    expect(dialog.contains(document.activeElement)).toBe(true)
    // Load, Fitness, Fatigue in that order, each a bold lead and what it means.
    const rows = [...dialog.querySelectorAll('li')].map((li) => li.textContent ?? '')
    expect(rows[0]).toMatch(/^Load \d+, (under|inside|over) the \d+–\d+ safe range\.$/)
    expect(rows[1]).toMatch(/^Fitness \d+, .+\. (Slipping|Building) .+ a week now\.$|^Fitness \d+, .+\. Holding steady now\.$/)
    expect(rows[2]).toMatch(/^Fatigue \d+, .+\. .+\.$/)
    expect(dialog.querySelector('li b')!.textContent).toMatch(/^Load \d+$/)
    const open = within(dialog).getByRole('link', { name: t.analytics.cards.coachRead.openPlanButton })
    expect(open.getAttribute('href')).toBe('/plan')
    expect(open.className).toContain('bg-accent')
    expect(open.className).toContain('flex-1')
    const closes = within(dialog).getAllByRole('button', { name: t.analytics.cards.close })
    expect(closes).toHaveLength(1)
    fireEvent.click(closes[0]!)
    // The sheet slides away before it goes.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('widens the Form strip with the period, and resets the range', async () => {
    await renderBoard()
    expect(screen.getByTestId('form-strip').children).toHaveLength(28)
    fireEvent.click(screen.getByRole('radio', { name: '12 weeks' }))
    expect(screen.getByTestId('form-strip').children.length).toBeLessThan(28)
    expect(screen.getByTestId('analytics-range').textContent).not.toBe('')
  })

  it('opens a card explanation from its title, with no (i) icons', async () => {
    await renderBoard()
    fireEvent.click(screen.getByRole('button', { name: t.analytics.cards.form.title }))
    expect(screen.getByRole('dialog').textContent).toContain(t.analytics.cards.form.about)
    expect(document.querySelector('[aria-label="' + t.analytics.aboutChart + '"]')).toBeNull()
  })

  it('drops Injury risk and the large Load trend, and the note on the watch status', async () => {
    await renderBoard()
    for (const id of ['risk-card', 'load-trend-card', 'recovery-card']) expect(screen.queryByTestId(id)).toBeNull()
    expect(screen.queryByTestId('coach-read-note')).toBeNull()
  })

  it('draws the training status in status colours, today outlined', async () => {
    const status = data.status.map((d, i) => ({ ...d, status: i === 58 ? ('overreaching' as const) : i === 57 ? ('recovery' as const) : d.status }))
    render(<AnalyticsClient data={{ ...data, status }} today={TODAY} />)
    await screen.findByTestId('form-card')
    const cells = [...screen.getByTestId('training-status-strip').children] as HTMLElement[]
    // Today in the shared today ring, not a heavy ink outline.
    expect(cells.at(-1)!.style.background).toBe('var(--pos)')
    expect(cells.at(-1)!.className).toContain('state-today')
    expect(cells.at(-2)!.className).not.toContain('state-today')
    expect(cells.at(-2)!.style.background).toBe('color-mix(in srgb, var(--neg) 60%, transparent)')
    expect(cells.at(-3)!.style.background).toBe('color-mix(in srgb, var(--zone-1) 60%, transparent)')
    expect(cells.at(-2)!.style.outline).toBe('')
  })

  // Spread across the card, a count reads as the next item's.
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


  it('reads Form on one line, with a daily strip in its band colours', async () => {
    await renderBoard()
    const card = screen.getByTestId('form-card')
    // Fitness rose: good news, an arrow and its size.
    expect(screen.getByTestId('fitness-delta').firstElementChild!.getAttribute('style')).toContain('var(--good)')
    const bands = [...screen.getByTestId('form-strip').querySelectorAll<HTMLElement>('[data-band]')]
    expect(bands).toHaveLength(28)
    for (const bar of bands) expect(bar.style.background).toMatch(/^color-mix\(in srgb, var\(--form-band-fill-(fresh|neutral|tired)\) var\(--form-fill\), transparent\)$/)
    expect(card.className).toContain('[--form-fill:70%]')
    expect(card.className).toContain('dark:[--form-fill:60%]')
  })

  it("names the goal race under the predictions, and measures its gap to target", async () => {
    await renderBoard()
    await openTab(t.analytics.tabs.performance, 'predictions-card')
    const card = screen.getByTestId('predictions-card')
    expect(screen.getByTestId('predictions-race').textContent).toBe('10K race: Nov 29 · 64 days')
    expect(card.textContent).not.toMatch(/\d\.\d{3}/)
    expect(screen.getByTestId('predictions-sentence').textContent).toContain('off your 40:00 target')
    // The gap itself in bold, a caution off the target, as Goals colours it.
    expect(screen.getByTestId('predictions-gap').textContent).toBe('3:59')
    expect(screen.getByTestId('predictions-gap').getAttribute('style')).toContain('var(--warn)')
    // VO2max as Progress prints it, a summary that opens its home on Athlete & zones.
    expect(screen.getByTestId('performance-summary').textContent).toContain('55.0')
    expect(screen.getByTestId('vo2-link').getAttribute('href')).toBe('/athlete')
    expect(screen.getByTestId('vo2-link').textContent).toContain('55.0')
    expect(screen.getByTestId('performance-summary').textContent).toContain('−1.0 in 12 weeks')
    expect(screen.getByTestId('performance-summary').textContent).toContain(`4:23${t.units.perKm}`)
    // Slower is amber, faster --good, by the same helper everywhere.
    for (const delta of screen.getAllByTestId('prediction-delta')) expect(delta.getAttribute('style')).toContain('var(--tone-caution)')
    // VO2max fell by 1 in 12 weeks: warn on the meaning line, the value stays ink.
    const [vo2] = screen.getAllByTestId('summary-delta')
    expect(vo2!.getAttribute('data-tone')).toBe('warn')
    expect(vo2!.parentElement!.className).toContain('text-[var(--warn)]')
    expect(screen.getByTestId('performance-summary').innerHTML).not.toContain('var(--accent')
  })

  it('draws each prediction as one line, the sparkline next to its time', async () => {
    await renderBoard()
    await openTab(t.analytics.tabs.performance, 'predictions-card')
    // Distance, spacer, sparkline up against the time, time with its change.
    expect(screen.getByTestId('predictions-grid').className).toContain('sm:grid-cols-[120px_1fr_minmax(0,360px)_auto]')
    for (const row of screen.getByTestId('predictions-grid').children) {
      expect(row.className).toContain('grid-cols-subgrid')
      const cells = [...row.children]
      expect(cells[2]!.tagName.toLowerCase()).toBe('svg')
      expect(cells[3]!.getAttribute('data-testid')).toBe('prediction-time')
    }
  })

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
    // The best band is the zero, marked; a band without runs is an empty dashed track, never drawn like the best.
    expect(within(row('cool')).getByTestId('heat-zero').style.background).toBe('var(--pos)')
    expect(within(row('hot')).getByTestId('heat-empty').className).toContain('border-dashed')
    expect(within(row('cool')).queryByTestId('heat-empty')).toBeNull()
    expect(screen.getByTestId('heat-key').textContent).toBe(t.analytics.cards.heatCost.barKey)
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
    expect(current.style.background).toMatch(/var\(--accent\)/)
    expect(current.style.outline).toBe('1.5px dashed var(--accent)')
    // The one weekly average, as a stat with its unit.
    expect(screen.getByTestId('weekly-card').textContent).toContain(`26${t.analytics.cards.weekly.underAvg(12)}`)
    // This week, dashed in the one "this week" style and never flagged over:
    // its first runs are all of its distance so far.
    const longRun = screen.getByTestId('long-run-bars').querySelector<HTMLElement>('[data-current]')!
    expect(longRun.hasAttribute('data-over')).toBe(false)
    expect(longRun.style.background).not.toBe('var(--warn)')
    expect(longRun.style.outline).toBe('1.5px dashed var(--accent)')
    expect(screen.getByTestId('long-run-guide')).toBeTruthy()
    // The count over across from the title, no axis under the bars.
    expect(screen.getByTestId('long-run-over')).toBeTruthy()
  })

  it('keeps one large title above the tabs across a switch', async () => {
    await renderBoard()
    await openTab(t.analytics.tabs.performance, 'predictions-card')
    expect(document.querySelectorAll('h1')).toHaveLength(1)
    const after = screen.getByTestId('analytics-title')
    expect(after.getAttribute('style')).toBeNull()
    // Above the tabs, outside the panel that changes.
    expect(screen.getByRole('tabpanel').contains(after)).toBe(false)
  })

  // A point or two down is enough on iOS for the scroll-edge blur over the large title.
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
    // This week keeps full-strength zone colours and takes the one "this week" mark used on Volume: the dashed
    // accent outline.
    const current = screen.getByTestId('zone-bars').querySelector<HTMLElement>('[data-current]')!
    expect(current.style.outline).toBe('1.5px dashed var(--accent)')
    expect(screen.getByTestId('zone-bars').innerHTML).not.toContain('opacity')
    expect(screen.getByTestId('zone-bars').innerHTML).toContain('var(--zone-5)')
  })

  // Z3 and Z4 read as one colour in a stacked week.
  it('names every zone under Time in zones with its hours, and follows a held week', async () => {
    await renderBoard()
    await openTab(t.analytics.tabs.health, 'zones-card')
    const key = () => screen.getByTestId('zone-key')
    const figures = () => within(key()).getAllByTestId('zone-key-item').map((item) => [item.firstElementChild!.textContent, item.querySelector('b')!.textContent])
    // Twelve weeks of 0.5 / 3 / 0.17 / 0.42 / 0.08 h.
    expect(figures()).toEqual([['Z1', '6.0 h'], ['Z2', '36.0 h'], ['Z3', '2.0 h'], ['Z4', '5.0 h'], ['Z5', '1.0 h']])
    const scrub = screen.getByTestId('zone-bars').closest<HTMLElement>('[data-chart-scrub]')!
    scrub.getBoundingClientRect = () => ({ left: 0, width: 120, top: 0, height: 130, right: 120, bottom: 130 }) as DOMRect
    fireEvent.pointerMove(scrub, { pointerType: 'mouse', clientX: 5, clientY: 60 })
    expect(key().hasAttribute('data-held')).toBe(true)
    expect(figures()).toEqual([['Z1', '0.5 h'], ['Z2', '3.0 h'], ['Z3', '0.2 h'], ['Z4', '0.4 h'], ['Z5', '0.1 h']])
    fireEvent.pointerCancel(scrub)
    expect(key().hasAttribute('data-held')).toBe(false)
    expect(figures()[1]).toEqual(['Z2', '36.0 h'])
    // A year's hours, as distances: a decimal under 100 and none above.
    fireEvent.click(screen.getByRole('radio', { name: 'a year' }))
    expect(figures().slice(0, 2)).toEqual([['Z1', '26.0 h'], ['Z2', '156 h']])
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

  // Delta colours come from lib/deltaTone only.
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
  // FR uses "Forme" for Form (TSB), so the load tab can't take it.
  it('names the load tab Charge', async () => {
    const { fr } = await import('@/i18n/fr')
    expect(fr.analytics.tabs).toEqual({ fitness: 'Charge', performance: 'Performance', volume: 'Volume', health: 'Intensité' })
    expect(fr.analytics.cards.risk.title).toBe('Risque de blessure')
    expect(fr.analytics.cards.risk.loadRatio).toBe('Ratio de charge')
    expect(fr.analytics.cards.heatCost.title).toBe('Coût de la température')
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
    // Without a plan every week is the dark accent: nothing to be on.
    const done = [...screen.getByTestId('weekly-bars').querySelectorAll<HTMLElement>('[style*="background"]:not([data-current])')]
    expect(done.length).toBeGreaterThan(0)
    for (const bar of done) expect(bar.style.background).toBe('color-mix(in srgb, var(--accent) 40%, var(--background))')
    expect(within(screen.getByTestId('long-run-bars')).getAllByTestId('empty-week')).toHaveLength(1)
    expect(within(screen.getByTestId('zone-bars')).getAllByTestId('empty-week')).toHaveLength(1)
  })
})

describe('the coach read wording (v4.6, v5.6 #3)', () => {
  // Inside the noise band a change is level, so "1 s faster" never sits beside a flat arrow.
  it('words a change inside the noise band as level, like the Easy pace tile', async () => {
    const { signalRows } = await import('../coachReadTabs')
    const { shiftWords } = await import('../PerformanceTab')
    const s = t.analytics.cards.coachRead
    const view = { tone: 'neutral' as const, loadUp: false, signals: [{ key: 'easy' as const, trend: 'flat' as const, pace: 352, delta: -1 }] }
    expect(signalRows(view, '12w')[0]!.text).toBe(s.easyLevel('5:52', s.ago['12w']!))
    expect(shiftWords(-1, 3)).toBe(t.analytics.cards.summary.same)
    const faster = { ...view, signals: [{ ...view.signals[0]!, trend: 'improving' as const, delta: -8 }] }
    expect(signalRows(faster, '4w')[0]!.text).toBe(s.easyFaster('5:52', 8, s.ago['4w']!))
  })

  it('names only the reads that slipped', async () => {
    const { readHeadline } = await import('../coachReadTabs')
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
    expect(readHeadline(view, '12w')).toBe(s.headline.cautionLoadUp('race predictions and aerobic efficiency', true))
    expect(readHeadline(view, '12w')).not.toContain('threshold')
  })

  it('never credits load for speed when load did not go up', async () => {
    const { readHeadline } = await import('../coachReadTabs')
    const s = t.analytics.cards.coachRead
    const view = { tone: 'positive' as const, loadUp: false, signals: [{ key: 'easy' as const, trend: 'improving' as const, pace: 352, delta: -8 }] }
    expect(readHeadline(view, '12w')).toBe(s.headline.positiveSteadyLoad(s.last['12w']!))
    expect(readHeadline({ ...view, loadUp: true }, '12w')).toBe(s.headline.positive)
  })

  it('gives aerobic efficiency its unit and what the change means', async () => {
    const { signalRows } = await import('../coachReadTabs')
    const s = t.analytics.cards.coachRead
    const efficiency = (trend: 'improving' | 'flat' | 'declining', delta: number) =>
      signalRows({ tone: 'neutral', loadUp: false, signals: [{ key: 'efficiency', trend, value: 1.15, delta }] }, '12w')[0]!.text
    expect(efficiency('declining', -0.03)).toBe(s.efficiencyDown('1.15', '−0.03', s.within['12w']!))
    expect(efficiency('declining', -0.03)).toContain('m per heartbeat')
    expect(efficiency('flat', -0.02)).toBe(s.efficiencyLevel('1.15', s.ago['12w']!))
  })

  it('says when last year only counts from the date the history starts', async () => {
    const { signalRows } = await import('../coachReadTabs')
    const s = t.analytics.cards.coachRead
    const volume = (since: string | null) =>
      signalRows({ tone: 'neutral', loadUp: false, signals: [{ key: 'volume', trend: 'improving', delta: 312, since }] }, '12w')[0]!.text
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

  // The Load tab's read is load, its case load and recovery.
  it('heads the Load read with the load headline and backs it with load', async () => {
    const loads = Array.from({ length: 60 }, (_, i) => ({ date: day(59 - i), acute: i < 50 ? 360 : 360 + (i - 49) * 20, chronic: 365 }))
    render(<AnalyticsClient data={{ ...data, loads }} today={TODAY} />)
    const coach = await screen.findByTestId('coach-read')
    expect(coach.getAttribute('data-tone')).toBe('warn')
    fireEvent.click(screen.getByTestId('coach-read-why'))
    const sheet = within(screen.getByRole('dialog'))
    const s = t.analytics.cards.coachRead
    expect(sheet.queryByText(s.headline.mixed('Easy pace', false, 'threshold and race predictions', true))).toBeNull()
    expect(screen.getByRole('dialog').textContent).toMatch(/Fatigue \d+/)
  })

  it('compares Year to date from where the history starts when that is partway through last year', async () => {
    const ytd = { ...data.ytd!, vsLastYear: { km: 1020, lastYearKm: 708, since: '2025-05-03' } }
    render(<AnalyticsClient data={{ ...data, ytd }} today={TODAY} />)
    await screen.findByTestId('form-card')
    await act(async () => screen.getByRole('tab', { name: t.analytics.tabs.volume }).click())
    await screen.findByTestId('weekly-card')
    // Last year's comparison is the Volume read's case; the year itself is Goals'.
    fireEvent.click(screen.getByTestId('coach-read-why'))
    expect(screen.getByRole('dialog').textContent).toContain(t.analytics.cards.coachRead.volumeSince('+312', 'May 3'))
  })
})

// Year to date is Goals' metric: Volume takes its figures and its words.
describe('Year to date on Volume', () => {
  async function renderBoth(ytd: NonNullable<AnalyticsBoardData['ytd']>, projection: { projectedYearKm: number } | null) {
    const { VolumeTab } = await import('../VolumeTab')
    const { YearView } = await import('@/components/goals/YearView')
    const { weekRows, weekWindow } = await import('../analyticsView')
    const window = weekWindow(TODAY, '12w')
    const rows = weekRows(weeks, [], window, TODAY)
    const year = Number(TODAY.slice(0, 4))
    const goal = render(
      <YearView
        today={TODAY}
        yearData={{
          year,
          totalDistanceKm: ytd.km,
          goals: { year, annualDistanceKm: ytd.goalKm ?? 0, targets: [] },
          pbs: [],
          upcomingRaces: [],
          projection: projection && { ...projection, weeklyRate: 26, weeklyNeeded: 44, status: 'behind', deltaKm: 0 },
          monthlyGoals: [],
          nextRaceSpotlight: null,
          predictions: [],
        }}
      />,
    )
    const goals = within(goal.container)
    const volume = within(render(<VolumeTab rows={rows} live onShift={() => {}} ytd={ytd} weeklyAvgKm={null} />).container)
    return { goals, volume }
  }

  // "Year to date · 1,394 km" over "243 km short of 2,000 at this pace".
  it('is a row that opens Goals, with its km and the verdict in Goals’ tone', async () => {
    const { goals, volume } = await renderBoth(data.ytd!, data.ytd!.projection)
    expect(volume.queryByTestId('ytd-card')).toBeNull()
    expect(volume.getByTestId('ytd-link').getAttribute('href')).toBe('/goals')
    expect(volume.getByTestId('ytd-km').textContent).toBe(`${t.analytics.cards.ytd.title} · 1,394 ${t.units.km}`)
    expect(volume.getByTestId('ytd-verdict').textContent).toBe(t.analytics.cards.ytd.shortOf('243', '2,000'))
    expect(volume.getByTestId('ytd-verdict').getAttribute('style')).toBe(goals.getByTestId('projection-verdict').getAttribute('style'))
    expect(goals.getByTestId('goal-card').textContent).toContain('1,394')
  })

  it('says a goal already reached as Goals does', async () => {
    const { goals, volume } = await renderBoth({ ...data.ytd!, km: 2120.4, projection: null }, null)
    expect(volume.getByTestId('ytd-verdict').textContent).toBe(t.goals.reached('120'))
    expect(goals.getByTestId('goal-card').textContent).toContain(t.goals.reached('120'))
  })
})

describe('the race prediction range (v4.8)', () => {
  it('prints each end the way its row prints its change', async () => {
    const { changeAmount } = await import('../PerformanceTab')
    const s = t.analytics.cards.predictions
    expect(s.range(changeAmount(33), changeAmount(557))).toBe('33 s–9:17')
    expect(s.slipped('All four', s.range(changeAmount(33), changeAmount(557)), '12 weeks')).toBe('All four slipped 33 s–9:17 over 12 weeks.')
  })
})

describe('Load trend and Recovery (v5.4)', () => {
  // Pinned like the board's other blocks: unpinned, the live window ends on the real date and loses the fixture's
  // first days above range from Oct 9.
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(`${TODAY}T12:00:00`))
  })
  afterAll(() => vi.useRealTimers())

  const nights = (n: number, hrv: (i: number) => number, rhr: (i: number) => number) =>
    Array.from({ length: n }, (_, i) => ({ date: day(n - 1 - i), hrv: hrv(i), restingHr: rhr(i) }))
  const wobble = (i: number) => [0, 2, -1, 3, -2, 1, -3, 2][i % 8]!
  const steady = nights(90, (i) => 58 + wobble(i), (i) => 46 + (i % 3) - 1)

  async function renderWith(extra: Partial<AnalyticsBoardData>) {
    render(<AnalyticsClient data={{ ...data, ...extra }} today={TODAY} />)
    await screen.findByTestId('form-card')
  }

  it('orders the Load cards coach read, Load, Form, Training status', async () => {
    await renderWith({ recovery: steady })
    const ids = [...document.querySelectorAll('[data-testid$="-card"], [data-testid="coach-read"]')].map((el) => el.getAttribute('data-testid'))
    expect(ids).toEqual(['coach-read', 'load-card', 'form-card', 'status-card'])
  })

  it('draws the load line 72 pt tall, spread over its height', async () => {
    await renderWith({})
    const card = screen.getByTestId('load-card')
    const svg = screen.getByTestId('load-mini')
    expect(svg.getAttribute('height')).toBe('72')
    expect(card.className).not.toContain('gap-2.5')
    expect(card.querySelector('[class*="-mt-"]')).toBeNull()
    const ys = [...svg.querySelectorAll('polygon, polyline')].flatMap((el) => el.getAttribute('points')!.split(' ').map((pt) => Number(pt.split(',')[1])))
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...ys)).toBeLessThanOrEqual(72)
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(72 * 0.75)
  })

  it('prints the load, its ratio and fitness a week, with their safe ranges', async () => {
    await renderWith({})
    expect(screen.getByTestId('load-trend-value').textContent).toBe('412')
    expect(screen.getByTestId('load-ratio').textContent).toBe('1.13')
    expect(screen.getByTestId('load-card').textContent).toContain(t.analytics.cards.loadTrend.ratioSafe(0.8, 1.3))
  })

  it('says the load is in range today in the coach read, and the days above it as earlier ones', async () => {
    const s = t.analytics.cards.loadTrend
    const loads = Array.from({ length: 60 }, (_, i) => ({ date: day(59 - i), acute: i >= 45 && i < 50 ? 500 : 412, chronic: 365 }))
    await renderWith({ loads })
    const sentence = s.steady(s.today).join('') + s.wentOver(5, 'Sep 16')
    expect(screen.getByTestId('coach-read-headline').textContent).toBe(sentence)
  })

  it('turns the load amber above the safe range', async () => {
    const loads = Array.from({ length: 60 }, (_, i) => ({ date: day(59 - i), acute: i < 50 ? 360 : 360 + (i - 49) * 20, chronic: 365 }))
    await renderWith({ loads })
    const value = screen.getByTestId('load-trend-value')
    expect(value.getAttribute('data-state')).toBe('above')
    expect(value.getAttribute('style')).toContain('var(--warn)')
    expect(screen.getByTestId('coach-read').getAttribute('data-tone')).toBe('warn')
  })

  it('reads resting HR in the Form card, inside its baseline', async () => {
    await renderWith({ recovery: steady.map((n) => ({ ...n, hrv: null })) })
    const row = screen.getByTestId('form-rhr')
    expect(row.textContent).toContain(t.analytics.cards.loadCompact.baseline(null, 45, 47))
    expect(row.textContent).toContain(t.analytics.cards.loadCompact.ok)
  })

  it('leaves the resting HR row out without enough nights', async () => {
    await renderWith({ recovery: steady.slice(-6) })
    expect(screen.queryByTestId('form-rhr')).toBeNull()
  })

  it('lets the coach read take a run of low HRV nights into account', async () => {
    const low = nights(90, (i) => (i >= 87 ? 44 : 58 + wobble(i)), (i) => (i >= 87 ? 51 : 46 + (i % 3) - 1))
    await renderWith({ recovery: low })
    expect(screen.getByTestId('coach-read').getAttribute('data-tone')).toBe('warn')
    expect(screen.getByTestId('coach-read-headline').textContent).toBe(t.analytics.cards.coachRead.load.dip)
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
    expect(paceAxis([265, 290, 335])).toMatchObject({ lo: 260, hi: 340, ticks: [260, 300, 340] })
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
      expect(ticks[0]).toBeLessThanOrEqual(range[0]!)
      expect(ticks[2]).toBeGreaterThanOrEqual(range[1]!)
      expect(ticks[1] % 5).toBe(0)
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
