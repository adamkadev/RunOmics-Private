import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getTodayPlannedWorkout, sendPushToAllDevices } = vi.hoisted(() => ({
  getTodayPlannedWorkout: vi.fn(),
  sendPushToAllDevices: vi.fn(),
}))

vi.mock('@/application/usecases/GetPlannedWorkouts', () => ({ getTodayPlannedWorkout }))
vi.mock('@/lib/sendPushNotification', () => ({ sendPushToAllDevices, sendPushesToAllDevices: vi.fn() }))

const SECRET = 'test-secret'

function request() {
  return new NextRequest('https://example.com/api/internal/daily-session', {
    method: 'POST',
    headers: { 'x-internal-secret': SECRET },
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
    vi.clearAllMocks()
    sendPushToAllDevices.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('announces a rest day', async () => {
    getTodayPlannedWorkout.mockResolvedValue(null)
    const { POST } = await routeIn('en')

    expect(await (await POST(request())).json()).toEqual({ sent: true, restDay: true })
    expect(sendPushToAllDevices).toHaveBeenCalledWith('Rest day', 'No session scheduled today - recovery day.')
  })

  it('names the session, its distance and its duration', async () => {
    getTodayPlannedWorkout.mockResolvedValue({ date: '2026-10-02', name: 'Strides 6 x 20s', distanceM: 8000, durationSecs: 2700 })
    const { POST } = await routeIn('en')

    await POST(request())
    expect(sendPushToAllDevices).toHaveBeenCalledWith("Today's session", 'Strides 6 x 20s (8.0 km · 45 min)')
  })

  // Lamiaa's deployment is French, and got "Rest day / No session scheduled today" in English.
  it('speaks the deployment’s language', async () => {
    getTodayPlannedWorkout.mockResolvedValue(null)
    const { POST: restDay } = await routeIn('fr')
    await restDay(request())
    expect(sendPushToAllDevices).toHaveBeenLastCalledWith('Jour de repos', 'Aucune séance prévue aujourd’hui : place à la récupération.')

    getTodayPlannedWorkout.mockResolvedValue({ date: '2026-10-02', name: 'Footing', distanceM: 8000, durationSecs: 2700 })
    const { POST: session } = await routeIn('fr')
    await session(request())
    expect(sendPushToAllDevices).toHaveBeenLastCalledWith('Séance du jour', 'Footing (8,0 km · 45 min)')
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
      if (!/sendPush(?:es)?ToAllDevices\(/.test(source)) continue
      // A push's title or body written as a string literal, rather than read from t.notifications.
      if (/sendPushToAllDevices\(\s*['"`]|title:\s*['"`]|body:\s*['"`]/.test(source)) offenders.push(dir)
    }
    expect(offenders).toEqual([])
  })
})
