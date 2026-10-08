import { describe, expect, it } from 'vitest'
import { H, W, renderShareCard } from '@/lib/shareCard'
import type { ShareActivity } from '@/lib/shareCardStats'

const RUN: ShareActivity = {
  id: '1', date: '2026-10-08', dayOfWeek: 'Thursday', description: 'Easy run',
  distanceKm: 11.1, durationSeconds: 3807, paceSecPerKm: 342, avgHeartRate: 151, elevationGain: 40,
  route: null, hrZones: [],
}

describe('the exported card (design review, Oct 2026)', () => {
  it('is the on-screen card\'s own 4:5, at 1080 x 1350, on every design', () => {
    expect(W / H).toBe(4 / 5)
    for (const design of ['route', 'stats', 'photo'] as const) {
      const canvas = { width: 0, height: 0, getContext: () => null } as unknown as HTMLCanvasElement
      renderShareCard(canvas, { activity: RUN, design, accent: 'violet', theme: 'dark' }, 1080 / W)
      expect([canvas.width, canvas.height]).toEqual([1080, 1350])
    }
  })
})
