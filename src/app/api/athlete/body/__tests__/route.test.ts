import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse, type NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ requireOwner: vi.fn(), getAthleteProfile: vi.fn() }))
vi.mock('@/lib/ownerRoute', () => ({ requireOwner: mocks.requireOwner }))
vi.mock('@/infrastructure/repositories/JsonAthleteRepository', () => ({ getAthleteProfile: mocks.getAthleteProfile }))
vi.mock('@/application/usecases/LoadData', () => ({ loadData: async () => {} }))

const { GET } = await import('../route')

const request = { headers: new Headers() } as unknown as NextRequest

describe('GET /api/athlete/body', () => {
  beforeEach(() => {
    mocks.requireOwner.mockReset().mockResolvedValue(null)
    mocks.getAthleteProfile.mockReset().mockReturnValue({ heightCm: 178, weightKg: 70, lthrBpm: 179 })
  })

  it('answers the owner with height and weight only, never cached', async () => {
    const response = await GET(request)
    expect(await response.json()).toEqual({ heightCm: 178, weightKg: 70 })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('answers null for a value Garmin does not have', async () => {
    mocks.getAthleteProfile.mockReturnValue({})
    expect(await (await GET(request)).json()).toEqual({ heightCm: null, weightKg: null })
  })

  it('passes on the owner guard\'s refusal without reading the profile', async () => {
    mocks.requireOwner.mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    const response = await GET(request)
    expect(response.status).toBe(403)
    expect(mocks.getAthleteProfile).not.toHaveBeenCalled()
  })
})
