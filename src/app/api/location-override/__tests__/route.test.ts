import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getLocationOverride } = vi.hoisted(() => ({ getLocationOverride: vi.fn() }))
vi.mock('@/infrastructure/repositories/JsonLocationOverrideRepository', () => ({ getLocationOverride }))
vi.mock('@/application/usecases/LoadData', () => ({ loadData: vi.fn(async () => {}) }))

const { GET } = await import('../route')

const get = (query: string) => GET(new NextRequest(`https://example.com/api/location-override${query}`))

describe('GET /api/location-override', () => {
  beforeEach(() => {
    getLocationOverride.mockReset()
  })

  it('answers the name the athlete gave a place, or null', async () => {
    getLocationOverride.mockReturnValueOnce('Home loop').mockReturnValueOnce(null)

    expect(await (await get('?name=Riverside')).json()).toEqual({ name: 'Home loop' })
    expect(await (await get('?name=Old%20Town')).json()).toEqual({ name: null })
  })

  it('answers 400 without a name, or with one over 120 characters', async () => {
    expect((await get('')).status).toBe(400)
    expect((await get(`?name=${'x'.repeat(121)}`)).status).toBe(400)
    expect(getLocationOverride).not.toHaveBeenCalled()
  })
})
