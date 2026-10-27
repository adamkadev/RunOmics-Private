#!/usr/bin/env node
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SEED = 20260814
const MONTHS_BACK = 18
const ROUTE_CENTERS = {
  home: [-150.0, 0.0],
  away: [-149.0, 3.0],
}

const AWAY_TRIP = { startFraction: 0.62, days: 28 }

function makeRng(seed) {
  let a = seed >>> 0
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)]
}
function between(rng, min, max) {
  return min + rng() * (max - min)
}
function round(n, decimals = 0) {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}
function pad(n, width) {
  return String(n).padStart(width, '0')
}

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}
// In UTC: a local-time step drifts an hour across a daylight-saving change, so `isoDate` lands on the previous day.
function addDays(d, days) {
  const copy = new Date(d)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}
function dayOfWeekName(d) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()]
}
function isoWeek(d) {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return target.getUTCFullYear() * 100 + week
}

const ATHLETE = {
  displayName: 'Demo Runner',
  age: 32,
  sex: 'male',
  heightCm: 178,
  weightKg: 70,
  restingHrBpm: 50,
  maxHrBpm: 189,
  lthrBpm: 172,
  thresholdPaceSecPerKm: 258,
  hrZoneBoundsBpm: [128, 145, 160, 172, 182],
  vmaKmh: 17.5,
  fitnessAgeYrs: 27,
  achievableFitnessAgeYrs: 24,
  bmi: 22.1,
  deviceName: 'Forerunner 265',
  deviceFirmware: '15.10',
  deviceSince: '2025-01-15',
}

const SHOES = [
  { gearId: 'demo-shoe-0000000000000001', brand: 'Nimbus', model: 'Cloudrun 4', maxKm: 800, retired: false, firstUseDate: '2026-02-01' },
  { gearId: 'demo-shoe-0000000000000002', brand: 'Velox', model: 'Tempo Racer 2', maxKm: 500, retired: false, firstUseDate: '2026-05-10' },
  { gearId: 'demo-shoe-0000000000000003', brand: 'Nimbus', model: 'Cloudrun 3', maxKm: 800, retired: true, firstUseDate: '2025-04-01' },
]

const SESSION_TYPES = [
  { type: 'Base', weight: 45, paceMult: [1.25, 1.42], descriptions: ['Morning Run', 'Easy Run', 'Recovery Jog'] },
  { type: 'Tempo', weight: 15, paceMult: [1.05, 1.12], descriptions: ['Tempo Run'] },
  { type: 'Threshold', weight: 15, paceMult: [0.98, 1.03], descriptions: ['Threshold'] },
  // A session's average pace includes its recoveries, so the hard sessions average near threshold.
  { type: 'VO2Max', weight: 10, paceMult: [0.95, 1.02], descriptions: ['Intervals'] },
  { type: 'Sprint', weight: 5, paceMult: [1.0, 1.1], descriptions: ['Sprint Session'] },
]

// GetTrainingZones puts Z5 pace at 0.86-0.91 x threshold pace, so no run or best may be faster than this.
export const Z5_PACE_FLOOR_SEC = Math.round(ATHLETE.thresholdPaceSecPerKm * 0.86)

// Inside the athlete's own zones (hrZoneBoundsBpm are the lower bounds of Z1-Z5): easy runs in Z2, tempo in Z3,
// threshold in Z4.
const HR_BY_TYPE = {
  Base: [146, 156],
  Tempo: [161, 170],
  Threshold: [172, 179],
  VO2Max: [168, 177],
  Sprint: [150, 162],
}
const RACE_HR = { '5k': 181, '10k': 178, half: 172, marathon: 164 }

function centered(series, mean) {
  const avg = series.reduce((sum, v) => sum + v, 0) / series.length
  return series.map((v) => round(v - avg + mean, 1))
}

const RACE_DISTANCES_KM = { '1k': 1, '5k': 5, '10k': 10, half: 21.0975, marathon: 42.195 }
const RACE_BASELINE_10K_SEC = 2386
function riegelSeconds(distanceKm) {
  return RACE_BASELINE_10K_SEC * (distanceKm / RACE_DISTANCES_KM['10k']) ** 1.06
}

function pickSessionType(rng) {
  const total = SESSION_TYPES.reduce((s, t) => s + t.weight, 0)
  let r = rng() * total
  for (const t of SESSION_TYPES) {
    if (r < t.weight) return t
    r -= t.weight
  }
  return SESSION_TYPES[0]
}

function metersToDegrees(meters, lat) {
  const dLat = meters / 111320
  const dLon = meters / (111320 * Math.cos((lat * Math.PI) / 180))
  return [dLon, dLat]
}

function generateRoute(rng, distanceKm, center) {
  const [centerLon, centerLat] = center
  const perimeterM = distanceKm * 1000
  const sideM = Math.max(200, perimeterM / 4)
  const points = []
  const numPoints = Math.max(40, Math.min(120, Math.round(distanceKm * 12)))

  for (let i = 0; i < numPoints; i++) {
    const t = i / numPoints
    const angle = t * 2 * Math.PI
    const rx = sideM * (0.5 + 0.1 * Math.sin(angle * 2))
    const ry = sideM * 0.35 * (0.5 + 0.1 * Math.cos(angle * 3))
    const jitterM = between(rng, -3, 3)
    const [dLon, dLat] = metersToDegrees(rx * Math.cos(angle) + jitterM, centerLat)
    const [dLon2, dLat2] = metersToDegrees(ry * Math.sin(angle) + jitterM, centerLat)
    points.push([round(centerLon + dLon, 6), round(centerLat + dLat2, 6)])
  }
  points.push([...points[0]])
  return points
}

function smoothSeries(rng, length, base, spread) {
  const out = []
  let prev = base
  for (let i = 0; i < length; i++) {
    prev = prev + between(rng, -spread, spread)
    prev = Math.max(base - spread * 3, Math.min(base + spread * 3, prev))
    out.push(round(prev, 1))
  }
  return out
}

function buildActivities(rng, endDate) {
  const activities = []
  let id = 90000001
  const totalDays = MONTHS_BACK * 30
  const startDate = addDays(endDate, -totalDays)

  const raceDayOffsets = new Map(
    [0.45, 0.6, 0.75, 0.9, 0.98].map((frac) => [Math.round(totalDays * frac), null])
  )
  const racePlan = ['10k', '5k', 'half', '10k', 'marathon']
  let raceIndex = 0

  const awayStart = Math.round(totalDays * AWAY_TRIP.startFraction)

  for (let dayOffset = 0; dayOffset <= totalDays; dayOffset++) {
    const date = addDays(startDate, dayOffset)
    const progress = Math.min(1, dayOffset / (totalDays * 0.7))
    const weekday = date.getDay()
    const isRaceDay = raceDayOffsets.has(dayOffset)

    if (!isRaceDay) {
      const restDayBias = weekday === 1 || weekday === 5 ? 0.75 : 0.4
      if (rng() < restDayBias) continue
    }

    const session = isRaceDay
      ? { type: 'Race', descriptions: ['Race Day'] }
      : pickSessionType(rng)
    const thresholdPace = ATHLETE.thresholdPaceSecPerKm - progress * 12

    let distanceKm, paceSecPerKm, raceKey
    if (isRaceDay) {
      raceKey = racePlan[raceIndex++]
      distanceKm = round(RACE_DISTANCES_KM[raceKey], 3)
      paceSecPerKm = round(riegelSeconds(distanceKm) / distanceKm, 1)
    } else {
      const paceMult = between(rng, session.paceMult[0], session.paceMult[1])
      paceSecPerKm = round(thresholdPace * paceMult, 1)
      const isLongRun = session.type === 'Base' && weekday === 0 && rng() < 0.6
      distanceKm = round(
        isLongRun ? between(rng, 14, 22) : session.type === 'Sprint' ? between(rng, 5, 8) : between(rng, 6, 13),
        2
      )
    }

    const durationSeconds = Math.round(distanceKm * paceSecPerKm)
    const avgHeartRate = isRaceDay
      ? RACE_HR[raceKey] + Math.round(between(rng, -2, 2))
      : Math.round(between(rng, HR_BY_TYPE[session.type][0], HR_BY_TYPE[session.type][1]))

    const hrZones = buildHrZones(rng, durationSeconds, session.type)
    const cadenceSpm = round(between(rng, 168, 182), 1)
    const isAway = dayOffset >= awayStart && dayOffset < awayStart + AWAY_TRIP.days
    const route = generateRoute(rng, distanceKm, isAway ? ROUTE_CENTERS.away : ROUTE_CENTERS.home)
    const sampleLen = Math.max(20, Math.min(80, Math.round(distanceKm * 4)))

    const bestEfforts = {}
    if (isRaceDay) {
      bestEfforts[raceKey] = durationSeconds
    } else {
      if (distanceKm >= 1) bestEfforts['1k'] = round(Math.max(Z5_PACE_FLOOR_SEC, paceSecPerKm * between(rng, 0.9, 0.96)), 1)
      if (distanceKm >= 5 && (session.type === 'Tempo' || session.type === 'Threshold')) {
        bestEfforts['5k'] = round(Math.max(Z5_PACE_FLOOR_SEC * 5, paceSecPerKm * 5 * between(rng, 0.97, 1.0)), 1)
      }
    }

    const gearId = pick(rng, SHOES.filter((s) => !s.retired || rng() < 0.1)).gearId

    activities.push({
      id: String(id++),
      week: isoWeek(date),
      date: isoDate(date),
      dayOfWeek: dayOfWeekName(date),
      type: session.type,
      description: pick(rng, session.descriptions),
      durationSeconds,
      distanceKm,
      paceSecPerKm,
      hrZones,
      avgHeartRate,
      rpe: rng() < 0.3 ? Math.round(between(rng, 3, 8)) : null,
      comment: rng() < 0.15 ? pick(rng, ['Felt strong today.', 'Legs a bit heavy.', 'Great weather for it.', 'Solid session.']) : '',
      route,
      elevationGain: round(between(rng, 10, 120), 1),
      aerTrainingEffect: round(between(rng, 1.5, 4.2), 1),
      anaTrainingEffect: round(between(rng, 0.3, 2.5), 1),
      // Samples average to the recorded values, as a watch's do, so Charts and the stat row agree.
      hrSamples: centered(smoothSeries(rng, sampleLen, avgHeartRate, 4), avgHeartRate),
      elevationProfile: smoothSeries(rng, sampleLen, 20, 3),
      calories: Math.round(distanceKm * 62),
      cadenceSpm,
      groundContactMs: round(between(rng, 230, 260), 1),
      verticalOscillationMm: round(between(rng, 75, 95), 1),
      verticalRatioPct: round(between(rng, 6.5, 8.5), 1),
      strideLengthM: round(1000 / paceSecPerKm / (170 / 60), 2),
      bestEfforts: Object.keys(bestEfforts).length ? bestEfforts : null,
      paceSamples: centered(smoothSeries(rng, sampleLen, paceSecPerKm, 8), paceSecPerKm),
      vo2maxGarmin: round(42 + progress * 8, 1),
      avgTemperature: Math.round(between(rng, 8, 24)),
      cadenceSamples: centered(smoothSeries(rng, sampleLen, cadenceSpm, 3), cadenceSpm),
      splits: session.type === 'VO2Max' || session.type === 'Threshold' ? buildSplits(rng, session.type, distanceKm, paceSecPerKm, avgHeartRate) : null,
      gearId,
      weather: (() => {
        const tempC = round(between(rng, 8, 24), 1)
        const humidityPct = Math.round(between(rng, 40, 85))
        // The heat adjustment reads the feels-like and the map's wind chip the wind.
        return {
          tempC,
          apparentTempC: round(tempC + (humidityPct - 60) * 0.05 + between(rng, -1, 1), 1),
          humidityPct,
          windKph: round(between(rng, 3, 22), 1),
          windDirDeg: Math.round(between(rng, 0, 359)),
          code: pick(rng, [0, 1, 2, 3, 61]),
        }
      })(),
    })
  }

  return activities
}

const CURVE_SECONDS = [30, 60, 120, 180, 300, 600, 1200, 1800, 3600, 5400, 7200]
/** How far a type's hardest stretch runs over its average pace, as critical speed and D'. */
const CURVE_SHAPE = { Sprint: [1.0, 100], Anaerobic: [1.0, 100], VO2Max: [0.97, 90], Threshold: [0.99, 60], Tempo: [0.98, 50], Race: [1.0, 40], Base: [0.9, 20] }

// Drawn from the run's own numbers, never the generator's random stream, so every other demo figure stays put.
function addPaceProfile(activity) {
  const avgSpeed = 1000 / activity.paceSecPerKm
  const [csShare, dPrime] = CURVE_SHAPE[activity.type] ?? CURVE_SHAPE.Base
  const bests = {}
  for (const seconds of CURVE_SECONDS) {
    if (seconds > activity.durationSeconds) break
    const span = Math.max(seconds, 180)
    const speed = ((avgSpeed * csShare * span + dPrime) / span) * (span / seconds) ** 0.1
    const rest = 0.85 * avgSpeed * (activity.durationSeconds - seconds)
    bests[String(seconds)] = round(Math.max(avgSpeed * seconds, Math.min(speed * seconds, activity.distanceKm * 1000 - rest)), 1)
  }
  activity.durationBests = Object.keys(bests).length ? bests : null
  const climbPerKm = activity.elevationGain / activity.distanceKm
  const profile = activity.elevationProfile
  const stepM = (activity.distanceKm * 1000) / profile.length
  const cost = profile.map((_, i) => {
    const grade = (profile[Math.min(i + 1, profile.length - 1)] - profile[Math.max(i - 1, 0)]) / (2 * stepM)
    return 1 + 0.002 * climbPerKm + 4 * grade
  })
  activity.gapSamples = activity.paceSamples.map((pace, i) => Math.round(pace / cost[Math.round((i / (activity.paceSamples.length - 1)) * (cost.length - 1))]))
  activity.gapSecPerKm = round(activity.paceSecPerKm / (1 + 0.002 * climbPerKm), 1)
}

function buildHrZones(rng, durationSeconds, type) {
  const weights =
    type === 'Base'
      ? [0.1, 0.6, 0.2, 0.08, 0.02]
      : type === 'Tempo' || type === 'Threshold'
        ? [0.05, 0.15, 0.3, 0.35, 0.15]
        : [0.02, 0.08, 0.15, 0.3, 0.45]
  const bounds = ATHLETE.hrZoneBoundsBpm
  let remaining = durationSeconds
  return weights.map((w, i) => {
    const seconds = i === weights.length - 1 ? remaining : Math.round(durationSeconds * w * between(rng, 0.85, 1.15))
    remaining -= seconds
    return {
      zone: i + 1,
      seconds: Math.max(0, seconds),
      percent: round(w * 100, 1),
      minBpm: bounds[i],
      maxBpm: i + 1 < bounds.length ? bounds[i + 1] - 1 : null,
    }
  })
}

function buildSplits(rng, type, distanceKm, paceSecPerKm, avgHr) {
  const repCount = type === 'VO2Max' ? 6 : 4
  const laps = Array.from({ length: repCount }, () => ({
    durationSec: Math.round(400 * paceSecPerKm * between(rng, 0.9, 0.96) / 1000),
    distanceM: 400,
    avgSpeedMs: round(1000 / (paceSecPerKm * 0.9), 4),
    avgHr: Math.round(avgHr * between(rng, 1.02, 1.08)),
  }))
  return [
    {
      type: 'interval',
      durationSec: laps.reduce((s, l) => s + l.durationSec, 0),
      distanceM: laps.length * 400,
      avgSpeedMs: laps[0].avgSpeedMs,
      avgHr: Math.round(avgHr * 1.05),
      laps,
    },
  ]
}

function buildTrainingStatusAndBalance(rng, activities, endDate) {
  const days = {}
  const weeks = {}
  const statuses = ['productive', 'maintaining', 'peaking', 'recovery']

  // The watch rates every day, not only the days with a run, and its verdict holds for days at a time.
  const first = activities[0]
  const dates = []
  if (first) {
    for (let d = new Date(first.date + 'T00:00:00Z'); d <= endDate; d = addDays(d, 1)) dates.push(isoDate(d))
  }
  let status = statuses[0]
  for (const [i, date] of dates.entries()) {
    if (i % 4 === 0) status = rng() < 0.45 ? 'peaking' : pick(rng, statuses)
    const a = { date }
    days[a.date] = {
      status,
      statusCode: statuses.indexOf(status) + 1,
      feedback: `${status.toUpperCase()}_1`,
      fitnessTrend: round(between(rng, -1, 2), 1),
      acuteLoad: Math.round(between(rng, 200, 500)),
      chronicLoad: Math.round(between(rng, 250, 450)),
      acwr: round(between(rng, 0.7, 1.3), 2),
      acwrStatus: 'OPTIMAL',
      chronicLoadMin: 220,
      chronicLoadMax: 480,
    }
    const week = String(isoWeek(new Date(a.date + 'T00:00:00')))
    weeks[week] = weeks[week] ?? days[a.date]
  }

  const balance = {
    date: activities[activities.length - 1]?.date,
    feedback: 'BALANCED',
    aerobicLow: 320,
    aerobicLowMin: 250,
    aerobicLowMax: 500,
    aerobicHigh: 180,
    aerobicHighMin: 100,
    aerobicHighMax: 300,
    anaerobic: 60,
    anaerobicMin: 20,
    anaerobicMax: 120,
  }

  return { trainingStatus: { days, weeks }, trainingLoadBalance: balance }
}

function buildVo2maxAndThresholdHistory(activities) {
  const vo2maxDays = {}
  const vo2maxMonths = {}
  const thresholdDays = {}

  for (let i = 0; i < activities.length; i += 5) {
    const a = activities[i]
    const vo2max = a.vo2maxGarmin
    vo2maxDays[a.date] = { date: a.date, vo2max }
    const monthKey = a.date.slice(0, 7) + '-01'
    vo2maxMonths[monthKey] = { date: monthKey, vo2max }
    if (i % 15 === 0) {
      thresholdDays[a.date] = {
        date: a.date,
        lthrBpm: ATHLETE.lthrBpm - Math.round((activities.length - i) / activities.length * 6),
        thresholdPaceSecPerKm: ATHLETE.thresholdPaceSecPerKm + Math.round((activities.length - i) / activities.length * 10),
      }
    }
  }

  return {
    vo2maxHistory: { days: vo2maxDays, months: vo2maxMonths },
    thresholdHistory: { days: thresholdDays },
  }
}

function buildRacePredictions(activities, startDate, totalDays) {
  const days = {}
  const baselineEnd = RACE_BASELINE_10K_SEC
  const baselineStart =
    RACE_BASELINE_10K_SEC * (ATHLETE.thresholdPaceSecPerKm / (ATHLETE.thresholdPaceSecPerKm - 12))

  for (let i = 0; i < activities.length; i += 4) {
    const a = activities[i]
    const dayOffset = Math.round((new Date(a.date + 'T00:00:00') - startDate) / 86400000)
    const progress = Math.min(1, dayOffset / (totalDays * 0.7))
    const baseline10k = baselineStart - (baselineStart - baselineEnd) * progress

    days[a.date] = Object.fromEntries(
      Object.entries(RACE_DISTANCES_KM)
        .filter(([key]) => key !== '1k')
        .map(([key, km]) => [key, Math.round(baseline10k * (km / RACE_DISTANCES_KM['10k']) ** 1.06)])
    )
  }
  return { days }
}

function buildAthleteHistory(activities) {
  const days = {}
  for (let i = 0; i < activities.length; i += 10) {
    const a = activities[i]
    days[a.date] = {
      lthrBpm: ATHLETE.lthrBpm,
      thresholdPaceSecPerKm: ATHLETE.thresholdPaceSecPerKm,
      vo2maxMlKgMin: a.vo2maxGarmin,
      weightKg: ATHLETE.weightKg,
    }
  }
  return { days }
}

// Garmin's series is daily, though the sync files it under "weeks"; the year eases down to today's reading.
function buildFitnessAgeHistory(endDate) {
  const weeks = {}
  for (let back = 360; back >= 0; back -= 3) {
    const p = 1 - back / 360
    const years = ATHLETE.fitnessAgeYrs + (1 - p) * (3 + 0.8 * Math.sin(4 * Math.PI * p))
    weeks[isoDate(addDays(endDate, -back))] = { fitnessAgeYrs: round(years, 1), bmi: ATHLETE.bmi }
  }
  return { weeks }
}

function buildGoals() {
  return {
    years: [
      {
        year: new Date().getFullYear(),
        annualDistanceKm: 1200,
        targets: [
          { distance: '5K', target: '19:30' },
          { distance: '10K', target: '40:30' },
          { distance: 'Half-Marathon', target: '1:30:00' },
          { distance: 'Marathon', target: null },
        ],
      },
    ],
  }
}

function buildPbs(activities) {
  const bestByDistance = {}
  for (const a of activities) {
    for (const [key, seconds] of Object.entries(a.bestEfforts ?? {})) {
      if (!bestByDistance[key] || seconds < bestByDistance[key].seconds) {
        bestByDistance[key] = { seconds, activityId: a.id }
      }
    }
  }
  const distanceLabel = { '1k': '1K', '5k': '5K', '10k': '10K', half: 'Half-Marathon', marathon: 'Marathon' }
  const entries = Object.entries(bestByDistance).map(([key, v]) => ({
    distance: distanceLabel[key] ?? key,
    time: formatHms(v.seconds),
    activityId: v.activityId,
  }))
  return { years: [{ year: new Date().getFullYear(), entries }] }
}

function formatHms(totalSeconds) {
  const s = Math.round(totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${pad(m, 2)}:${pad(sec, 2)}` : `${m}:${pad(sec, 2)}`
}

function buildTrainingPlan(endDate) {
  // Nine weeks that end on the race: base, build, peak, taper.
  const race = addDays(endDate, 21)
  const start = addDays(race, -62)
  return {
    planId: 10000001,
    name: 'Demo 10K Build',
    startDate: isoDate(start),
    endDate: isoDate(race),
    phases: [
      { phase: 'BASE', startDate: isoDate(start), endDate: isoDate(addDays(start, 20)) },
      { phase: 'BUILD', startDate: isoDate(addDays(start, 21)), endDate: isoDate(addDays(start, 41)) },
      { phase: 'PEAK', startDate: isoDate(addDays(start, 42)), endDate: isoDate(addDays(start, 55)) },
      { phase: 'TAPER', startDate: isoDate(addDays(start, 56)), endDate: isoDate(race) },
    ],
  }
}

function buildUpcomingRaces(endDate) {
  return {
    races: [
      { garminEventUuid: 'demo-race-0000000000000001', date: isoDate(addDays(endDate, 21)), name: 'Harbor Lights 10K', distance: '10K', location: 'Fictional Bay', isPrimaryEvent: true, targetSeconds: 2_430 },
      { garminEventUuid: 'demo-race-0000000000000002', date: isoDate(addDays(endDate, 63)), name: 'Autumn Trail Half', distance: 'Half-Marathon', location: 'Fictional Bay', isPrimaryEvent: false },
    ],
  }
}

function buildPlannedWorkouts(rng, endDate) {
  const byYear = {}
  const NAMES_BY_TYPE = { Base: ['Easy Run', 'Long Run'], Tempo: ['Tempo'], Threshold: ['Threshold'], VO2Max: ['Intervals'] }
  for (let i = -7; i <= 30; i++) {
    if (rng() < 0.55) continue
    const date = addDays(endDate, i)
    const year = String(date.getFullYear())
    byYear[year] = byYear[year] ?? []
    byYear[year].push({
      date: isoDate(date),
      ...(() => {
        const type = pick(rng, ['Base', 'Tempo', 'Threshold', 'VO2Max'])
        return { type, name: pick(rng, NAMES_BY_TYPE[type]) }
      })(),
      distanceM: Math.round(between(rng, 6000, 16000)),
      durationSecs: Math.round(between(rng, 1800, 5400)),
      scheduledTime: pick(rng, ['Morning', 'Afternoon', 'Evening']),
    })
  }
  return byYear
}

const MACROCYCLE_DAYS = 84

// The ceiling a planner writes from this athlete's LTHR, as controlledThresholdHr gives it.
const CONTROLLED_CEILING_BPM = ATHLETE.lthrBpm - 6
const CONTROLLED_REP = { count: 3, seconds: 480, recoverySeconds: 90, warmupSeconds: 600, hrBpm: 165 }
const SAMPLE_SECONDS = 15

// Garmin files a sub-threshold session as tempo, so two quality runs become one, keeping their distance and time.
function shapeControlledRuns(activities, before) {
  const since = isoDate(addDays(new Date(`${before}T00:00:00Z`), -35))
  const runs = activities
    .filter((a) => (a.type === 'Tempo' || a.type === 'Threshold') && a.date >= since && a.date < before && a.durationSeconds >= 2_600)
    .slice(-2)
  if (runs.length < 2) return null
  const repPace = Math.round(Math.min(...runs.map((a) => a.paceSecPerKm))) - 4
  for (const activity of runs) {
    const { count, seconds, recoverySeconds, warmupSeconds, hrBpm } = CONTROLLED_REP
    const repM = round((seconds / repPace) * 1_000, 1)
    const recoveryM = round((recoverySeconds / (repPace + 70)) * 1_000, 1)
    const cooldownSeconds = activity.durationSeconds - warmupSeconds - count * seconds - (count - 1) * recoverySeconds
    const easyM = activity.distanceKm * 1_000 - count * repM - (count - 1) * recoveryM
    const warmupM = round((easyM * warmupSeconds) / (warmupSeconds + cooldownSeconds), 1)
    const segments = [{ type: 'interval_warmup', seconds: warmupSeconds, metres: warmupM, hr: 152 }]
    for (let rep = 0; rep < count; rep++) {
      segments.push({ type: 'interval_active', seconds, metres: repM, hr: hrBpm })
      if (rep < count - 1) segments.push({ type: 'interval_recovery', seconds: recoverySeconds, metres: recoveryM, hr: 158 })
    }
    segments.push({ type: 'interval_cooldown', seconds: cooldownSeconds, metres: round(easyM - warmupM, 1), hr: 154 })

    const samplesFor = (lift) => segments.flatMap((segment) => Array.from({ length: Math.round(segment.seconds / SAMPLE_SECONDS) }, (_, i) => {
      if (segment.type === 'interval_active') return Math.min(segment.hr, 150 + Math.round((i * SAMPLE_SECONDS * (segment.hr - 150)) / 180))
      return segment.type === 'interval_recovery' ? segment.hr : segment.hr + lift
    }))
    const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length
    // Tempo runs average in Z3, so the easy laps carry what the reps alone do not.
    let lift = 0
    while (mean(samplesFor(lift)) < ATHLETE.hrZoneBoundsBpm[2] + 0.6) lift++
    const samples = samplesFor(lift)
    activity.type = 'Tempo'
    activity.hrSamples = samples
    activity.avgHeartRate = Math.round(mean(samples))
    activity.splits = segments.map((segment) => ({
      type: segment.type,
      durationSec: segment.seconds,
      distanceM: segment.metres,
      avgSpeedMs: round(segment.metres / segment.seconds, 3),
      avgHr: segment.type === 'interval_active' || segment.type === 'interval_recovery' ? segment.hr : segment.hr + lift,
      laps: [],
    }))
  }
  return { runs, guide: { min: repPace - 4, max: repPace + 4 } }
}

function clockLabel(seconds) {
  return `${Math.floor(seconds / 60)}:${pad(Math.round(seconds % 60), 2)}`
}

const PREVIOUS_PLAN_MAX_WEEKS = 5

/** The block before the current one, kept under superseded/ as bootstrap --replace keeps it. */
function buildPreviousPlan(controlled, start, provenance) {
  const { runs, guide } = controlled
  const middle = Math.round((guide.min + guide.max) / 2)
  const sessions = runs.map((activity, index) => {
    const { count, seconds, recoverySeconds, warmupSeconds } = CONTROLLED_REP
    return {
      id: `demo-previous-threshold-${index}`,
      revision: 1,
      date: activity.date,
      type: 'threshold',
      title: `Threshold · ${count} × ${seconds / 60}′ @ ${clockLabel(middle)}`,
      shortName: `Threshold ${count}×${seconds / 60}′`,
      structure: { reps: count, repMinutes: seconds / 60, targetPace: clockLabel(middle) },
      description: 'Controlled threshold: run the pace guide, heart rate under the ceiling.',
      status: 'prescribed',
      blocks: [
        { kind: 'warmup', target: { durationSeconds: warmupSeconds } },
        {
          kind: 'repeat',
          repetitions: count,
          steps: [
            { kind: 'effort', target: { durationSeconds: seconds, paceSecPerKm: guide, hrBpm: { min: 150, max: CONTROLLED_CEILING_BPM } } },
            { kind: 'recovery', target: { durationSeconds: recoverySeconds } },
          ],
        },
        { kind: 'cooldown', target: { durationSeconds: 600 } },
      ],
      provenance,
    }
  })
  const mondayOf = (date) => addDays(date, -((date.getUTCDay() + 6) % 7))
  const lastDay = isoDate(addDays(new Date(`${start}T00:00:00Z`), -1))
  // A plan holds at most five weeks, and on some weekdays the runs reach back into a sixth.
  const earliest = addDays(mondayOf(new Date(`${lastDay}T00:00:00Z`)), -7 * (PREVIOUS_PLAN_MAX_WEEKS - 1))
  const firstMonday = mondayOf(new Date(`${runs[0].date}T00:00:00Z`))
  const monday = firstMonday < earliest ? earliest : firstMonday
  const weeks = []
  for (let weekStart = monday, index = 1; isoDate(weekStart) <= lastDay; weekStart = addDays(weekStart, 7), index++) {
    const startDate = isoDate(weekStart)
    const endDate = isoDate(addDays(weekStart, 6)) < lastDay ? isoDate(addDays(weekStart, 6)) : lastDay
    weeks.push({
      id: `demo-previous-week-${index}`,
      index,
      startDate,
      endDate,
      focus: 'Controlled threshold base',
      workouts: sessions.filter((session) => session.date >= startDate && session.date <= endDate),
    })
  }
  return {
    schemaVersion: 1,
    id: 'demo-previous-plan',
    revision: 1,
    status: 'superseded',
    block: { id: 'demo-previous-block', name: 'Controlled threshold base', startDate: isoDate(monday), endDate: lastDay, focus: 'Controlled threshold base' },
    goal: { kind: 'performance', description: 'General preparation.' },
    weeks,
    provenance,
  }
}

function buildCoachingData(endDate, activities) {
  const latest = activities[activities.length - 1]
  const start = latest ? new Date(latest.date + 'T00:00:00Z') : endDate
  const targetDate = addDays(endDate, 21)
  const createdAt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 8)).toISOString()
  const evaluationCreatedAt = new Date(new Date(createdAt).getTime() + 60 * 60 * 1_000).toISOString()
  const planId = 'demo-coaching-plan'
  const provenance = { source: 'demo', trigger: 'bootstrap', createdAt }
  const controlled = latest ? shapeControlledRuns(activities, latest.date) : null
  const previousPlan = controlled
    ? buildPreviousPlan(controlled, isoDate(start), { ...provenance, createdAt: new Date(new Date(createdAt).getTime() - 30 * 86_400_000).toISOString() })
    : null
  const workout = (id, date, type, title, blocks, totalDurationSeconds, totalDistanceMeters) => ({
    id,
    revision: 1,
    date: isoDate(date),
    type,
    title,
    description: title,
    status: 'prescribed',
    ...(totalDurationSeconds ? { totalDurationSeconds } : {}),
    ...(totalDistanceMeters ? { totalDistanceMeters } : {}),
    blocks,
    provenance,
  })
  const easyBlocks = (distanceMeters) => [{ kind: 'effort', target: { distanceMeters, paceSecPerKm: { min: 300, max: 340 }, hrZone: 2 } }]
  const thresholdBlocks = [
    { kind: 'warmup', target: { distanceMeters: 2_000 } },
    {
      kind: 'repeat',
      repetitions: 3,
      steps: [
        { kind: 'effort', target: { durationSeconds: 480, paceSecPerKm: { min: 265, max: 270 }, hrBpm: { min: 150, max: CONTROLLED_CEILING_BPM } } },
        { kind: 'recovery', target: { durationSeconds: 120 } },
      ],
    },
    { kind: 'cooldown', target: { durationSeconds: 600 } },
  ]
  // In the round numbers a plan uses, so planned and ran differ as they really do.
  const plannedMeters = latest ? Math.max(1, Math.round(latest.distanceKm)) * 1_000 : 8_000
  const plannedSeconds = latest ? Math.max(1, Math.round(latest.durationSeconds / 300)) * 300 : 2_700
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const weekStart = addDays(start, index * 7)
    const weekEnd = addDays(weekStart, 6) < targetDate ? addDays(weekStart, 6) : targetDate
    const first = index === 0 && latest
      ? workout('demo-prescription-completed', new Date(latest.date + 'T00:00:00Z'), latest.type === 'Threshold' ? 'threshold' : 'easy', latest.description || 'Completed session', easyBlocks(plannedMeters), plannedSeconds, plannedMeters)
      : workout(`demo-easy-${index}`, addDays(weekStart, 1), 'easy', 'Easy Run', easyBlocks(8_000), 2_700, 8_000)
    return {
      id: `demo-coaching-week-${index + 1}`,
      index: index + 1,
      startDate: isoDate(weekStart),
      endDate: isoDate(weekEnd),
      focus: index === 0 ? 'Settle into the block' : index === 3 ? 'Absorb the work' : 'Build threshold durability',
      workouts: [
        first,
        workout(`demo-threshold-${index}`, addDays(weekStart, 3), 'threshold', '3 × 8 min threshold', thresholdBlocks, 3_600),
        workout(`demo-long-${index}`, addDays(weekStart, 6), 'long_run', 'Long easy run', easyBlocks(14_000 + index * 1_000), undefined, 14_000 + index * 1_000),
      ].filter((entry) => entry.date <= isoDate(targetDate)),
    }
  })
  const plan = {
    schemaVersion: 1,
    id: planId,
    revision: 1,
    status: 'active',
    // The block is the last four weeks of a twelve-week build.
    macrocycleStartDate: isoDate(addDays(targetDate, -MACROCYCLE_DAYS)),
    block: {
      id: 'demo-coaching-block',
      name: 'Autumn 10K build',
      startDate: isoDate(start),
      endDate: isoDate(targetDate),
      focus: 'Threshold durability',
    },
    targetEvent: {
      id: 'demo-race-0000000000000001',
      name: 'Harbor Lights 10K',
      date: isoDate(targetDate),
      role: 'primary',
      distanceLabel: '10K',
      distanceMeters: 10_000,
      location: 'Fictional Bay',
      targetSeconds: 2_430,
    },
    goal: { kind: 'time', targetSeconds: 2_430, description: 'Run 10K in 40:30.' },
    weeks,
    provenance,
  }
  const bootstrapDecision = {
    schemaVersion: 1,
    id: 'demo-coaching-bootstrap',
    outcome: 'REPLAN',
    trigger: 'bootstrap',
    createdAt,
    effectiveDate: isoDate(start),
    planId,
    basePlanRevision: null,
    resultPlanRevision: 1,
    reasonCodes: ['INITIAL_PLAN'],
    summary: 'Created a focused four-week block for Harbor Lights 10K.',
    evidence: [],
    changes: [{ kind: 'replace_future', effectiveDate: isoDate(start), beforeWeeks: [], afterWeeks: weeks }],
    provenance,
  }
  const evaluationDecision = {
    schemaVersion: 1,
    id: 'demo-coaching-evaluation-decision',
    outcome: 'KEEP',
    trigger: 'post_activity',
    createdAt: evaluationCreatedAt,
    effectiveDate: isoDate(addDays(start, 1)),
    planId,
    basePlanRevision: 1,
    resultPlanRevision: 1,
    reasonCodes: ['SESSION_COMPLETED'],
    summary: 'Session completed as intended. No plan change.',
    evidence: [{ code: 'SESSION_COMPLETE', message: 'The completed run matched the prescribed session type.' }],
    changes: [],
    provenance: { ...provenance, trigger: 'post_activity', createdAt: evaluationCreatedAt },
  }
  const evaluation = latest ? {
    schemaVersion: 1,
    id: 'demo-coaching-evaluation',
    activityId: latest.id,
    activityDate: latest.date,
    prescriptionId: 'demo-prescription-completed',
    planId,
    planRevision: 1,
    matchStatus: 'matched',
    comparison: {
      plannedDistanceMeters: plannedMeters,
      actualDistanceMeters: Math.round(latest.distanceKm * 1_000),
      plannedDurationSeconds: plannedSeconds,
      actualDurationSeconds: latest.durationSeconds,
      ...(latest.paceSecPerKm ? { actualPaceSecPerKm: Math.round(latest.paceSecPerKm) } : {}),
      ...(latest.avgHeartRate ? { actualAvgHrBpm: latest.avgHeartRate } : {}),
    },
    decisionId: evaluationDecision.id,
    summary: evaluationDecision.summary,
    createdAt: evaluationCreatedAt,
    contextHash: 'demo-context',
    provenance: { ...provenance, trigger: 'post_activity', createdAt: evaluationCreatedAt, decisionId: evaluationDecision.id },
  } : null
  const year = createdAt.slice(0, 4)
  const month = latest?.date.slice(0, 7) ?? createdAt.slice(0, 7)
  return {
    'coaching/current_plan.json': plan,
    ...(previousPlan ? { [`coaching/superseded/${previousPlan.id}.json`]: previousPlan } : {}),
    'coaching/coach_state.json': {
      schemaVersion: 1,
      activePlanId: planId,
      activePlanRevision: 1,
      lastDecisionId: evaluationDecision.id,
      lastBootstrapAt: createdAt,
      lastPostActivityAt: createdAt,
      lastWeeklyReviewAt: null,
      updatedAt: createdAt,
    },
    'coaching/decisions/index.json': { keys: [year] },
    [`coaching/decisions/${year}.json`]: { decisions: [bootstrapDecision, evaluationDecision] },
    'coaching/evaluations/index.json': { keys: evaluation ? [month] : [] },
    ...(evaluation ? { [`coaching/evaluations/${month}.json`]: { evaluations: [evaluation] } } : {}),
  }
}

function buildLocationOverrides() {
  return {}
}

function buildSyncMeta(endDate) {
  return { lastSyncedAt: endDate.toISOString() }
}

function buildRecoveryHistory(endDate) {
  // Its own generator, so it moves no other demo number.
  const rng = makeRng(SEED + 54)
  const days = {}
  for (let i = 364; i >= 0; i--) {
    // A day in ten without the watch on.
    if (rng() < 0.1) continue
    const d = addDays(endDate, -i)
    const season = Math.sin((i / 365) * Math.PI * 2)
    days[isoDate(d)] = { restingHr: Math.round(46 - season + between(rng, -1.5, 1.5)) }
  }
  return { days }
}

const STRENGTH_EXERCISES = [
  ['squat', 'goblet_squat'],
  ['lunge', 'dumbbell_lunge'],
  ['hip_raise', 'single_leg_hip_raise'],
  ['calf_raise', 'single_leg_bent_knee_calf_raise'],
  ['plank', 'side_plank'],
  ['core', 'side_abs_leg_lift'],
]

function buildCrossTraining(endDate) {
  // Its own generator, so it moves no other demo number.
  const rng = makeRng(SEED + 71)
  const sessions = []
  let id = 95000001
  for (let i = 182; i >= 0; i--) {
    const d = addDays(endDate, -i)
    const weekday = d.getUTCDay()
    const kind = weekday === 3 && rng() < 0.75 ? 'strength_training'
      : weekday === 6 && rng() < 0.3 ? 'road_biking'
      : weekday === 1 && rng() < 0.2 ? 'yoga'
      : null
    if (!kind) continue
    const date = isoDate(d)
    const durationSeconds = Math.round(kind === 'road_biking' ? between(rng, 3600, 6000) : between(rng, 1500, 2700))
    const sets = kind === 'strength_training'
      ? STRENGTH_EXERCISES.flatMap(([category, exercise]) => Array.from({ length: 2 }, () => ({
          category,
          exercise,
          reps: Math.round(between(rng, 8, 15)),
          ...(category === 'squat' || category === 'lunge' ? { weightKg: 12 } : {}),
          durationSeconds: Math.round(between(rng, 30, 60)),
        })))
      : null
    sessions.push({
      id: String(id++),
      date,
      startTimeLocal: `${date}T18:30:00`,
      sport: kind,
      durationSeconds,
      distanceKm: kind === 'road_biking' ? round(durationSeconds / 3600 * between(rng, 24, 28), 2) : null,
      avgHeartRate: Math.round(kind === 'road_biking' ? between(rng, 118, 132) : between(rng, 92, 110)),
      trainingLoad: round(kind === 'road_biking' ? between(rng, 60, 110) : between(rng, 15, 35), 1),
      ...(sets ? { sets } : {}),
    })
  }
  const byYear = {}
  for (const session of sessions.reverse()) (byYear[session.date.slice(0, 4)] ??= []).push(session)
  return {
    'cross_training/index.json': { years: Object.keys(byYear).sort().reverse() },
    ...Object.fromEntries(Object.entries(byYear).map(([year, entries]) => [`cross_training/${year}.json`, { sessions: entries }])),
  }
}

// The demo runs circle a point in the Pacific where no real quartier exists, so the dataset brings a town of its own,
// in the shape scripts/build-explore-areas.ts writes. Its shapes are fitted to the home runs so that some quartiers
// are complete, some partly explored and Millbrook is fog (scripts/__tests__/demoExploreArea.test.ts).

const EXPLORE_SCHEMA = 1
// The build date is fixed, so the version (the cache key) only changes when the shapes do.
const DEMO_AREA = { id: 'demo', name: 'Fictional Bay', generatedAt: '2026-10-22' }
// The grid of src/domain/explore/grid.ts, which this script cannot import.
const EXPLORE_CELL_M = 150
const M_PER_DEGREE = 111_320
// The origin is a public point about 400 m from home, never home itself, as in a real area.
const DEMO_TOWN_HALL = [-150.003, -0.002]
// [west, south, east, north) in whole cells from the origin, so every border runs along cell edges.
const DEMO_TOWN_UNITS = [
  { slug: 'westbrook', name: 'Westbrook', kind: 'quartier', cells: [-11, -2, -2, 4] },
  { slug: 'old-harbour', name: 'Old Harbour', kind: 'quartier', cells: [-2, -2, 6, 4] },
  { slug: 'eastgate', name: 'Eastgate', kind: 'quartier', cells: [6, -2, 15, 4] },
  { slug: 'riverside', name: 'Riverside', kind: 'quartier', cells: [-11, -8, -2, -2] },
  { slug: 'hillcrest', name: 'Hillcrest', kind: 'quartier', cells: [-2, -8, 6, -2] },
  { slug: 'southfield', name: 'Southfield', kind: 'quartier', cells: [6, -8, 15, -2] },
  { slug: 'millbrook', name: 'Millbrook', kind: 'commune', cells: [-11, -18, 15, -8] },
]
// Cells no path crosses, as the build script leaves out rivers and woods: a one-cell river column and the Hillcrest
// woods ([west, south, east, north)).
export const DEMO_TOWN_GAPS = { riverColumn: -7, woods: [2, -6, 5, -3] }

function isTownGap(i, j) {
  const [west, south, east, north] = DEMO_TOWN_GAPS.woods
  return i === DEMO_TOWN_GAPS.riverColumn || (i >= west && i < east && j >= south && j < north)
}

function exploreCellKey(i, j) {
  return (i + 32_768) * 65_536 + (j + 32_768)
}

function buildDemoExploreArea() {
  const [lon0, lat0] = DEMO_TOWN_HALL
  const kx = M_PER_DEGREE * Math.cos((lat0 * Math.PI) / 180)
  const at = (i, j) => [round(lon0 + (i * EXPLORE_CELL_M) / kx, 6), round(lat0 + (j * EXPLORE_CELL_M) / M_PER_DEGREE, 6)]
  const kindOrder = { quartier: 0, commune: 1 }

  // In the build script's order: quartiers, then communes, each by name.
  const features = [...DEMO_TOWN_UNITS]
    .sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.name.localeCompare(b.name, 'fr'))
    .map(({ slug, name, kind, cells: [west, south, east, north] }) => {
      const id = `${DEMO_AREA.id}-${slug}`
      const runnable = []
      for (let i = west; i < east; i++) {
        for (let j = south; j < north; j++) if (!isTownGap(i, j)) runnable.push(exploreCellKey(i, j))
      }
      return {
        type: 'Feature',
        id,
        properties: {
          id,
          name,
          kind,
          commune: kind === 'commune' ? name : DEMO_AREA.name,
          label: at((west + east) / 2, (south + north) / 2),
          runnable: runnable.sort((a, b) => a - b),
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[at(west, south), at(east, south), at(east, north), at(west, north), at(west, south)]],
        },
      }
    })

  const corners = features.flatMap((f) => f.geometry.coordinates[0])
  const lons = corners.map(([lon]) => lon)
  const lats = corners.map(([, lat]) => lat)
  const bbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
  const { id, name, generatedAt } = DEMO_AREA
  const area = {
    type: 'FeatureCollection',
    runomics: {
      schema: EXPLORE_SCHEMA,
      id,
      name,
      version: '',
      generatedAt,
      grid: { origin: [...DEMO_TOWN_HALL], cellM: EXPLORE_CELL_M },
      bbox,
      sources: [{ id: 'demo', label: 'RunOmics demo data: a fictional town', licence: '', url: '', version: generatedAt }],
    },
    features,
  }
  // The build script's version: the date, then a hash of the file with the version left empty.
  const hash = createHash('sha256').update(JSON.stringify(area)).digest('hex').slice(0, 8)
  area.runomics.version = `${id}-${generatedAt.replaceAll('-', '')}-${hash}`

  return {
    'explore/index.json': { schema: EXPLORE_SCHEMA, areas: [{ id, name, version: area.runomics.version, bbox, file: `${id}.geojson` }] },
    [`explore/${id}.geojson`]: area,
  }
}

// The second athlete's shape, made up: a Forerunner 55 (no Training Effect, status, LTHR or running dynamics), a long
// break, a run/walk return planned in French, and no races, goals, PBs or explore area.
const SPARSE_SEED = 20261102
const SPARSE_CENTER = [-140.0, -5.0]
const SPARSE_ATHLETE = {
  displayName: 'Camille',
  age: 31,
  sex: 'female',
  heightCm: 165,
  weightKg: 58,
  restingHrBpm: 61,
  maxHrBpm: 194,
  hrZoneBoundsBpm: [103, 124, 144, 165, 184],
  vmaKmh: 11.5,
  vo2maxMlKgMin: 37.2,
  fitnessAgeYrs: 32,
  achievableFitnessAgeYrs: 29,
  bmi: 21.3,
  deviceName: 'Forerunner 55',
  deviceFirmware: '21.19',
  deviceSince: '2025-06-01',
}
const SPARSE_GEAR_ID = 'demo-shoe-sparse-000000000001'
const SPARSE_SAMPLE_SECONDS = 30
const WALK_PACE = { min: 660, max: 840 }
// The watch's pace alert for the running minutes, with no heart-rate target.
const RUN_PACE = { min: 470, max: 525 }
// Reps × minutes for each session, Wednesday, Friday and Sunday, over the five weeks of the return block.
const RETURN_WEEKS = [
  [[6, 3], [6, 3], [5, 4]],
  [[5, 4], [5, 4], [4, 6]],
  [[4, 6], [4, 6], [3, 8]],
  [[3, 8], [3, 8], [2, 12]],
  [[2, 12], [2, 12], [2, 15]],
]
const RETURN_WEEKDAY_OFFSETS = [2, 4, 6]
// Garmin names a run after the workout sent to the watch, and spells its primes in ASCII.
const watchName = (reps, minutes) => `Footing · ${reps} × ${minutes}'`

function sparseRun(rng, { id, date, type, description, segments, hrSource = 'wrist' }) {
  const bounds = SPARSE_ATHLETE.hrZoneBoundsBpm
  const samples = segments.flatMap((segment) => Array.from({ length: Math.max(1, Math.round(segment.seconds / SPARSE_SAMPLE_SECONDS)) }, () => ({
    hr: Math.round(segment.hr + between(rng, -4, 4)),
    pace: Math.round(1000 / (segment.speed * between(rng, 0.95, 1.05))),
    cadence: Math.round((segment.speed < 1.6 ? 112 : 158) + between(rng, -3, 3)),
  })))
  const durationSeconds = segments.reduce((sum, s) => sum + s.seconds, 0)
  const metres = segments.reduce((sum, s) => sum + s.seconds * s.speed, 0)
  const distanceKm = round(metres / 1000, 2)
  const paceSecPerKm = round(durationSeconds / distanceKm, 1)
  const avgHeartRate = Math.round(samples.reduce((sum, s) => sum + s.hr, 0) / samples.length)
  const zoneSeconds = [0, 0, 0, 0, 0]
  for (const sample of samples) {
    const zone = bounds.findLastIndex((bound) => sample.hr >= bound)
    if (zone >= 0) zoneSeconds[zone] += SPARSE_SAMPLE_SECONDS
  }
  const runningSpeed = Math.max(...segments.map((s) => s.speed))
  const bouts = []
  let bout = null
  for (const segment of segments) {
    if (segment.speed >= 1.6) {
      bout ??= { seconds: 0, metres: 0 }
      bout.seconds += segment.seconds
      bout.metres += segment.seconds * segment.speed
    } else if (bout) {
      bouts.push(bout)
      bout = null
    }
  }
  if (bout) bouts.push(bout)
  const longestBout = bouts.reduce((best, b) => (b.seconds > best.seconds ? b : best), { seconds: 0, metres: 0 })
  const tempC = round(between(rng, 6, 18), 1)
  const activity = {
    id: String(id),
    week: isoWeek(date),
    date: isoDate(date),
    dayOfWeek: dayOfWeekName(date),
    startTimeLocal: `${isoDate(date)}T18:${pad(Math.round(between(rng, 0, 50)), 2)}:00`,
    type,
    typeSource: 'runomics',
    sport: 'running',
    description,
    durationSeconds,
    distanceKm,
    paceSecPerKm,
    hrZones: zoneSeconds.map((seconds, i) => ({
      zone: i + 1,
      seconds,
      percent: round((seconds / durationSeconds) * 100, 1),
      minBpm: bounds[i],
      maxBpm: i + 1 < bounds.length ? bounds[i + 1] - 1 : null,
    })),
    avgHeartRate,
    hrSource,
    rpe: rng() < 0.4 ? Math.round(between(rng, 3, 6)) : null,
    comment: rng() < 0.25 ? pick(rng, ['Bonnes sensations.', 'Jambes lourdes.', 'Il pleuvait, sortie courte.']) : '',
    route: generateRoute(rng, distanceKm, SPARSE_CENTER),
    elevationGain: round(between(rng, 5, 40), 1),
    aerTrainingEffect: null,
    anaTrainingEffect: null,
    hrSamples: samples.map((s) => s.hr),
    elevationProfile: smoothSeries(rng, samples.length, 30, 2),
    calories: Math.round(distanceKm * 55),
    cadenceSpm: round(samples.reduce((sum, s) => sum + s.cadence, 0) / samples.length, 1),
    groundContactMs: null,
    verticalOscillationMm: null,
    verticalRatioPct: null,
    strideLengthM: null,
    bestEfforts: distanceKm >= 1 ? { '1k': Math.round(1000 / runningSpeed) } : null,
    paceSamples: samples.map((s) => s.pace),
    vo2maxGarmin: SPARSE_ATHLETE.vo2maxMlKgMin,
    avgTemperature: null,
    cadenceSamples: samples.map((s) => s.cadence),
    longestContinuousRunSec: longestBout.seconds,
    longestContinuousRunM: round(longestBout.metres, 1),
    runningSec: bouts.reduce((sum, b) => sum + b.seconds, 0),
    splits: segments.map((segment) => ({
      type: segment.type,
      durationSec: segment.seconds,
      distanceM: round(segment.seconds * segment.speed, 1),
      avgSpeedMs: round(segment.speed, 4),
      avgHr: segment.hr,
      laps: [{ durationSec: segment.seconds, distanceM: round(segment.seconds * segment.speed, 1), avgSpeedMs: round(segment.speed, 4), avgHr: segment.hr }],
    })),
    gearId: SPARSE_GEAR_ID,
    weather: {
      tempC,
      apparentTempC: round(tempC - between(rng, 0, 3), 1),
      humidityPct: Math.round(between(rng, 55, 90)),
      windKph: round(between(rng, 3, 20), 1),
      windDirDeg: Math.round(between(rng, 0, 359)),
      precipitationMm: rng() < 0.3 ? round(between(rng, 0.2, 2), 1) : 0,
      code: pick(rng, [0, 2, 3, 61]),
    },
  }
  addPaceProfile(activity)
  return activity
}

function easySegments(rng) {
  const km = Math.round(between(rng, 4, 8))
  return Array.from({ length: km }, () => {
    const speed = 1000 / between(rng, 375, 420)
    return { type: 'lap', seconds: Math.round(1000 / speed), speed, hr: Math.round(between(rng, 148, 160)) }
  })
}

function runWalkSegments(rng, reps, minutes) {
  const walk = (type, seconds) => ({ type, seconds, speed: between(rng, 1.3, 1.45), hr: Math.round(between(rng, 112, 128)) })
  const segments = [walk('interval_warmup', 300)]
  for (let rep = 0; rep < reps; rep++) {
    segments.push({ type: 'interval_active', seconds: minutes * 60, speed: between(rng, 1.9, 2.1), hr: Math.round(between(rng, 150, 162)) })
    if (rep < reps - 1) segments.push({ ...walk('interval_recovery', 60), hr: Math.round(between(rng, 138, 148)) })
  }
  segments.push(walk('interval_cooldown', 300))
  return segments
}

function returnWorkout(date, week, index, [reps, minutes], provenance) {
  return {
    id: `demo-sparse-plan:workout:${week + 1}:${index + 1}`,
    revision: 1,
    date: isoDate(date),
    type: 'easy',
    title: `Footing · ${reps} × ${minutes}′`,
    shortName: `Footing ${reps}×${minutes}′`,
    structure: { reps, repMinutes: minutes },
    description: `Course très lente en alternance avec la marche : ${minutes} minutes de course, 1 minute de marche, ${reps} fois. Tu dois pouvoir parler en phrases complètes pendant la course.`,
    status: 'prescribed',
    blocks: [
      { kind: 'warmup', target: { durationSeconds: 300 }, notes: ['5 minutes de marche active pour démarrer.'] },
      {
        kind: 'repeat',
        repetitions: reps,
        steps: [
          { kind: 'effort', target: { durationSeconds: minutes * 60, paceSecPerKm: RUN_PACE }, notes: ['Course très lente, au rythme où tu peux parler.'] },
          { kind: 'recovery', target: { durationSeconds: 60 }, notes: ['1 minute de marche.'] },
        ],
      },
      { kind: 'cooldown', target: { durationSeconds: 300 }, notes: ['5 minutes de marche pour finir en douceur.'] },
    ],
    notes: ['Un verre d’eau en rentrant.'],
    provenance,
  }
}

function plannedFromWorkout(workout) {
  const { reps, repMinutes } = workout.structure
  const steps = [{ kind: 'warmup', minutes: 5, seconds: 300, paceSecPerKm: [WALK_PACE.min, WALK_PACE.max] }]
  for (let rep = 1; rep <= reps; rep++) {
    steps.push({ kind: 'effort', minutes: repMinutes, rep, paceSecPerKm: [RUN_PACE.min, RUN_PACE.max] })
    if (rep < reps) steps.push({ kind: 'recovery', minutes: 1, rep, paceSecPerKm: [WALK_PACE.min, WALK_PACE.max] })
  }
  steps.push({ kind: 'cooldown', minutes: 5, seconds: 300, paceSecPerKm: [WALK_PACE.min, WALK_PACE.max] })
  const durationSecs = 600 + reps * repMinutes * 60 + (reps - 1) * 60
  return { date: workout.date, name: watchName(reps, repMinutes), distanceM: Math.round(durationSecs * 1.7), durationSecs, steps }
}

export function generateSparseDataset({ now = new Date() } = {}) {
  const rng = makeRng(SPARSE_SEED)
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const monday = addDays(endDate, -((endDate.getUTCDay() + 6) % 7))
  const blockStart = addDays(monday, -14)
  const breakEnd = addDays(blockStart, -1)
  const breakStart = addDays(blockStart, -200)
  // The armband arrives at the start of the block's second week, as hers did mid-block.
  const hrReliableFrom = addDays(blockStart, 7)
  const historyStart = addDays(breakStart, -180)

  const activities = []
  let id = 91000001
  for (let date = historyStart; date < breakStart; date = addDays(date, 1)) {
    if (![0, 3, 6].includes(date.getUTCDay()) || rng() < 0.3) continue
    activities.push(sparseRun(rng, { id: id++, date, type: 'Base', description: rng() < 0.8 ? 'Course à pied' : 'Footing', segments: easySegments(rng) }))
  }

  const createdAt = new Date(blockStart.getTime() - 86_400_000 + 18 * 3_600_000).toISOString()
  const provenance = { source: 'demo', trigger: 'bootstrap', createdAt }
  const planId = 'demo-sparse-plan'
  const weeks = RETURN_WEEKS.map((sessions, week) => {
    const weekStart = addDays(blockStart, week * 7)
    return {
      id: `${planId}:week:${week + 1}`,
      index: week + 1,
      startDate: isoDate(weekStart),
      endDate: isoDate(addDays(weekStart, 6)),
      focus: week === 0
        ? 'On démarre doucement : des blocs de 3 minutes de course très lente, avec 1 minute de marche entre chaque.'
        : 'Les blocs de course s’allongent ; si une séance a été difficile, refaire la semaine précédente est une très bonne idée.',
      workouts: sessions.map((shape, index) => returnWorkout(addDays(weekStart, RETURN_WEEKDAY_OFFSETS[index]), week, index, shape, provenance)),
    }
  })
  const workouts = weeks.flatMap((week) => week.workouts)
  const done = workouts.filter((workout) => workout.date < isoDate(endDate))
  for (const [index, workout] of done.entries()) {
    // A missed session, so adherence reads less than all.
    if (index === 1) continue
    const { reps, repMinutes } = workout.structure
    activities.push(sparseRun(rng, {
      id: id++,
      date: new Date(`${workout.date}T00:00:00Z`),
      // Runs synced before the walk/run fix carry a wrong quality guess that the session overrides.
      type: index < 3 ? 'VO2Max' : 'Base',
      description: index === 3 ? 'Course à pied' : watchName(reps, repMinutes),
      segments: runWalkSegments(rng, reps, repMinutes),
      hrSource: workout.date >= isoDate(hrReliableFrom) ? 'external' : 'wrist',
    }))
  }

  const plan = {
    schemaVersion: 1,
    id: planId,
    revision: 1,
    status: 'active',
    block: {
      id: `${planId}:block`,
      name: 'Reprise en douceur',
      startDate: isoDate(blockStart),
      endDate: isoDate(addDays(blockStart, RETURN_WEEKS.length * 7 - 1)),
      focus: 'Cinq semaines pour te réhabituer à courir : trois sorties par semaine en alternant course très lente et marche.',
    },
    trainingPreferences: { availableWeekdays: [3, 5, 0], runsPerWeek: 3 },
    macrocycleStartDate: isoDate(blockStart),
    goal: { kind: 'performance', description: 'Progresser en forme générale, sans course visée.' },
    weeks,
    provenance,
  }
  const decision = {
    schemaVersion: 1,
    id: 'demo-sparse-bootstrap',
    outcome: 'REPLAN',
    trigger: 'bootstrap',
    createdAt,
    effectiveDate: isoDate(blockStart),
    planId,
    basePlanRevision: null,
    resultPlanRevision: 1,
    reasonCodes: ['INITIAL_PLAN'],
    summary: 'Un bloc de reprise en course et marche, après l’arrêt.',
    evidence: [],
    changes: [{ kind: 'replace_future', effectiveDate: isoDate(blockStart), beforeWeeks: [], afterWeeks: weeks }],
    provenance,
  }

  const months = {}
  for (const a of activities) (months[a.date.slice(0, 7)] ??= []).push(a)
  const runEvery = (step) => activities.filter((_, i) => i % step === 0)
  const plannedYears = {}
  for (const workout of workouts) (plannedYears[workout.date.slice(0, 4)] ??= []).push(plannedFromWorkout(workout))

  const cycling = []
  for (let date = addDays(breakStart, 60), cid = 96000001; date < breakEnd; date = addDays(date, 1)) {
    if (date.getUTCDay() !== 6 || rng() < 0.4) continue
    const durationSeconds = Math.round(between(rng, 2400, 4200))
    cycling.push({
      id: String(cid++),
      date: isoDate(date),
      startTimeLocal: `${isoDate(date)}T10:00:00`,
      sport: 'cycling',
      durationSeconds,
      distanceKm: round((durationSeconds / 3600) * between(rng, 16, 20), 2),
      avgHeartRate: Math.round(between(rng, 115, 130)),
      trainingLoad: null,
    })
  }
  const crossByYear = {}
  for (const session of cycling.reverse()) (crossByYear[session.date.slice(0, 4)] ??= []).push(session)

  const files = {
    'athlete.json': {
      ...SPARSE_ATHLETE,
      trainingBreaks: [{ start: isoDate(breakStart), end: isoDate(breakEnd), reason: 'illness', note: 'Arrêt fictif du profil de test.' }],
      hrReliableFrom: isoDate(hrReliableFrom),
      injuryHistory: { reviewedOn: isoDate(breakEnd), injuries: [] },
      lastUpdate: endDate.toISOString(),
    },
    'athlete_history.json': {
      days: Object.fromEntries(runEvery(12).map((a) => [a.date, { vo2maxMlKgMin: a.vo2maxGarmin, weightKg: SPARSE_ATHLETE.weightKg }])),
    },
    'fitness_age_history.json': {
      weeks: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [
        isoDate(addDays(endDate, -7 * i)),
        { fitnessAgeYrs: SPARSE_ATHLETE.fitnessAgeYrs + (i > 2 && i < 30 ? 1 : 0), bmi: SPARSE_ATHLETE.bmi },
      ])),
    },
    'shoes.json': { shoes: [{ gearId: SPARSE_GEAR_ID, brand: 'Velox', model: 'Daily 3', maxKm: 800, retired: false, firstUseDate: isoDate(historyStart) }] },
    'training_status.json': { days: {}, weeks: {} },
    'vo2max_history.json': {
      days: Object.fromEntries(runEvery(8).map((a) => [a.date, { date: a.date, vo2max: a.vo2maxGarmin }])),
      months: Object.fromEntries(runEvery(8).map((a) => [`${a.date.slice(0, 7)}-01`, { date: `${a.date.slice(0, 7)}-01`, vo2max: a.vo2maxGarmin }])),
    },
    'vo2max_norms.json': GENERIC_VO2MAX_NORMS,
    'recovery_history.json': {
      days: Object.fromEntries(Array.from({ length: 300 }, (_, i) => addDays(endDate, -i))
        .filter(() => rng() > 0.3)
        .map((d) => [isoDate(d), { restingHr: Math.round(between(rng, 58, 64)) }])),
    },
    'race_predictions.json': {
      days: Object.fromEntries(runEvery(6).map((a) => [a.date, { '5k': 1_980, '10k': 4_150, half: 9_250, marathon: 19_700 }])),
    },
    'upcoming_races.json': { races: [] },
    'location-overrides.json': {},
    'sync_meta.json': { lastSyncedAt: endDate.toISOString() },
    'activities/index.json': { months: Object.keys(months).sort().reverse() },
    'planned_workouts/index.json': { years: Object.keys(plannedYears).sort().reverse() },
    'cross_training/index.json': { years: Object.keys(crossByYear).sort().reverse() },
    'coaching/current_plan.json': plan,
    'coaching/coach_state.json': {
      schemaVersion: 1,
      activePlanId: planId,
      activePlanRevision: 1,
      lastDecisionId: decision.id,
      lastBootstrapAt: createdAt,
      lastPostActivityAt: null,
      lastWeeklyReviewAt: null,
      macrocycle: { targetEventId: 'general', startDate: isoDate(blockStart) },
      updatedAt: createdAt,
    },
    'coaching/decisions/index.json': { keys: [createdAt.slice(0, 4)] },
    [`coaching/decisions/${createdAt.slice(0, 4)}.json`]: { decisions: [decision] },
  }
  for (const [month, runs] of Object.entries(months)) files[`activities/${month}.json`] = { activities: runs.sort((a, b) => b.date.localeCompare(a.date)) }
  for (const [year, planned] of Object.entries(plannedYears)) files[`planned_workouts/${year}.json`] = { planned }
  for (const [year, sessions] of Object.entries(crossByYear)) files[`cross_training/${year}.json`] = { sessions }
  return files
}

export function generateDemoDataset({ now = new Date(), profile = 'rich' } = {}) {
  if (profile === 'sparse') return generateSparseDataset({ now })
  const rng = makeRng(SEED)
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const totalDays = MONTHS_BACK * 30
  const startDate = addDays(endDate, -totalDays)

  const activities = buildActivities(rng, endDate)
  activities.forEach(addPaceProfile)
  const { trainingStatus, trainingLoadBalance } = buildTrainingStatusAndBalance(rng, activities, endDate)
  const { vo2maxHistory, thresholdHistory } = buildVo2maxAndThresholdHistory(activities)

  const months = {}
  for (const a of activities) {
    const key = a.date.slice(0, 7)
    months[key] = months[key] ?? []
    months[key].push(a)
  }
  const monthKeys = Object.keys(months).sort().reverse()

  const plannedByYear = buildPlannedWorkouts(rng, endDate)
  const plannedYears = Object.keys(plannedByYear).sort().reverse()

  const files = {
    // Updated by the same sync as sync_meta.json below, as a real one is.
    'athlete.json': { ...ATHLETE, lastUpdate: endDate.toISOString() },
    'athlete_history.json': buildAthleteHistory(activities),
    'fitness_age_history.json': buildFitnessAgeHistory(endDate),
    'goals.json': buildGoals(),
    'pbs.json': buildPbs(activities),
    'shoes.json': { shoes: SHOES },
    'training_status.json': trainingStatus,
    'training_load_balance.json': trainingLoadBalance,
    'training_plan.json': buildTrainingPlan(endDate),
    'threshold_history.json': thresholdHistory,
    'vo2max_history.json': vo2maxHistory,
    'vo2max_norms.json': GENERIC_VO2MAX_NORMS,
    'recovery_history.json': buildRecoveryHistory(endDate),
    'race_predictions.json': buildRacePredictions(activities, startDate, totalDays),
    'upcoming_races.json': buildUpcomingRaces(endDate),
    'location-overrides.json': buildLocationOverrides(),
    'sync_meta.json': buildSyncMeta(endDate),
    'activities/index.json': { months: monthKeys },
    'planned_workouts/index.json': { years: plannedYears },
    ...buildCoachingData(endDate, activities),
    ...buildDemoExploreArea(),
    ...buildCrossTraining(endDate),
  }
  for (const [month, acts] of Object.entries(months)) {
    files[`activities/${month}.json`] = { activities: acts.sort((a, b) => b.date.localeCompare(a.date)) }
  }
  for (const [year, entries] of Object.entries(plannedByYear)) {
    files[`planned_workouts/${year}.json`] = { planned: entries.sort((a, b) => a.date.localeCompare(b.date)) }
  }

  return files
}

export function writeDemoDataset(baseDir, dataset = generateDemoDataset()) {
  for (const [relativePath, value] of Object.entries(dataset)) {
    const fullPath = path.join(baseDir, relativePath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, JSON.stringify(value, null, 2) + '\n')
  }
}

const GENERIC_VO2MAX_NORMS = {
  female: {
    '20-29': { fair: 36.1, good: 39.5, excellent: 43.9, superior: 49.6 },
    '30-39': { fair: 34.4, good: 37.8, excellent: 42.4, superior: 47.4 },
    '40-49': { fair: 33.0, good: 36.3, excellent: 39.7, superior: 45.3 },
    '50-59': { fair: 30.1, good: 33.0, excellent: 36.7, superior: 41.1 },
    '60-69': { fair: 27.5, good: 30.0, excellent: 33.0, superior: 37.8 },
    '70-79': { fair: 25.9, good: 28.1, excellent: 30.9, superior: 36.7 },
  },
  male: {
    '20-29': { fair: 41.7, good: 45.4, excellent: 51.1, superior: 55.4 },
    '30-39': { fair: 40.5, good: 44.0, excellent: 48.3, superior: 54.0 },
    '40-49': { fair: 38.5, good: 42.4, excellent: 46.4, superior: 52.5 },
    '50-59': { fair: 35.6, good: 39.2, excellent: 43.4, superior: 48.9 },
    '60-69': { fair: 32.3, good: 35.5, excellent: 39.5, superior: 45.7 },
    '70-79': { fair: 29.4, good: 32.3, excellent: 36.7, superior: 42.1 },
  },
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const flag = args.indexOf('--profile')
  const profile = flag >= 0 ? args.splice(flag, 2)[1] : 'rich'
  if (profile !== 'rich' && profile !== 'sparse') throw new Error(`Unknown profile ${profile}: use rich or sparse.`)
  const outDir = args[0] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data')
  writeDemoDataset(outDir, generateDemoDataset({ profile }))
  console.log(`Demo dataset (${profile}) written to ${outDir}`)
}
