import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sendEachForMulticast, deleted, devices } = vi.hoisted(() => ({
  sendEachForMulticast: vi.fn(),
  deleted: [] as string[],
  devices: { list: [{ id: 'phone-token', categories: undefined as unknown }] },
}))

vi.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({ sendEachForMulticast }) }))
vi.mock('@/lib/firebase-admin', () => ({
  getAdminApp: () => ({}),
  getAdminFirestore: () => ({
    collection: () => ({
      get: async () => ({ docs: devices.list.map(({ id, categories }) => ({ id, get: () => categories })) }),
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

  it('reaches only the devices that kept the category on, and every device for a failure', async () => {
    devices.list = [
      { id: 'registered-before-categories', categories: undefined },
      { id: 'shoes-off', categories: { training: true, shoes: false, records: true } },
      { id: 'training-only', categories: { training: true, shoes: false, records: false } },
    ]
    const tokens = () => sendEachForMulticast.mock.lastCall![0].tokens

    await sendPush('shoes', 'Shoe wear alert', '640 km')
    expect(tokens()).toEqual(['registered-before-categories'])

    await sendPush('records', 'New PR: 5K', '19:10')
    expect(tokens()).toEqual(['registered-before-categories', 'shoes-off'])

    await sendPush('always', 'Sync failed', 'Open the run')
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

    await expect(sendPush('always', 'Sync failed', 'Open the run')).resolves.toEqual({ sent: 1, failed: 3 })
    expect(deleted).toEqual(['uninstalled', 'garbled'])
  })

  it('throws when every device refused, so the push is not recorded as sent', async () => {
    devices.list = [{ id: 'phone', categories: undefined }]
    sendEachForMulticast.mockResolvedValue({ responses: [refused('messaging/third-party-auth-error')] })

    await expect(sendPush('always', 'Sync failed', 'Open the run')).rejects.toThrow('messaging/third-party-auth-error')
  })
})
