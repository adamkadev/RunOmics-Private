import { test, expect } from '@playwright/test'

/**
 * The API surface against the production build, with no credentials at all -
 * the position of any visitor. None of this needs a page, so these tests use
 * Playwright's request context directly rather than ./fixtures.
 *
 * The e2e build configures neither FIREBASE_PROJECT_ID nor
 * INTERNAL_NOTIFY_SECRET, so owner routes answer 503 and internal routes 401.
 * What must hold either way is that nothing is served: the assertions are on
 * "not a success", plus the codes the routes are documented to return.
 */

test('the activity list never carries route geometry', async ({ request }) => {
  const response = await request.get('/api/activities?limit=50')
  expect(response.status()).toBe(200)

  const body = await response.json()
  const activities: Record<string, unknown>[] = body.items
  expect(activities.length).toBeGreaterThan(0)
  for (const activity of activities) {
    expect(activity).not.toHaveProperty('route')
    expect(activity).not.toHaveProperty('polyline')
  }
})

test('the training workbook is never served without the owner token', async ({ request }) => {
  const anonymous = await request.get('/api/activities/export')
  const forged = await request.get('/api/activities/export', {
    headers: { authorization: 'Bearer not-a-real-token' },
  })

  for (const response of [anonymous, forged]) {
    expect([401, 403, 503]).toContain(response.status())
    expect(response.headers()['content-type'] ?? '').not.toContain('spreadsheet')
  }
})

test('the sync cannot be dispatched without the owner token', async ({ request }) => {
  const response = await request.post('/api/sync/dispatch')
  expect([401, 403, 503]).toContain(response.status())
})

for (const endpoint of ['pr-check', 'ai-insights', 'daily-session', 'stale-sync-check']) {
  test(`internal ${endpoint} refuses a request without the shared secret`, async ({ request }) => {
    const missing = await request.post(`/api/internal/${endpoint}`)
    const wrong = await request.post(`/api/internal/${endpoint}`, { headers: { 'x-internal-secret': 'guess' } })

    expect(missing.status()).toBe(401)
    expect(wrong.status()).toBe(401)
  })
}

test('loop routes cannot be generated without the owner token', async ({ request }) => {
  const response = await request.post('/api/explore/route', { data: { start: [-150, 0], distanceM: 8000, seeds: [1] } })
  expect([401, 403, 503]).toContain(response.status())
})

test('an unknown map cluster is a 404, not a dump of every route', async ({ request }) => {
  const response = await request.get('/api/map/routes?cluster=does-not-exist')
  expect(response.status()).toBe(404)
})

test('pages carry the security headers next.config.ts sets', async ({ request }) => {
  const response = await request.get('/')
  const headers = response.headers()

  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
  expect(headers['content-security-policy']).toContain("object-src 'none'")
  expect(headers['x-frame-options']).toBe('DENY')
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['strict-transport-security']).toContain('max-age=')
})
