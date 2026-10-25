import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getTodayPlannedWorkout, sendPush, sent } = vi.hoisted(() => ({
  getTodayPlannedWorkout: vi.fn(),
  sendPush: vi.fn(),
  sent: new Set<string>(),
}))

vi.mock('@/application/usecases/GetPlannedWorkouts', () => ({ getTodayPlannedWorkout }))
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
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('announces a rest day', async () => {
    getTodayPlannedWorkout.mockResolvedValue(null)
    const { POST } = await routeIn('en')

    expect(await (await POST(request())).json()).toEqual({ sent: true, restDay: true })
    expect(sendPush).toHaveBeenCalledWith('training', 'Rest day', 'No session scheduled today - recovery day.')
  })

  it('names the session, its distance and its duration', async () => {
    getTodayPlannedWorkout.mockResolvedValue({ date: '2026-10-02', name: 'Strides 6 x 20s', distanceM: 8000, durationSecs: 2700 })
    const { POST } = await routeIn('en')

    await POST(request())
    expect(sendPush).toHaveBeenCalledWith('training', "Today's session", 'Strides 6 x 20s (8.0 km · 45 min)')
  })

  it('sends from the cron in the 08:xx Paris hour only, once a day', async () => {
    getTodayPlannedWorkout.mockResolvedValue(null)
    const { GET, POST } = await routeIn('en')

    vi.useFakeTimers({ now: new Date('2026-01-15T06:20:00Z'), toFake: ['Date'] })
    expect(await (await GET(cronRequest())).json()).toEqual({ skipped: 'not 08:xx in Paris' })

    vi.setSystemTime(new Date('2026-01-15T07:20:00Z'))
    expect(await (await GET(cronRequest())).json()).toEqual({ sent: true, restDay: true })
    expect(await (await POST(request())).json()).toEqual({ skipped: 'already sent today' })
    expect(sendPush).toHaveBeenCalledTimes(1)
  })

  it('speaks the deployment’s language', async () => {
    getTodayPlannedWorkout.mockResolvedValue(null)
    const { POST: restDay } = await routeIn('fr')
    await restDay(request())
    expect(sendPush).toHaveBeenLastCalledWith('training', 'Jour de repos', 'Aucune séance prévue aujourd’hui : place à la récupération.')

    getTodayPlannedWorkout.mockResolvedValue({ date: '2026-10-02', name: 'Footing', distanceM: 8000, durationSecs: 2700 })
    sent.clear()
    const { POST: session } = await routeIn('fr')
    await session(request())
    expect(sendPush).toHaveBeenLastCalledWith('training', 'Séance du jour', 'Footing (8,0 km · 45 min)')
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
      if (!/sendPush(?:es)?\(/.test(source)) continue
      // A push's title or body written as a string literal, rather than read from t.notifications.
      if (/sendPush\([^,]+,\s*['"`]|title:\s*['"`]|body:\s*['"`]/.test(source)) offenders.push(dir)
    }
    expect(offenders).toEqual([])
  })
})
