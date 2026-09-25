import type { TargetEvent } from './types'
import { RACE_DISTANCE_KM, type RaceDistanceKey } from '@/domain/race/distances'

const DISTANCE_KEYS: Record<string, RaceDistanceKey> = {
  '5k': '5k',
  '5km': '5k',
  '10k': '10k',
  '10km': '10k',
  half: 'half',
  halfmarathon: 'half',
  marathon: 'marathon',
}

export interface RaceTargetFacts {
  hasExplicitGoal: boolean
  targetSeconds?: number
  targetFinishTime?: string
  targetPaceSecPerKm?: number
  targetPace?: string
}

function positive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be positive`)
  return value
}

export function raceDistanceMeters(distanceLabel?: string): number | undefined {
  if (!distanceLabel) return undefined
  const normalized = distanceLabel.toLowerCase().replace(/[\s_-]/g, '')
  const key = DISTANCE_KEYS[normalized]
  return key === undefined ? undefined : Math.round(RACE_DISTANCE_KM[key] * 1_000)
}

export function finishSecondsFromPace(paceSecPerKm: number, distanceMeters: number): number {
  return Math.round(positive(paceSecPerKm, 'paceSecPerKm') * positive(distanceMeters, 'distanceMeters') / 1_000)
}

export function paceSecondsPerKmFromFinish(targetSeconds: number, distanceMeters: number): number {
  return Math.round(positive(targetSeconds, 'targetSeconds') / (positive(distanceMeters, 'distanceMeters') / 1_000))
}

export function formatRaceTime(seconds: number): string {
  const rounded = Math.round(positive(seconds, 'seconds'))
  const hours = Math.floor(rounded / 3_600)
  const minutes = Math.floor((rounded % 3_600) / 60)
  const remainder = rounded % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`
}

function formatRacePace(paceSecPerKm: number): string {
  return `${formatRaceTime(paceSecPerKm)}/km`
}

export function raceTargetFacts(event: Pick<TargetEvent, 'distanceLabel' | 'distanceMeters' | 'targetSeconds'>): RaceTargetFacts {
  if (event.targetSeconds === undefined) return { hasExplicitGoal: false }
  const distanceMeters = event.distanceMeters ?? raceDistanceMeters(event.distanceLabel)
  if (distanceMeters === undefined) {
    return {
      hasExplicitGoal: true,
      targetSeconds: event.targetSeconds,
      targetFinishTime: formatRaceTime(event.targetSeconds),
    }
  }
  const targetPaceSecPerKm = paceSecondsPerKmFromFinish(event.targetSeconds, distanceMeters)
  return {
    hasExplicitGoal: true,
    targetSeconds: event.targetSeconds,
    targetFinishTime: formatRaceTime(event.targetSeconds),
    targetPaceSecPerKm,
    targetPace: formatRacePace(targetPaceSecPerKm),
  }
}
