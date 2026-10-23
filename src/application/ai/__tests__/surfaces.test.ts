import { describe, expect, it, vi } from 'vitest'

const reads = vi.hoisted(() => ({
  getRecords: vi.fn(async () => []),
  getTrainingStatus: vi.fn(async () => null),
}))

vi.mock('@/application/usecases/GetRecords', () => ({
  getRecords: reads.getRecords,
  getMostRecentRecord: () => null,
  getQualifiedEffortsByActivityId: () => ({}),
}))
vi.mock('@/application/usecases/GetTrainingStatus', () => ({ getTrainingStatus: reads.getTrainingStatus }))
vi.mock('@/application/usecases/GetRunVerdictInsight', () => ({ getRunVerdictContexts: () => [] }))
vi.mock('@/application/usecases/GetShoeStats', () => ({ getShoeStats: () => [] }))
// Never reached below; mocked so the test does not load Firestore and the coach just to import them.
vi.mock('@/application/usecases/GetTodayInsight', () => ({ buildTodayContext: vi.fn(), todayInsightSession: vi.fn() }))
vi.mock('@/application/usecases/GetPbCelebrationInsight', () => ({ buildPbCelebrationContext: vi.fn() }))
vi.mock('@/application/usecases/GetShoeDetail', () => ({ getShoeDetail: vi.fn() }))

const { insightSurfaces } = await import('../surfaces')

describe('insightSurfaces', () => {
  it('writes only cards a page displays', () => {
    expect(Object.keys(insightSurfaces())).toEqual(['runVerdicts', 'today', 'pbCelebration', 'shoeVerdicts'])
  })

  it('reads training status and records once a pass, however many surfaces share them', async () => {
    const surfaces = insightSurfaces()

    await surfaces.runVerdicts()
    expect(await surfaces.today()).toBe('no training status')
    expect(await surfaces.today()).toBe('no training status')
    expect(await surfaces.pbCelebration(new Date('2026-09-24T12:00:00'))).toBe('no fresh record')

    expect(reads.getRecords).toHaveBeenCalledTimes(1)
    expect(reads.getTrainingStatus).toHaveBeenCalledTimes(1)
  })

  it('reads them afresh for the next pass: load and analytics move with the date, and a warm instance outlives a day', async () => {
    reads.getRecords.mockClear()

    await insightSurfaces().runVerdicts()
    await insightSurfaces().runVerdicts()

    expect(reads.getRecords).toHaveBeenCalledTimes(2)
  })
})
