import { describe, expect, it } from 'vitest'
import { generatedCount, nextPassStatus, shouldAlert, type AiPassStatus, type PassReport } from '../passStatus'

function report(overrides: Partial<PassReport> = {}): PassReport {
  return {
    freshVerdicts: { generated: 0 },
    today: { generated: false },
    pbCelebration: { generated: false },
    shoeVerdicts: {},
    runVerdicts: { generated: 0 },
    missed: 0,
    closedModels: [],
    ...overrides,
  }
}

const IDLE = report({ missed: 2, closedModels: [{ model: 'gemini-3.8-flash', reason: 'http 404: not found' }] })

function nights(...dates: string[]): AiPassStatus | null {
  return dates.reduce<AiPassStatus | null>((previous, date) => {
    const next = nextPassStatus(IDLE, previous, new Date(`${date}T01:30:00Z`))
    return shouldAlert(next) ? { ...next, alerted: true } : next
  }, null)
}

describe('generatedCount', () => {
  it('adds the verdicts, the cards and the shoe verdicts written', () => {
    expect(
      generatedCount(
        report({
          freshVerdicts: { generated: 1 },
          runVerdicts: { generated: 4 },
          today: { generated: true },
          shoeVerdicts: { pegasus: 'generated', vomero: 'unchanged' },
        })
      )
    ).toBe(7)
  })
})

describe('nextPassStatus', () => {
  it('keeps the counts and the closed models of the pass', () => {
    const status = nextPassStatus(IDLE, null, new Date('2026-10-27T01:30:00Z'))

    expect(status).toEqual({
      at: '2026-10-27T01:30:00.000Z',
      generated: 0,
      missed: 2,
      closedModels: [{ model: 'gemini-3.8-flash', reason: 'http 404: not found' }],
      idleDays: ['2026-10-27'],
      alerted: false,
    })
  })

  it('counts several idle passes in one night as one night', () => {
    const status = nights('2026-10-25', '2026-10-25', '2026-10-26', '2026-10-26')

    expect(status?.idleDays).toEqual(['2026-10-25', '2026-10-26'])
    expect(status && shouldAlert(status)).toBe(false)
  })

  it('alerts on the third idle night, and only once', () => {
    const third = nextPassStatus(IDLE, nights('2026-10-25', '2026-10-26'), new Date('2026-10-27T01:30:00Z'))
    expect(shouldAlert(third)).toBe(true)

    const fourth = nextPassStatus(IDLE, nights('2026-10-25', '2026-10-26', '2026-10-27'), new Date('2026-10-28T01:30:00Z'))
    expect(fourth.idleDays).toHaveLength(4)
    expect(shouldAlert(fourth)).toBe(false)
  })

  it('starts again once a pass writes anything', () => {
    const status = nextPassStatus(report({ missed: 1, today: { generated: true } }), nights('2026-10-25', '2026-10-26', '2026-10-27'), new Date())

    expect(status).toMatchObject({ generated: 1, idleDays: [], alerted: false })
  })

  it('does not count a pass with nothing left to write as idle', () => {
    const status = nextPassStatus(report(), nights('2026-10-25', '2026-10-26'), new Date('2026-10-27T01:30:00Z'))

    expect(status).toMatchObject({ idleDays: [], alerted: false })
  })
})
