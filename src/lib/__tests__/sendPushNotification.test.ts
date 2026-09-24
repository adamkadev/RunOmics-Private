import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sendEachForMulticast } = vi.hoisted(() => ({ sendEachForMulticast: vi.fn() }))

vi.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({ sendEachForMulticast }) }))
vi.mock('@/lib/firebase-admin', () => ({
  getAdminApp: () => ({}),
  getAdminFirestore: () => ({
    collection: () => ({
      get: async () => ({ docs: [{ id: 'phone-token' }] }),
      doc: () => ({ delete: async () => {} }),
    }),
  }),
}))

const { sendPushesToAllDevices } = await import('../sendPushNotification')

const DELIVERED = { responses: [{ success: true }] }
const titles = () => sendEachForMulticast.mock.calls.map(([message]) => message.notification.title)

describe('sendPushesToAllDevices', () => {
  beforeEach(() => {
    sendEachForMulticast.mockReset()
  })

  it('sends every push, in order', async () => {
    sendEachForMulticast.mockResolvedValue(DELIVERED)

    await sendPushesToAllDevices([
      { title: 'New PR: 5K', body: '19:10' },
      { title: 'New PR: 10K', body: '40:00' },
    ])

    expect(titles()).toEqual(['New PR: 5K', 'New PR: 10K'])
  })

  it('still sends the pushes queued behind one that failed, then says one failed', async () => {
    sendEachForMulticast.mockRejectedValueOnce(new Error('FCM is down')).mockResolvedValue(DELIVERED)

    await expect(
      sendPushesToAllDevices([
        { title: 'New PR: 5K', body: '19:10' },
        { title: 'New PR: 10K', body: '40:00' },
        { title: 'New PR: Half', body: '1:25:00' },
      ])
    ).rejects.toThrow('1 of 3 pushes failed')

    expect(titles()).toEqual(['New PR: 5K', 'New PR: 10K', 'New PR: Half'])
  })

  it('has nothing to send and nothing to report for an empty batch', async () => {
    await expect(sendPushesToAllDevices([])).resolves.toBeUndefined()
    expect(sendEachForMulticast).not.toHaveBeenCalled()
  })
})
