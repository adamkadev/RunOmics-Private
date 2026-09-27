import { describe, expect, it } from 'vitest'
import {
  deservesVerdict,
  isFreshRun,
  repeatsEarlierVerdict,
  RUN_VERDICT_SYSTEM_INSTRUCTION,
  runVerdictInsightHash as hashContext,
  runVerdictInsightPrompt,
  verdictLines,
} from '../runVerdictInsight'
import { runHistory } from '@/domain/activity/runHistory'
import type { Activity, ActivityWeather } from '@/domain/activity/types'

const runVerdictInsightHash = (activity: Activity) =>
  hashContext({ activity, history: runHistory(activity, []), planned: null })

const weather: ActivityWeather = {
  tempC: 16.4,
  apparentTempC: 14.2,
  humidityPct: 55,
  windKph: 10.4,
  windDirDeg: 304,
  precipitationMm: 0,
  code: 2,
}

const run = (overrides: Partial<Activity>): Activity =>
  ({
    date: '2026-06-14',
    type: 'Base',
    distanceKm: 10,
    durationSeconds: 55 * 60,
    paceSecPerKm: 330,
    avgHeartRate: 148,
    rpe: null,
    aerTrainingEffect: null,
    elevationGain: null,
    avgTemperature: 22,
    weather: null,
    hrZones: [],
    hrSamples: null,
    paceSamples: null,
    splits: null,
    ...overrides,
  }) as Activity

describe('runVerdictInsightHash weather cutoff', () => {
  it('leaves runs before the cutoff keyed on the watch sensor', () => {
    const old = { date: '2026-05-07' }

    expect(runVerdictInsightHash(run({ ...old, weather }))).toBe(
      runVerdictInsightHash(run({ ...old, weather: null }))
    )
  })

  it('rehashes a run before the cutoff when the watch reading changes', () => {
    expect(runVerdictInsightHash(run({ date: '2026-05-07', avgTemperature: 22 }))).not.toBe(
      runVerdictInsightHash(run({ date: '2026-05-07', avgTemperature: 18 }))
    )
  })

  it('keys runs from the cutoff onwards on the weather instead', () => {
    const recent = { date: '2026-05-08' }

    expect(runVerdictInsightHash(run({ ...recent, weather }))).not.toBe(
      runVerdictInsightHash(run({ ...recent, weather: null }))
    )
  })

  it('ignores the watch sensor from the cutoff onwards', () => {
    const recent = { date: '2026-05-08', weather }

    expect(runVerdictInsightHash(run({ ...recent, avgTemperature: 22 }))).toBe(
      runVerdictInsightHash(run({ ...recent, avgTemperature: 18 }))
    )
  })

  it('holds a recent run on the watch sensor until its conditions land', () => {
    const awaiting = { date: '2026-07-29', weather: null }

    expect(runVerdictInsightHash(run({ ...awaiting, avgTemperature: 22 }))).not.toBe(
      runVerdictInsightHash(run({ ...awaiting, avgTemperature: 18 }))
    )
  })

  it('rounds the apparent temperature so a decimal never rehashes a verdict', () => {
    expect(
      runVerdictInsightHash(run({ weather: { ...weather, apparentTempC: 14.2 } }))
    ).toBe(runVerdictInsightHash(run({ weather: { ...weather, apparentTempC: 14.4 } })))
  })
})

describe('deservesVerdict', () => {
  const now = new Date('2026-07-30T10:00:00')
  const records = new Set(['pb-run'])

  it('covers a run recent enough to still be opened', () => {
    expect(deservesVerdict({ id: 'a', date: '2026-07-25' }, records, now)).toBe(true)
  })

  it('skips an old run nobody navigates back to', () => {
    expect(deservesVerdict({ id: 'a', date: '2026-01-10' }, records, now)).toBe(false)
  })

  it('still covers an old run that holds a record, since /records links to it', () => {
    expect(deservesVerdict({ id: 'pb-run', date: '2025-03-02' }, records, now)).toBe(true)
  })
})

describe('isFreshRun', () => {
  const now = new Date('2026-07-30T10:00:00')

  it('covers the run that just synced', () => {
    expect(isFreshRun({ date: '2026-07-30T06:12:00' }, now)).toBe(true)
  })

  it('still covers a run the sync only made visible the day after', () => {
    expect(isFreshRun({ date: '2026-07-28T06:12:00' }, now)).toBe(true)
  })

  it('leaves an older run to the backfill', () => {
    expect(isFreshRun({ date: '2026-07-20' }, now)).toBe(false)
  })
})

describe('official race performance in the verdict', () => {
  const escherOfficial = {
    activityId: 'escher', eventName: 'Escher Kulturlaf', date: '2026-09-05',
    distanceMeters: 5_000, chipTimeSeconds: 1_292, gunTimeSeconds: 1_293, overallPlace: 28, finisherCount: 188,
  }

  const escher = {
    id: 'escher',
    date: '2026-09-05',
    type: 'Race',
    description: 'Escher Kulturlaf',
    distanceKm: 5.25,
    durationSeconds: 1_310,
    paceSecPerKm: 249.5,
    avgHeartRate: 196,
    rpe: 10,
    aerTrainingEffect: 5,
    elevationGain: 19,
    hrZones: [],
    splits: [],
    bestEfforts: { '5k': 1237.6 },
  } as unknown as Activity

  const context = (official: typeof escherOfficial | null) => ({
    activity: escher,
    history: runHistory(escher, [escher], official ? [official] : []),
    planned: null,
    official,
  })

  const promptFacts = (official: typeof escherOfficial | null) =>
    runVerdictInsightPrompt(context(official), [])

  it('states the certified distance and chip time, not the GPS reading', () => {
    const prompt = promptFacts(escherOfficial)

    expect(prompt).toContain('5 km in 22 min')
    expect(prompt).not.toContain('5.25 km')
  })

  it('gives the official pace rather than the over-read one', () => {
    expect(promptFacts(escherOfficial)).toContain('4:18 /km')
    expect(promptFacts(escherOfficial)).not.toContain('4:09 /km')
  })

  it('reads the placing against the field it was run in', () => {
    expect(promptFacts(escherOfficial)).toContain('Finished 28 of 188')
  })

  it('never offers the device best effort as the race performance', () => {
    expect(promptFacts(escherOfficial)).not.toContain('20:38')
    expect(promptFacts(escherOfficial)).not.toContain('20:37')
  })

  it('keeps the raw device shape when no official result is linked', () => {
    const prompt = promptFacts(null)

    expect(prompt).toContain('5.25 km')
    expect(prompt).not.toContain('certified course')
  })

  it('changes the hash when an official result arrives over unchanged Garmin data', () => {
    expect(hashContext(context(escherOfficial))).not.toBe(hashContext(context(null)))
  })

  it('changes the hash again when the certified time itself is corrected', () => {
    const corrected = { ...escherOfficial, chipTimeSeconds: 1_290 }

    expect(hashContext(context(corrected))).not.toBe(hashContext(context(escherOfficial)))
  })

  it('changes the hash when only the placing is corrected', () => {
    const corrected = { ...escherOfficial, overallPlace: 27 }

    expect(hashContext(context(corrected))).not.toBe(hashContext(context(escherOfficial)))
  })

  it('leaves a run without an official result hashing exactly as before', () => {
    const tempo = { ...escher, id: 'tempo', type: 'Tempo', bestEfforts: {} } as Activity
    const withResults = { activity: tempo, history: runHistory(tempo, [tempo], [escherOfficial]), planned: null, official: null }
    const withoutResults = { activity: tempo, history: runHistory(tempo, [tempo]), planned: null }

    expect(hashContext(withResults)).toBe(hashContext(withoutResults))
  })
})

describe('repeatsEarlierVerdict', () => {
  const written = [{ headline: 'Target base effort mastered', body: 'Splits packed tight.' }]

  it('rejects the headline a lite model handed back verbatim despite the avoid list', () => {
    expect(repeatsEarlierVerdict({ headline: 'Target base effort mastered' }, written)).toBe(true)
  })

  it('rejects a repeat dressed up in different casing, spacing or end punctuation', () => {
    expect(repeatsEarlierVerdict({ headline: '  target base effort MASTERED.  ' }, written)).toBe(true)
  })

  it('passes a verdict that found its own angle', () => {
    expect(repeatsEarlierVerdict({ headline: 'Controlled aerobic building' }, written)).toBe(false)
  })

  it('passes the first verdict of a batch, which has nothing to repeat', () => {
    expect(repeatsEarlierVerdict({ headline: 'Faster aerobic engine' }, [])).toBe(false)
  })
})

describe('verdictLines', () => {
  it('hands the avoid clause the body as well, since that is what repeated', () => {
    expect(verdictLines([{ headline: 'Faster aerobic engine', body: 'Held drift to 8 bpm.' }])).toEqual([
      'Faster aerobic engine / Held drift to 8 bpm.',
    ])
  })
})

describe('what the run was for (v4.16.4)', () => {
  const split = (type: string, durationSec: number, distanceM: number, avgHr: number | null = null, laps: unknown[] = []) => ({
    type,
    durationSec,
    distanceM,
    avgSpeedMs: distanceM / durationSec,
    avgHr,
    laps,
  })
  const lap = (durationSec: number, avgHr: number) => ({ durationSec, distanceM: 1000, avgSpeedMs: 1000 / durationSec, avgHr })
  const effortRep = (rep: number, minutes: number, band: [number, number], seconds?: number) => ({
    kind: 'effort' as const,
    minutes,
    rep,
    paceSecPerKm: band,
    ...(seconds === undefined ? {} : { seconds }),
  })

  // 23 Sep: 3 x 7:00 at 4:25, 4:25, 4:24 against 4:22-4:28.
  const thresholdPlan = {
    date: '2026-09-23',
    name: 'Threshold 3 x 7:00',
    type: 'Threshold' as const,
    durationSecs: 3236,
    steps: [1, 2, 3].map((rep) => effortRep(rep, 7, [262, 268])),
  }
  const thresholdRun = (paces: number[], rpe = 7) =>
    run({
      id: 't',
      date: '2026-09-23',
      type: 'Threshold',
      rpe,
      durationSeconds: 3387,
      distanceKm: 10.16,
      paceSecPerKm: 333,
      splits: [split('interval_warmup', 732, 2000, 147), ...paces.map((pace, i) => split('interval_active', 420, (420 / pace) * 1000, 175 + i))] as never,
    })
  const verdict = (activity: Activity, planned: typeof thresholdPlan | Record<string, unknown> | null) =>
    runVerdictInsightPrompt({ activity, history: runHistory(activity, []), planned: planned as never }, [])

  it('judges each rep against the plan target', () => {
    const prompt = verdict(thresholdRun([265, 265, 264]), thresholdPlan)

    expect(prompt).toContain('- Session: a threshold session')
    expect(prompt).toContain('- Reps: 3 of 3 planned, at 4:25, 4:25, 4:24 /km against a 4:22-4:28 /km target: all 3 inside it')
    expect(prompt).toContain('Tone: positive.')
  })

  it('reads reps run faster than the target as off it, whatever the RPE says', () => {
    const prompt = verdict(thresholdRun([255, 254, 256]), thresholdPlan)

    expect(prompt).toContain('against a 4:22-4:28 /km target: 3 faster')
    expect(prompt).toContain('Tone: neutral.')
  })

  it('says so when the reps were never run', () => {
    const easy = run({ id: 'e', date: '2026-09-23', rpe: 2, splits: [split('interval_active', 3000, 8600, 150, [lap(350, 148), lap(349, 149), lap(351, 150), lap(348, 151)])] as never })
    const prompt = verdict(easy, thresholdPlan)

    expect(prompt).toContain('- Reps: none recorded against 3 planned')
    expect(prompt).toContain('Tone: neutral.')
  })

  // 26 Sep: an easy block and 6 x 20 s strides, which read as "7 reps".
  it('judges a strides day as an easy run and counts the strides', () => {
    const strides = run({
      id: 's',
      date: '2026-09-26',
      rpe: 2,
      splits: [
        split('interval_active', 2963, 8500, 151, [lap(348, 148), lap(347, 150), lap(349, 151), lap(350, 153)]),
        split('interval_active', 20, 96, 160),
        split('interval_active', 20, 98, 165),
      ] as never,
    })
    const plan = {
      date: '2026-09-26',
      name: 'Strides 6 x 20s',
      type: 'Base',
      steps: [{ kind: 'effort', minutes: 50 }, effortRep(1, 0, [215, 230], 20), effortRep(2, 0, [215, 230], 20)],
    }
    const prompt = verdict(strides, plan)

    expect(prompt).toContain('- Session: an easy run with strides')
    expect(prompt).toContain('- Strides: 2 of 2 planned, between 3:24 and 3:28 /km against a 3:35-3:50 /km target')
    expect(prompt).not.toContain('- Reps:')
    expect(prompt).toContain('- How it held:')
  })

  it("takes a plan's 70-minute \"Long run\" as the long run it is", () => {
    const long = run({ id: 'l', date: '2026-09-27', durationSeconds: 73 * 60 })
    expect(verdict(long, { date: '2026-09-27', name: 'Long run', type: 'Base', durationSecs: 4082 })).toContain('- Session: a long run')
    expect(verdict(long, null)).toContain('- Session: an easy run')
  })

  it('keeps the numbers the card prints out of the copy, RPE and conditions included', () => {
    expect(RUN_VERDICT_SYSTEM_INSTRUCTION).toContain('perceived effort (RPE) and the conditions: never state those numbers')
    expect(RUN_VERDICT_SYSTEM_INSTRUCTION).not.toContain('at RPE 2')
    expect(RUN_VERDICT_SYSTEM_INSTRUCTION).not.toContain('drives the color')
  })

  it('gives the air temperature and wind the card prints, and the rest of the weather as a cause', () => {
    const prompt = verdict(run({ id: 'w', date: '2026-09-27', weather }), null)

    expect(prompt).toContain('- Conditions, printed on the card: 16°C, wind 10 km/h. Not printed: feels like 14°C, humidity 55%')
  })

  it("lets a verdict share another run's angle, never its wording", () => {
    const prompt = runVerdictInsightPrompt({ activity: run({}), history: runHistory(run({}), []), planned: null }, ['Easy and steady / 0 min in zone 4.'])

    expect(prompt).toContain('never reuse their wording or open the same way, though the same angle is fine')
  })
})
