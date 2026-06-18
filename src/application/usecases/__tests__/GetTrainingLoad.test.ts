import { describe, it, expect } from 'vitest'
import { trimp } from '../GetTrainingLoad'
import type { Activity } from '@/domain/activity/types'

const act = (hr: number | null, durationSeconds: number): Activity =>
  ({ avgHeartRate: hr, durationSeconds }) as Activity

// RESTING_HR=45, MAX_HR=195

describe('trimp', () => {
  it('returns 0 when no heart rate', () => {
    expect(trimp(act(null, 3600))).toBe(0)
  })

  it('returns 0 when no duration', () => {
    expect(trimp(act(150, 0))).toBe(0)
  })

  it('calculates correctly at moderate intensity (HR 120, 60 min)', () => {
    // hrr = (120-45)/(195-45) = 75/150 = 0.5
    // trimp = 60 * 0.5 * 0.64 * exp(1.92 * 0.5) ≈ 50.1
    expect(trimp(act(120, 3600))).toBeCloseTo(50.1, 0)
  })

  it('calculates correctly at high intensity (HR 165, 60 min)', () => {
    // hrr = (165-45)/(195-45) = 120/150 = 0.8
    // trimp = 60 * 0.8 * 0.64 * exp(1.536) ≈ 142.8
    expect(trimp(act(165, 3600))).toBeCloseTo(142.8, 0)
  })

  it('calculates correctly at low intensity (HR 80, 30 min)', () => {
    // hrr = (80-45)/(195-45) = 35/150 ≈ 0.233
    // trimp = 30 * 0.233 * 0.64 * exp(1.92 * 0.233) ≈ 7.0
    expect(trimp(act(80, 1800))).toBeCloseTo(7.0, 0)
  })

  it('clamps hrr to 0 when HR below resting (HR 30)', () => {
    // hrr = max(0, (30-45)/(195-45)) = max(0, -0.1) = 0
    expect(trimp(act(30, 3600))).toBe(0)
  })

  it('clamps hrr to 1 when HR above max (HR 220)', () => {
    // hrr = min(1, (220-45)/(195-45)) = min(1, 1.17) = 1
    // trimp = (3600/60) * 1 * 0.64 * exp(1.92) = 38.4 * 6.821 ≈ 261.9
    expect(trimp(act(220, 3600))).toBeCloseTo(261.9, 0)
  })

  it('scales linearly with duration', () => {
    const half = trimp(act(120, 1800))
    const full = trimp(act(120, 3600))
    expect(full).toBeCloseTo(half * 2, 5)
  })
})
