import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getDailySession, lastJobRun, sendPush, sent } = vi.hoisted(() => ({
  getDailySession: vi.fn(),
  lastJobRun: vi.fn(),
  sendPush: vi.fn(),
  sent: new Set<string>(),
}))

vi.mock('@/application/usecases/GetDailySession', () => ({ getDailySession }))
vi.mock('@/application/usecases/JobEvents', () => ({ lastJobRun }))
vi.mock('@/lib/sendPushNotification', () => ({ sendPush, sendPushes: vi.fn() }))
vi.mock('@/application/usecases/SendScheduledPush', () => ({
  sendOncePer: async (_push: string, key: string, send: () => Promise<void>) => {
    if (sent.has(key)) return false
    sent.add(key)
    await send()
    return true
  },
}))

const SECRET = 'test-secret'
const CRON_SECRET = 'cron-secret'

function request() {
  return new NextRequest('https://example.com/api/internal/daily-session', {
    method: 'POST',
    headers: { 'x-internal-secret': SECRET },
  })
}

function cronRequest() {
  return new NextRequest('https://example.com/api/internal/daily-session', {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  })
}

/** The locale is read once, at import: each case loads the route under its own. */
async function routeIn(locale: 'en' | 'fr') {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_LOCALE', locale)
  return import('../route')
}

describe('POST /api/internal/daily-session', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', SECRET)
    vi.stubEnv('CRON_SECRET', CRON_SECRET)
    vi.clearAllMocks()
    sent.clear()
    sendPush.mockResolvedValue(undefined)
    lastJobRun.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('announces a rest day', async () => {
    getDailySession.mockResolvedValue({ workout: null, source: null })
    const { POST } = await routeIn('en')

    expect(await (await POST(request())).json()).toEqual({ sent: true, restDay: true, source: null })
    expect(sendPush).toHaveBeenCalledWith('training', {
      title: 'Rest day',
      body: 'No session scheduled today - recovery day.',
      link: '/plan',
      tag: 'daily-session',
    })
  })

  it('names the session, its distance and its duration', async () => {
    getDailySession.mockResolvedValue({ workout: { date: '2026-10-02', name: 'Strides 6 x 20s', distanceM: 8000, durationSecs: 2700 }, source: 'garmin' })
    const { POST } = await routeIn('en')

    await POST(request())
    expect(sendPush).toHaveBeenCalledWith('training', {
      title: "Today's session",
      body: 'Strides 6 x 20s (8.0 km · 45 min)',
      link: '/plan',
      tag: 'daily-session',
    })
  })

  it('sends from the cron in the 08:xx Paris hour only, once a day', async () => {
    getDailySession.mockResolvedValue({ workout: null, source: null })
    const { GET, POST } = await routeIn('en')

    vi.useFakeTimers({ now: new Date('2026-01-15T06:20:00Z'), toFake: ['Date'] })
    expect(await (await GET(cronRequest())).json()).toEqual({ skipped: 'not 08:xx in Paris' })

    vi.setSystemTime(new Date('2026-01-15T07:20:00Z'))
    expect(await (await GET(cronRequest())).json()).toEqual({ sent: true, restDay: true, source: null })
    expect(await (await POST(request())).json()).toEqual({ skipped: 'already sent today' })
    expect(sendPush).toHaveBeenCalledTimes(1)
  })

  it('sends from the summer 07:xx UTC cron when the 08:xx Paris run failed, and only then', async () => {
    getDailySession.mockResolvedValue({ workout: null, source: null })
    const { GET } = await routeIn('en')
    vi.useFakeTimers({ now: new Date('2026-07-15T07:00:05Z'), toFake: ['Date'] })

    lastJobRun.mockResolvedValue({ at: '2026-07-15T06:00:03Z', route: 'daily-session', trigger: 'cron', outcome: 'sent', status: 200 })
    expect(await (await GET(cronRequest())).json()).toEqual({ skipped: 'not 08:xx in Paris' })

    lastJobRun.mockResolvedValue({ at: '2026-07-15T06:00:03Z', route: 'daily-session', trigger: 'cron', outcome: 'error', status: 500, error: 'Error' })
    expect(await (await GET(cronRequest())).json()).toEqual({ sent: true, restDay: true, source: null })
  })

  it('says nothing on a morning with no plan within a week either way', async () => {
    getDailySession.mockResolvedValue(null)
    const { POST } = await routeIn('en')

    expect(await (await POST(request())).json()).toEqual({ skipped: 'nothing planned within a week' })
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('speaks the deployment’s language', async () => {
    getDailySession.mockResolvedValue({ workout: null, source: null })
    const { POST: restDay } = await routeIn('fr')
    await restDay(request())
    expect(sendPush).toHaveBeenLastCalledWith('training', expect.objectContaining({ title: 'Jour de repos', body: 'Aucune séance prévue aujourd’hui : place à la récupération.' }))

    getDailySession.mockResolvedValue({ workout: { date: '2026-10-02', name: 'Footing', distanceM: 8000, durationSecs: 2700 }, source: 'coach' })
    sent.clear()
    const { POST: session } = await routeIn('fr')
    await session(request())
    expect(sendPush).toHaveBeenLastCalledWith('training', expect.objectContaining({ title: 'Séance du jour', body: 'Footing (8,0 km · 45 min)' }))
  })
})

describe('every push', () => {
  const routes = path.join(process.cwd(), 'src/app/api/internal')

  it('takes its words from the locale, never from an English literal', () => {
    const offenders: string[] = []
    for (const dir of fs.readdirSync(routes)) {
      const file = path.join(routes, dir, 'route.ts')
      if (!fs.existsSync(file)) continue
      const source = fs.readFileSync(file, 'utf-8')
      if (!/send(?:Ops)?Push(?:es)?\(/.test(source)) continue
      // A push's title or body written as a string literal, rather than read from the locale.
      if (/sendPush\([^,]+,\s*['"`]|sendOpsPush\(\s*['"`]|title:\s*['"`]|body:\s*['"`]/.test(source)) offenders.push(dir)
    }
    expect(offenders).toEqual([])
  })
})
