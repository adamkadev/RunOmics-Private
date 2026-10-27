import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { sendEachForMulticast, deleted, devices } = vi.hoisted(() => ({
  sendEachForMulticast: vi.fn(),
  deleted: [] as string[],
  devices: { list: [{ id: 'phone-token', categories: undefined as unknown }] as { id: string; categories: unknown; updatedAt?: Date }[] },
}))

vi.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({ sendEachForMulticast }) }))
vi.mock('@/lib/firebase-admin', () => ({
  getAdminApp: () => ({}),
  getAdminFirestore: () => ({
    collection: () => ({
      get: async () => ({
        docs: devices.list.map(({ id, categories, updatedAt }) => ({
          id,
          get: (field: string) => (field === 'updatedAt' ? (updatedAt && { toMillis: () => updatedAt.getTime() }) : categories),
          ref: { delete: async () => void deleted.push(id) },
        })),
      }),
      doc: (id: string) => ({ delete: async () => void deleted.push(id) }),
    }),
  }),
}))

const { sendPush, sendPushes } = await import('../sendPushNotification')

const DELIVERED = { responses: [{ success: true }] }
const titles = () => sendEachForMulticast.mock.calls.map(([message]) => message.notification.title)

describe('sendPushes', () => {
  beforeEach(() => {
    sendEachForMulticast.mockReset()
    devices.list = [{ id: 'phone-token', categories: undefined }]
  })

  it('sends every push, in order', async () => {
    sendEachForMulticast.mockResolvedValue(DELIVERED)

    await sendPushes('records', [
      { title: 'New PR: 5K', body: '19:10' },
      { title: 'New PR: 10K', body: '40:00' },
    ])

    expect(titles()).toEqual(['New PR: 5K', 'New PR: 10K'])
  })

  it('still sends the pushes queued behind one that failed, then says one failed', async () => {
    sendEachForMulticast.mockRejectedValueOnce(new Error('FCM is down')).mockResolvedValue(DELIVERED)

    await expect(
      sendPushes('records', [
        { title: 'New PR: 5K', body: '19:10' },
        { title: 'New PR: 10K', body: '40:00' },
        { title: 'New PR: Half', body: '1:25:00' },
      ])
    ).rejects.toThrow('1 of 3 pushes failed')

    expect(titles()).toEqual(['New PR: 5K', 'New PR: 10K', 'New PR: Half'])
  })

  it('has nothing to send and nothing to report for an empty batch', async () => {
    await expect(sendPushes('records', [])).resolves.toBeUndefined()
    expect(sendEachForMulticast).not.toHaveBeenCalled()
  })
})

const refused = (code: string) => ({ success: false, error: { code } })

describe('sendPush', () => {
  beforeEach(() => {
    sendEachForMulticast.mockReset()
    sendEachForMulticast.mockImplementation(async ({ tokens }: { tokens: string[] }) => ({
      responses: tokens.map(() => ({ success: true })),
    }))
    deleted.length = 0
  })

  it('prunes a device whose token was last saved over 270 days ago, and keeps one with no date', async () => {
    const day = 24 * 60 * 60 * 1000
    devices.list = [
      { id: 'abandoned', categories: undefined, updatedAt: new Date(Date.now() - 271 * day) },
      { id: 'refreshed', categories: undefined, updatedAt: new Date(Date.now() - 20 * day) },
      { id: 'undated', categories: undefined },
    ]

    await sendPush('always', { title: 'x', body: 'y' })

    expect(deleted).toEqual(['abandoned'])
    expect(sendEachForMulticast.mock.lastCall![0].tokens).toEqual(['refreshed', 'undated'])
  })

  it('reaches only the devices that kept the category on, and every device for a failure', async () => {
    devices.list = [
      { id: 'registered-before-categories', categories: undefined },
      { id: 'shoes-off', categories: { training: true, shoes: false, records: true } },
      { id: 'training-only', categories: { training: true, shoes: false, records: false } },
    ]
    const tokens = () => sendEachForMulticast.mock.lastCall![0].tokens

    await sendPush('shoes', { title: 'Shoe wear alert', body: '640 km' })
    expect(tokens()).toEqual(['registered-before-categories'])

    await sendPush('records', { title: 'New PR: 5K', body: '19:10' })
    expect(tokens()).toEqual(['registered-before-categories', 'shoes-off'])

    await sendPush('always', { title: 'Sync failed', body: 'Open the run' })
    expect(tokens()).toEqual(['registered-before-categories', 'shoes-off', 'training-only'])
  })

  it('counts what was delivered and forgets the tokens FCM will never deliver to', async () => {
    devices.list = [
      { id: 'phone', categories: undefined },
      { id: 'uninstalled', categories: undefined },
      { id: 'garbled', categories: undefined },
      { id: 'throttled', categories: undefined },
    ]
    sendEachForMulticast.mockResolvedValue({
      responses: [
        { success: true },
        refused('messaging/registration-token-not-registered'),
        refused('messaging/invalid-registration-token'),
        refused('messaging/message-rate-exceeded'),
      ],
    })

    await expect(sendPush('always', { title: 'Sync failed', body: 'Open the run' })).resolves.toEqual({ sent: 1, failed: 3 })
    expect(deleted).toEqual(['uninstalled', 'garbled'])
  })

  it('throws when every device refused, so the push is not recorded as sent', async () => {
    devices.list = [{ id: 'phone', categories: undefined }]
    sendEachForMulticast.mockResolvedValue({ responses: [refused('messaging/third-party-auth-error')] })

    await expect(sendPush('always', { title: 'Sync failed', body: 'Open the run' })).rejects.toThrow('messaging/third-party-auth-error')
  })
})

describe('sendPush links and tags', () => {
  const message = () => sendEachForMulticast.mock.lastCall![0]

  beforeEach(() => {
    sendEachForMulticast.mockReset()
    sendEachForMulticast.mockResolvedValue(DELIVERED)
    devices.list = [{ id: 'phone-token', categories: undefined }]
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sends a path as an absolute HTTPS link on this deployment, and the tag', async () => {
    vi.stubEnv('APP_URL', 'https://runomics.example')

    await sendPush('records', { title: 'New PR: 5K', body: '19:10', link: '/activities/a1', tag: 'record:5k' })

    expect(message().webpush).toEqual({
      notification: { tag: 'record:5k' },
      fcmOptions: { link: 'https://runomics.example/activities/a1' },
    })
  })

  it('builds the link from Vercel’s production domain when APP_URL is unset', async () => {
    vi.stubEnv('APP_URL', '')
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'demo-project.example.com')

    await sendPush('training', { title: 'Plan', body: 'Easy run', link: '/plan' })

    expect(message().webpush).toEqual({ fcmOptions: { link: 'https://demo-project.example.com/plan' } })
  })

  it('sends no link FCM would refuse, and still sends the push', async () => {
    vi.stubEnv('APP_URL', '')
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '')

    await sendPush('always', { title: 'Sync failed', body: 'Open Settings', link: '/settings' })
    expect(message().webpush).toEqual({})

    await sendPush('always', { title: 'Sync failed', body: 'Open the run', link: 'http://github.com/run' })
    expect(message().webpush).toEqual({})
    expect(message().notification).toEqual({ title: 'Sync failed', body: 'Open the run' })
  })
})
