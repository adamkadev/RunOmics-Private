import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { recordClientError, listClientErrors, requireOwner } = vi.hoisted(() => ({
  recordClientError: vi.fn(),
  listClientErrors: vi.fn(),
  requireOwner: vi.fn(),
}))
vi.mock('@/application/usecases/ClientErrors', () => ({ recordClientError, listClientErrors }))
vi.mock('@/lib/ownerRoute', () => ({ requireOwner }))

const { GET, POST } = await import('../route')

let caller = 0

function post(body: string, ip = `10.9.${Math.floor(++caller / 250)}.${caller % 250}`) {
  return POST(new NextRequest('https://example.com/api/client-errors', { method: 'POST', headers: { 'x-forwarded-for': ip }, body }))
}

const REPORT = JSON.stringify({ message: 'TypeError: x is undefined', page: '/activities' })

describe('POST /api/client-errors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    recordClientError.mockResolvedValue({ at: '2026-10-27T08:00:00Z' })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps a report and answers an empty 204, never cached', async () => {
    const res = await post(REPORT)

    expect(res.status).toBe(204)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(recordClientError).toHaveBeenCalledWith(JSON.parse(REPORT))
  })

  it('answers 400 to a body that is not JSON, and to a report it will not keep', async () => {
    expect((await post('not json')).status).toBe(400)

    recordClientError.mockResolvedValue(null)
    expect((await post('{}')).status).toBe(400)
  })

  it('answers 413 to a body over 4 000 characters without reading it as a report', async () => {
    const res = await post(JSON.stringify({ message: 'x'.repeat(4_000) }))

    expect(res.status).toBe(413)
    expect(recordClientError).not.toHaveBeenCalled()
  })

  it('answers 429 once one address has sent 20 reports in a minute', async () => {
    const statuses = []
    for (let i = 0; i < 21; i++) statuses.push((await post(REPORT, '10.250.0.1')).status)

    expect(statuses.slice(0, 20).every((status) => status === 204)).toBe(true)
    expect(statuses[20]).toBe(429)
    expect(recordClientError).toHaveBeenCalledTimes(20)
  })

  it('answers 500 when the report cannot be kept', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    recordClientError.mockRejectedValue(new Error('Firestore is down'))

    expect((await post(REPORT)).status).toBe(500)
  })
})

describe('GET /api/client-errors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists the errors to the owner', async () => {
    requireOwner.mockResolvedValue(null)
    listClientErrors.mockResolvedValue([{ message: 'boom' }])

    const res = await GET(new NextRequest('https://example.com/api/client-errors'))

    expect(await res.json()).toEqual({ errors: [{ message: 'boom' }] })
  })

  it('answers with the owner guard’s refusal to anyone else', async () => {
    requireOwner.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

    const res = await GET(new NextRequest('https://example.com/api/client-errors'))

    expect(res.status).toBe(401)
    expect(listClientErrors).not.toHaveBeenCalled()
  })
})
