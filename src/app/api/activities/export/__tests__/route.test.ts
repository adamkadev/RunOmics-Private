import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const { getTrainingWorkbook, requireOwner } = vi.hoisted(() => ({
  getTrainingWorkbook: vi.fn(),
  requireOwner: vi.fn(),
}))

vi.mock('@/application/usecases/GetTrainingWorkbook', () => ({
  getTrainingWorkbook,
  TRAINING_WORKBOOK_MIME: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}))

vi.mock('@/lib/ownerRoute', () => ({ requireOwner }))

const { GET } = await import('../route')

function request(token?: string): NextRequest {
  return {
    headers: new Headers(token ? { authorization: `Bearer ${token}` } : {}),
  } as unknown as NextRequest
}

describe('GET /api/activities/export', () => {
  beforeEach(() => {
    getTrainingWorkbook.mockReset()
    getTrainingWorkbook.mockResolvedValue(Buffer.from('xlsx'))
    requireOwner.mockReset()
    requireOwner.mockResolvedValue(null)
  })

  it('downloads the complete workbook without caching private data', async () => {
    const response = await GET(request('owner-token'))

    expect(response.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    expect(response.headers.get('content-disposition')).toContain('runomics-training-data.xlsx')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('xlsx')
  })

  it('refuses a caller who is not the owner', async () => {
    // The workbook's Athlete sheet carries weight, resting and max HR, age and
    // sex. Settings only shows the download behind `isOwner`, but the route
    // itself used to answer anyone who asked.
    requireOwner.mockResolvedValue(new Response('Unauthorized', { status: 401 }))

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(getTrainingWorkbook).not.toHaveBeenCalled()
  })

  it('checks authorization before doing the expensive work', async () => {
    // Building the workbook walks the entire activity history through exceljs.
    // An anonymous caller must not be able to make the server do that at all,
    // let alone in a loop.
    const order: string[] = []
    requireOwner.mockImplementation(async () => {
      order.push('auth')
      return new Response('Unauthorized', { status: 401 })
    })
    getTrainingWorkbook.mockImplementation(async () => {
      order.push('workbook')
      return Buffer.from('xlsx')
    })

    await GET(request())

    expect(order).toEqual(['auth'])
  })
})
