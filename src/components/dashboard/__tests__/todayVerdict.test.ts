import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'
import { todayPlanOf, todayVerdict, yesterdayKind } from '../todayVerdict'

const v = t.dashboard.todayHero.verdict

describe('todayVerdict (v4.17.1)', () => {
  it('says what to do with today first, then why and what it gives', () => {
    const verdict = todayVerdict({ tone: 'hold', today: 'rest', yesterday: 'long_run', next: { date: '2026-09-29', inDays: 1, kind: 'threshold' } })
    expect(verdict).toEqual({
      headline: v.headline.rest.hold,
      body: `${v.yesterdayInLegs(v.kind.long_run)} ${v.gain.restPaysOff(v.tomorrow, v.kind.threshold)}`,
    })
  })

  it('names the next session by its weekday when it is not tomorrow', () => {
    const { body } = todayVerdict({ tone: 'hold', today: 'rest', yesterday: null, next: { date: '2026-09-29', inDays: 2, kind: 'threshold' } })
    // 2026-09-29 is a Tuesday.
    expect(body).toBe(`${v.why.hold} ${v.gain.restPaysOff('Tuesday', v.kind.threshold)}`)
  })

  it('only blames yesterday for a hard run, and never on a green-light day', () => {
    expect(todayVerdict({ tone: 'hold', today: 'easy', yesterday: 'easy', next: null }).body).toBe(`${v.why.hold} ${v.gain.easyHold}`)
    expect(todayVerdict({ tone: 'go', today: 'quality', yesterday: 'threshold', next: null }).body).toBe(`${v.why.go} ${v.gain.quality.go}`)
    expect(todayVerdict({ tone: 'build', today: 'easy', yesterday: 'long_run', next: null }).body).toBe(`${v.yesterdayInLegs(v.kind.long_run)} ${v.gain.easyGo}`)
  })

  it('reads a building day as on plan, not as fatigue to settle', () => {
    expect(todayVerdict({ tone: 'build', today: 'easy', yesterday: null, next: null })).toEqual({
      headline: v.headline.easy.build,
      body: `${v.why.build} ${v.gain.easyGo}`,
    })
  })

  it('points an easy day at the next quality session, not at another easy one', () => {
    const quality = { date: '2026-09-30', inDays: 2, kind: 'vo2max' as const }
    expect(todayVerdict({ tone: 'caution', today: 'easy', yesterday: null, next: quality }).body).toBe(`${v.why.caution} ${v.gain.easyLands('Wednesday', v.kind.vo2max)}`)
    expect(todayVerdict({ tone: 'caution', today: 'easy', yesterday: null, next: { ...quality, kind: 'easy' } }).body).toBe(`${v.why.caution} ${v.gain.easySettle}`)
  })

  it('never prints a figure', () => {
    for (const tone of ['go', 'build', 'caution', 'hold'] as const) {
      for (const today of ['rest', 'easy', 'quality', 'race', 'done'] as const) {
        const { headline, body } = todayVerdict({ tone, today, yesterday: 'tempo', next: { date: '2026-10-01', inDays: 3, kind: 'threshold' } })
        expect(`${headline} ${body}`, `${tone} ${today}`).not.toMatch(/\d/)
        expect(body.trim(), `${tone} ${today}`).not.toBe('')
      }
    }
  })
})

describe('todayPlanOf', () => {
  it('reads today by the row state and the planned type', () => {
    expect(todayPlanOf('done', 'Threshold')).toBe('done')
    expect(todayPlanOf('rest', null)).toBe('rest')
    expect(todayPlanOf('planned', 'Base')).toBe('easy')
    expect(todayPlanOf('planned', null)).toBe('easy')
    expect(todayPlanOf('planned', 'Threshold')).toBe('quality')
    expect(todayPlanOf('planned', 'Race')).toBe('race')
  })
})

describe('yesterdayKind', () => {
  it('reads a Base run on a long-run day as that long run', () => {
    expect(yesterdayKind({ type: 'Base' }, 'long_run')).toBe('long_run')
    expect(yesterdayKind({ type: 'Base' }, null)).toBe('easy')
    expect(yesterdayKind({ type: 'Anaerobic' }, 'long_run')).toBe('anaerobic')
    expect(yesterdayKind(null, 'long_run')).toBeNull()
  })
})
