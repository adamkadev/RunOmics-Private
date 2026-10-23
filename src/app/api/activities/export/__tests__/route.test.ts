import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  loadTrainingWorkbookData: vi.fn(),
  writeTrainingWorkbook: vi.fn(),
  buildActivitiesCsv: vi.fn(),
  requireOwner: vi.fn(),
}))

vi.mock('@/application/usecases/GetTrainingWorkbook', () => ({
  loadTrainingWorkbookData: mocks.loadTrainingWorkbookData,
  writeTrainingWorkbook: mocks.writeTrainingWorkbook,
  buildActivitiesCsv: mocks.buildActivitiesCsv,
  TRAINING_WORKBOOK_MIME: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ACTIVITIES_CSV_MIME: 'text/csv; charset=utf-8',
}))

vi.mock('@/lib/ownerRoute', () => ({ requireOwner: mocks.requireOwner }))

const { GET } = await import('../route')

function request(token?: string, format?: string): NextRequest {
  const url = new URL(`http://localhost/api/activities/export${format ? `?format=${format}` : ''}`)
  return {
    headers: new Headers(token ? { authorization: `Bearer ${token}` } : {}),
    nextUrl: url,
  } as unknown as NextRequest
}

describe('GET /api/activities/export', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset()
    mocks.loadTrainingWorkbookData.mockResolvedValue({ notesAvailable: true })
    mocks.writeTrainingWorkbook.mockResolvedValue(Buffer.from('xlsx'))
    mocks.buildActivitiesCsv.mockReturnValue('activity_id,comment\r\n')
    mocks.requireOwner.mockResolvedValue(null)
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

  it('downloads the activities as CSV on request', async () => {
    const response = await GET(request('owner-token', 'csv'))

    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(response.headers.get('content-disposition')).toContain('runomics-activities.csv')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.text()).toBe('activity_id,comment\r\n')
    expect(mocks.writeTrainingWorkbook).not.toHaveBeenCalled()
  })

  it('refuses a format it does not know', async () => {
    const response = await GET(request('owner-token', 'pdf'))

    expect(response.status).toBe(400)
    expect(mocks.loadTrainingWorkbookData).not.toHaveBeenCalled()
  })

  it.each(['xlsx', 'csv'])('flags a %s export made without the notes store', async (format) => {
    mocks.loadTrainingWorkbookData.mockResolvedValue({ notesAvailable: false })

    const response = await GET(request('owner-token', format))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-runomics-notes-unavailable')).toBe('true')
  })

  it('does not flag a complete export', async () => {
    const response = await GET(request('owner-token', 'csv'))

    expect(response.headers.get('x-runomics-notes-unavailable')).toBeNull()
  })

  it('refuses a caller who is not the owner', async () => {
    // The workbook's Athlete sheet carries weight, resting and max HR, age and sex.
    mocks.requireOwner.mockResolvedValue(new Response('Unauthorized', { status: 401 }))

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.loadTrainingWorkbookData).not.toHaveBeenCalled()
  })

  it('checks authorization before doing the expensive work', async () => {
    // Building the workbook walks the entire activity history through exceljs.
    const order: string[] = []
    mocks.requireOwner.mockImplementation(async () => {
      order.push('auth')
      return new Response('Unauthorized', { status: 401 })
    })
    mocks.loadTrainingWorkbookData.mockImplementation(async () => {
      order.push('load')
      return { notesAvailable: true }
    })

    await GET(request())

    expect(order).toEqual(['auth'])
  })
})
