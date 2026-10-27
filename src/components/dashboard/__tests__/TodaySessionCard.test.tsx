import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HeroWorkoutView } from '@/components/plan/planWorkoutView'
import { t } from '@/i18n'
import { forgetCoachWords } from '@/components/coaching/useCoachWords'
import { TodaySessionCard } from '../TodaySessionCard'
import { firstSentence } from '../TodayCoachLine'
import type { SessionCard } from '../nextSession'

const STRIDES = [
  { kind: 'effort' as const, minutes: 54, seconds: 3_213 },
  ...Array.from({ length: 6 }, (_, i) => [
    { kind: 'effort' as const, minutes: 1, seconds: 20, rep: i + 1 },
    { kind: 'recovery' as const, minutes: 1, seconds: 60, rep: i + 1 },
  ]).flat(),
]
const EASY: HeroWorkoutView = { key: 'garmin:2026-10-20:Easy run', title: 'Easy run', type: 'Base', duration: { seconds: 3_600, estimated: false }, distanceM: 10_000, activityId: null, target: null, structure: null, hr: null }

function card(overrides: Partial<SessionCard> = {}): SessionCard {
  return { date: '2026-10-20', eyebrow: 'Tomorrow · Tue 20', title: 'Easy run', km: '10', detail: '1:00 h · ≤ 158 bpm', workout: EASY, phase: 'Base', href: '/plan?date=2026-10-20', ...overrides }
}

describe('TodaySessionCard', () => {
  it('is one link to Plan with the day selected, and nothing to send to a watch', () => {
    render(<TodaySessionCard card={card()} />)

    const link = screen.getByTestId('session-card')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/plan?date=2026-10-20')
    expect(link).toHaveTextContent('Tomorrow · Tue 20')
    // No phase label and no "Open in Plan": the card is the tap target.
    expect(link).not.toHaveTextContent('Base')
    expect(screen.getByTestId('session-detail').textContent).toBe(`10 ${t.units.km} · 1:00 h · ≤ 158 bpm`)
    expect(link.textContent).not.toMatch(/watch/i)
    expect(link.querySelector('button')).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('heads the card with the day in the accent', () => {
    render(<TodaySessionCard card={card()} />)
    const eyebrow = screen.getByText('Tomorrow · Tue 20')
    expect(eyebrow.className).toContain('text-accent-text')
    expect(eyebrow.className).toContain('uppercase')
  })

  it('draws the bar only for a session built of steps', () => {
    const { unmount } = render(<TodaySessionCard card={card({ workout: { ...EASY, structure: STRIDES } })} />)
    expect(screen.getByTestId('today-structure-bar').children).toHaveLength(7)
    unmount()

    render(<TodaySessionCard card={card()} />)
    expect(screen.queryByTestId('today-structure-bar')).toBeNull()
  })

  it('keeps an older, longer name to two lines', () => {
    render(<TodaySessionCard card={card({ title: "Répétitions allure d'objectif - 4x3'@4:24" })} />)
    expect(screen.getByText("Répétitions allure d'objectif - 4x3'@4:24").className).toContain('line-clamp-2')
  })

  it('says what a warm forecast at the usual hour will cost, only when there is one', () => {
    const { rerender } = render(<TodaySessionCard card={card({ heat: { apparentTempC: 28, hour: 18, costSecPerKm: 15 } })} />)
    expect(screen.getByTestId('session-heat')).toHaveTextContent(t.heatAhead.line(28, t.heatAhead.time(18), 15))

    rerender(<TodaySessionCard card={card()} />)
    expect(screen.queryByTestId('session-heat')).toBeNull()
  })

  describe('the coach’s line', () => {
    const COACH: HeroWorkoutView = { ...EASY, key: 'run-walk-1', state: 'prescribed', title: 'Footing · 3 × 3′' }
    const serve = (description: string, notes: string[] = []) => {
      const fetch = vi.fn(async () =>
        Response.json({ available: true, block: { name: 'Reprise', focus: '' }, weeks: [], sessions: { 'run-walk-1': { description, notes } } }),
      )
      vi.stubGlobal('fetch', fetch)
      return fetch
    }

    afterEach(() => {
      forgetCoachWords()
      vi.unstubAllGlobals()
    })

    it('reads the first sentence of the session’s description, in two lines at most', async () => {
      serve('Course très lente en alternance avec la marche : 3 minutes de course, 1 minute de marche. Tu dois pouvoir parler.')
      render(<TodaySessionCard card={card({ workout: COACH })} />)

      const line = await screen.findByTestId('session-coach-line')
      expect(line.textContent).toBe('Course très lente en alternance avec la marche : 3 minutes de course, 1 minute de marche.')
      expect(line.className).toContain('line-clamp-2')
      expect(screen.getAllByRole('link')).toHaveLength(1)
    })

    it('falls back on the first note when the description only repeats the title', async () => {
      serve('Footing 3 × 3′', ['Au moindre doute, passe à la marche.'])
      render(<TodaySessionCard card={card({ workout: COACH })} />)
      expect(await screen.findByTestId('session-coach-line')).toHaveTextContent('Au moindre doute, passe à la marche.')
    })

    it('asks for nothing for a session only the watch planned', () => {
      const fetch = serve('Course très lente.')
      render(<TodaySessionCard card={card()} />)
      expect(fetch).not.toHaveBeenCalled()
      expect(screen.queryByTestId('session-coach-line')).toBeNull()
    })

    it('cuts at the end of a sentence, not at a pace’s colon or a decimal point', () => {
      expect(firstSentence('Allure 6:30 /km, 2.5 km. Puis marche.')).toBe('Allure 6:30 /km, 2.5 km.')
      expect(firstSentence('Sans point final')).toBe('Sans point final')
    })
  })
})
