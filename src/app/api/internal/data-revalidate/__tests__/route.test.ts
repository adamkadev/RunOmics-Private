import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { revalidateTag, revalidatePath, after, dataRevalidationTag, warmPages } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  after: vi.fn(),
  dataRevalidationTag: vi.fn(),
  warmPages: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidateTag, revalidatePath }))
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/server')>()), after }))
vi.mock('@/application/usecases/DataRevalidation', () => ({ dataRevalidationTag }))
vi.mock('../warmPages', () => ({ warmPages }))

const { POST } = await import('../route')

const SECRET = 'test-secret'

function request(secret: string | null = SECRET) {
  return new NextRequest('https://example.com/api/internal/data-revalidate', {
    method: 'POST',
    headers: secret === null ? {} : { 'x-internal-secret': secret },
  })
}

describe('POST /api/internal/data-revalidate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', SECRET)
    dataRevalidationTag.mockReturnValue('data:abc')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('expires the data tag at once, the whole layout too, then warms the pages after answering', async () => {
    const res = await POST(request())

    expect(await res.json()).toEqual({ revalidated: true })
    expect(revalidateTag).toHaveBeenCalledWith('data:abc', { expire: 0 })
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(after).toHaveBeenCalledTimes(1)
    expect(warmPages).not.toHaveBeenCalled()

    after.mock.calls[0]![0]()
    expect(warmPages).toHaveBeenCalledWith('https://example.com', expect.any(Function))
  })

  it('answers 409 on a deployment that serves the data its build cloned', async () => {
    dataRevalidationTag.mockReturnValue(null)

    const res = await POST(request())

    expect(res.status).toBe(409)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('refuses a caller without the internal secret', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect((await POST(request('wrong'))).status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
