#!/usr/bin/env node
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
function addDays(d, days) {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
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
  { type: 'VO2Max', weight: 10, paceMult: [0.86, 0.92], descriptions: ['Intervals'] },
  { type: 'Sprint', weight: 5, paceMult: [0.75, 0.85], descriptions: ['Sprint Session'] },
]

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
    const avgHeartRate = Math.round(
      ATHLETE.restingHrBpm +
        (ATHLETE.maxHrBpm - ATHLETE.restingHrBpm) * (1 - (paceSecPerKm - 150) / 200) * between(rng, 0.92, 1.0)
    )

    const hrZones = buildHrZones(rng, durationSeconds, session.type)
    const isAway = dayOffset >= awayStart && dayOffset < awayStart + AWAY_TRIP.days
    const route = generateRoute(rng, distanceKm, isAway ? ROUTE_CENTERS.away : ROUTE_CENTERS.home)
    const sampleLen = Math.max(20, Math.min(80, Math.round(distanceKm * 4)))

    const bestEfforts = {}
    if (isRaceDay) {
      bestEfforts[raceKey] = durationSeconds
    } else {
      if (distanceKm >= 1) bestEfforts['1k'] = round(paceSecPerKm * between(rng, 0.88, 0.95), 1)
      if (distanceKm >= 5 && (session.type === 'Tempo' || session.type === 'Threshold')) {
        bestEfforts['5k'] = round(paceSecPerKm * 5 * between(rng, 0.95, 1.0), 1)
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
      polyline: null,
      route,
      elevationGain: round(between(rng, 10, 120), 1),
      aerTrainingEffect: round(between(rng, 1.5, 4.2), 1),
      anaTrainingEffect: round(between(rng, 0.3, 2.5), 1),
      hrSamples: smoothSeries(rng, sampleLen, avgHeartRate, 4),
      elevationProfile: smoothSeries(rng, sampleLen, 20, 3),
      calories: Math.round(distanceKm * 62),
      cadenceSpm: round(between(rng, 168, 182), 1),
      groundContactMs: round(between(rng, 230, 260), 1),
      verticalOscillationMm: round(between(rng, 75, 95), 1),
      verticalRatioPct: round(between(rng, 6.5, 8.5), 1),
      strideLengthM: round(1000 / paceSecPerKm / (170 / 60), 2),
      bestEfforts: Object.keys(bestEfforts).length ? bestEfforts : null,
      paceSamples: smoothSeries(rng, sampleLen, paceSecPerKm, 8),
      vo2maxGarmin: round(42 + progress * 8, 1),
      avgTemperature: Math.round(between(rng, 8, 24)),
      cadenceSamples: smoothSeries(rng, sampleLen, 175, 3),
      splits: session.type === 'VO2Max' || session.type === 'Threshold' ? buildSplits(rng, session.type, distanceKm, paceSecPerKm, avgHeartRate) : null,
      gearId,
      weather: { tempC: round(between(rng, 8, 24), 1), humidityPct: Math.round(between(rng, 40, 85)), code: pick(rng, [0, 1, 2, 3, 61]) },
    })
  }

  return activities
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
      minBpm: i === 0 ? 100 : bounds[i - 1],
      maxBpm: i < bounds.length ? bounds[i] : null,
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

function buildTrainingStatusAndBalance(rng, activities) {
  const days = {}
  const weeks = {}
  const statuses = ['productive', 'maintaining', 'peaking', 'recovery']

  for (const a of activities) {
    if (rng() < 0.3) continue
    const status = pick(rng, statuses)
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
  const start = addDays(endDate, -14)
  const end = addDays(endDate, 42)
  return {
    planId: 10000001,
    name: 'Demo 10K Build',
    startDate: isoDate(start),
    endDate: isoDate(end),
    phases: [
      { phase: 'BASE', startDate: isoDate(start), endDate: isoDate(addDays(start, 20)) },
      { phase: 'BUILD', startDate: isoDate(addDays(start, 21)), endDate: isoDate(addDays(start, 41)) },
      { phase: 'PEAK', startDate: isoDate(addDays(start, 42)), endDate: isoDate(addDays(start, 49)) },
      { phase: 'TAPER', startDate: isoDate(addDays(start, 50)), endDate: isoDate(end) },
    ],
  }
}

function buildUpcomingRaces(endDate) {
  return {
    races: [
      { garminEventUuid: 'demo-race-0000000000000001', date: isoDate(addDays(endDate, 21)), name: 'Harbor Lights 10K', distance: '10K', location: 'Fictional Bay' },
      { garminEventUuid: 'demo-race-0000000000000002', date: isoDate(addDays(endDate, 63)), name: 'Autumn Trail Half', distance: 'Half-Marathon', location: 'Fictional Bay' },
    ],
  }
}

function buildPlannedWorkouts(rng, endDate) {
  const byYear = {}
  const names = ['Threshold', 'Intervals', 'Long Run', 'Easy Run', 'Tempo']
  for (let i = -7; i <= 30; i++) {
    if (rng() < 0.55) continue
    const date = addDays(endDate, i)
    const year = String(date.getFullYear())
    byYear[year] = byYear[year] ?? []
    byYear[year].push({
      date: isoDate(date),
      name: pick(rng, names),
      type: pick(rng, ['Base', 'Tempo', 'Threshold', 'VO2Max']),
      distanceM: Math.round(between(rng, 6000, 16000)),
      durationSecs: Math.round(between(rng, 1800, 5400)),
      scheduledTime: pick(rng, ['Morning', 'Afternoon', 'Evening']),
    })
  }
  return byYear
}

function buildLocationOverrides() {
  return {}
}

function buildSyncMeta(endDate) {
  return { lastSyncedAt: endDate.toISOString() }
}

export function generateDemoDataset({ now = new Date() } = {}) {
  const rng = makeRng(SEED)
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const totalDays = MONTHS_BACK * 30
  const startDate = addDays(endDate, -totalDays)

  const activities = buildActivities(rng, endDate)
  const { trainingStatus, trainingLoadBalance } = buildTrainingStatusAndBalance(rng, activities)
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
    'athlete.json': ATHLETE,
    'athlete_history.json': buildAthleteHistory(activities),
    'goals.json': buildGoals(),
    'pbs.json': buildPbs(activities),
    'shoes.json': { shoes: SHOES },
    'training_status.json': trainingStatus,
    'training_load_balance.json': trainingLoadBalance,
    'training_plan.json': buildTrainingPlan(endDate),
    'threshold_history.json': thresholdHistory,
    'vo2max_history.json': vo2maxHistory,
    'vo2max_norms.json': GENERIC_VO2MAX_NORMS,
    'race_predictions.json': buildRacePredictions(activities, startDate, totalDays),
    'upcoming_races.json': buildUpcomingRaces(endDate),
    'location-overrides.json': buildLocationOverrides(),
    'sync_meta.json': buildSyncMeta(endDate),
    'activities/index.json': { months: monthKeys },
    'planned_workouts/index.json': { years: plannedYears },
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
  const outDir = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data')
  writeDemoDataset(outDir)
  console.log(`Demo dataset written to ${outDir}`)
}
