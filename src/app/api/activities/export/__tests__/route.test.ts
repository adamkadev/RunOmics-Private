import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getTrainingWorkbook } = vi.hoisted(() => ({
  getTrainingWorkbook: vi.fn(),
}))

vi.mock('@/application/usecases/GetTrainingWorkbook', () => ({
  getTrainingWorkbook,
  TRAINING_WORKBOOK_MIME: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}))

const { GET } = await import('../route')

describe('GET /api/activities/export', () => {
  beforeEach(() => {
    getTrainingWorkbook.mockReset()
    getTrainingWorkbook.mockResolvedValue(Buffer.from('xlsx'))
  })

  it('downloads the complete workbook without caching private data', async () => {
    const response = await GET()

    expect(response.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    expect(response.headers.get('content-disposition')).toContain('runomics-training-data.xlsx')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('xlsx')
  })
})
