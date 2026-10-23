import { describe, expect, it } from 'vitest'
import {
  deservesVerdict,
  isFreshRun,
  repeatsEarlierVerdict,
  runVerdictNoteKey,
  RUN_VERDICT_SYSTEM_INSTRUCTION,
  runVerdictInsightHash as hashContext,
  runVerdictInsightPrompt,
  runVerdictKind,
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

  // 3 x 7:00 at 4:25, 4:25, 4:24 against 4:22-4:28.
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

  it('measures an easy run by its time in zones 1-2, with zone 3 counting against it', () => {
    const zone = (n: number, minutes: number) => ({ zone: n, seconds: minutes * 60, percent: 0, minBpm: 0 })
    const easy = run({ id: 'z', date: '2026-09-27', durationSeconds: 73 * 60, hrZones: [zone(1, 21), zone(2, 49), zone(3, 3), zone(4, 0), zone(5, 0)] as never })

    expect(verdict(easy, null)).toContain('- Zones: 96% in zones 1-2, as an easy run should be - the default, not news')
    const grey = run({ id: 'g', date: '2026-09-27', hrZones: [zone(1, 20), zone(2, 25), zone(3, 25), zone(4, 2)] as never })
    expect(verdict(grey, null)).toContain('- Zones: 63% in zones 1-2, 25 min in zone 3, 2 min in zones 4-5 - more than an easy day should hold')
    expect(RUN_VERDICT_SYSTEM_INSTRUCTION).toContain('nearly all of it in zones 1-2. That is the default, not news')
    // With its reps known, a structured session is read from them, not its zones.
    const withReps = verdict({ ...thresholdRun([265, 265, 264]), hrZones: [zone(2, 29), zone(3, 6), zone(4, 16)] as never }, thresholdPlan)
    expect(withReps).not.toContain('zones 4-5')
    expect(withReps).toContain('- Reps: 3 of 3 planned')
    const unplanned = run({ id: 'u', date: '2026-09-23', type: 'Threshold', hrZones: [zone(2, 29), zone(3, 6), zone(4, 16)] as never })
    expect(verdict(unplanned, null)).toContain('- Time in zones 4-5: 16 min')
  })

  it('gives a tempo session its zone 3 time as well', () => {
    const zone = (n: number, minutes: number) => ({ zone: n, seconds: minutes * 60, percent: 0, minBpm: 0 })
    const tempo = run({ id: 'tp', date: '2026-07-07', type: 'Tempo', hrZones: [zone(2, 28), zone(3, 12), zone(4, 12), zone(5, 3)] as never })

    expect(verdict(tempo, null)).toContain('- Time in zone 3: 12 min; zones 4-5: 15 min')
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

  it("keeps a verdict off another run's wording, opening, shape and lead fact", () => {
    const prompt = runVerdictInsightPrompt({ activity: run({}), history: runHistory(run({}), []), planned: null }, ['Easy and steady / 0 min in zone 4.'])

    expect(prompt).toContain('Never reuse their wording, their opening words or their sentence shape, and lead on another fact')
    expect(prompt).not.toContain('the same angle is fine')
  })
})

describe('judged by the plan and the athlete, not the watch (v4.16.5)', () => {
  const zone = (n: number, minutes: number) => ({ zone: n, seconds: minutes * 60, percent: 0, minBpm: 0 })
  const lap = (durationSec: number, avgHr: number) => ({ durationSec, distanceM: 1000, avgSpeedMs: 1000 / durationSec, avgHr })
  const steady = [{ type: 'interval_active', durationSec: 2040, distanceM: 6010, avgSpeedMs: 0, avgHr: 155, laps: [lap(346, 150), lap(344, 152), lap(340, 158), lap(339, 160)] }]
  const context = (activity: Activity, planned: unknown = null, note?: { note: string; tags: string[] } | null) => ({
    activity,
    history: runHistory(activity, []),
    planned: planned as never,
    ...(note === undefined ? {} : { note }),
  })

  it("never judges an easy run by Garmin's label for it", () => {
    const easy = run({ id: 'e', date: '2026-09-09', type: 'Tempo', rpe: 2, hrZones: [zone(1, 11), zone(2, 23)] as never, splits: steady as never })
    const prompt = runVerdictInsightPrompt(context(easy, { date: '2026-09-09', name: 'Easy Aerobic Run', type: 'Base' }), [])

    expect(prompt).toContain('- Session: an easy run')
    expect(prompt).not.toContain('Tempo')
    expect(prompt).toContain('- Perceived effort (RPE 1-10, printed on the card): 2, against 1 to 3 expected for this session at this length')
    expect(prompt).toContain('Tone: positive.')
  })

  it('leaves the kilometre spread out of an easy run, where it is terrain', () => {
    const prompt = runVerdictInsightPrompt(context(run({ id: 's', date: '2026-09-22', splits: steady as never })), [])

    expect(prompt).toContain('- How it held:')
    expect(prompt).not.toContain('between the fastest and slowest kilometre')
  })

  it('reads reps on target at a lower effort than expected as good news', () => {
    const rep = { type: 'interval_active', durationSec: 420, distanceM: 1585, avgSpeedMs: 0, avgHr: 176, laps: [] }
    const threshold = run({ id: 't', date: '2026-09-17', type: 'Threshold', rpe: 4, splits: [rep, rep, rep] as never })
    const plan = {
      date: '2026-09-17',
      name: 'Threshold 3 x 7:00',
      type: 'Threshold',
      steps: [1, 2, 3].map((r) => ({ kind: 'effort', minutes: 7, rep: r, paceSecPerKm: [262, 268] })),
    }

    expect(runVerdictInsightPrompt(context(threshold, plan), [])).toContain('Tone: positive.')
    expect(RUN_VERDICT_SYSTEM_INSTRUCTION).toContain('Reps on target at a lower effort than expected are good news, never a shortfall.')
  })

  it('says what the run came after', () => {
    const before = run({ id: 'p', date: '2026-09-23', type: 'Threshold', description: 'Threshold 3 x 7:00' } as Partial<Activity>)
    const today = run({ id: 'c', date: '2026-09-24' })
    const prompt = runVerdictInsightPrompt({ activity: today, history: runHistory(today, [today, before]), planned: null }, [])

    expect(prompt).toContain('the previous one, 1 day before, was "Threshold 3 x 7:00"')
  })

  it("hands the model the athlete's note, to judge the run in its light", () => {
    const prompt = runVerdictInsightPrompt(context(run({ id: 'n', date: '2026-09-23' }), null, { note: 'sick', tags: [] }), [])

    expect(prompt).toContain('- The athlete\'s own note on this run, printed on the card: "sick"')
    expect(RUN_VERDICT_SYSTEM_INSTRUCTION).toContain('A session run sick, tired or sore is never written up as if nothing happened.')
  })

  it('keys the note apart from the facts, so the activity page never needs it', () => {
    const plain = run({ id: 'k', date: '2026-09-23' })
    expect(hashContext(context(plain, null, { note: 'sick', tags: [] }))).toBe(hashContext(context(plain)))
    expect(runVerdictNoteKey(null)).toBe('')
    expect(runVerdictNoteKey({ note: '  ', tags: [] })).toBe('')
    expect(runVerdictNoteKey({ note: 'sick', tags: ['b', 'a'] })).toBe(runVerdictNoteKey({ note: 'sick ', tags: ['a', 'b'] }))
    expect(runVerdictNoteKey({ note: 'sick', tags: [] })).not.toBe(runVerdictNoteKey({ note: 'fine', tags: [] }))
  })

  it('says which way the reps went in words, and never judges them by the session RPE', () => {
    const rep = (metres: number, hr: number) => ({ type: 'interval_active', durationSec: 60, distanceM: metres, avgSpeedMs: 0, avgHr: hr, laps: [] })
    const anaerobic = run({
      id: 'a',
      date: '2026-08-07',
      type: 'Anaerobic',
      rpe: 6,
      splits: [rep(281, 174), rep(307, 174), rep(298, 172), rep(298, 167)] as never,
    })
    const prompt = runVerdictInsightPrompt(context(anaerobic), [])

    expect(prompt).toContain('the last rep 12s/km quicker than the first, heart rate 7 bpm lower by the last rep')
    expect(prompt).not.toMatch(/-\d+s\/km/)
    expect(prompt).toContain('- Perceived effort for the whole session, warm-up and cool-down included (RPE 1-10, printed on the card): 6')
    expect(prompt).not.toContain('expected for this session')
    expect(prompt).toContain('- Reps: 4, at 3:34, 3:15, 3:21, 3:21 /km')
    expect(prompt).toContain('Tone: positive.')
  })

  it('never calls the run before it by a bare Garmin Coach type word', () => {
    const before = run({ id: 'p', date: '2026-08-05', description: 'Base' } as Partial<Activity>)
    const today = run({ id: 'c', date: '2026-08-07' })
    const prompt = runVerdictInsightPrompt({ activity: today, history: runHistory(today, [today, before]), planned: null }, [])

    expect(prompt).toContain('the previous one, 2 days before, was an easy run')
  })

  it('rejects a headline opening on the same two words as one the model was shown', () => {
    const shown = [{ headline: 'Full zone discipline protects the easy effort' }]
    expect(repeatsEarlierVerdict({ headline: 'Full zone control kept cardiac cost low' }, [], shown)).toBe(true)
    expect(repeatsEarlierVerdict({ headline: 'Full zone control kept cardiac cost low' }, shown)).toBe(false)
    expect(repeatsEarlierVerdict({ headline: 'Lower heart rate at the same pace' }, shown, shown)).toBe(false)
  })
})

describe('what sets this run apart (v4.16.6)', () => {
  const rep = (seconds: number, pace: number, hr: number) => ({ type: 'interval_active', durationSec: seconds, distanceM: (seconds / pace) * 1000, avgSpeedMs: 0, avgHr: hr, laps: [] })
  const threshold = (id: string, date: string, seconds: number, pace: number, hr: number) =>
    run({ id, date, type: 'Threshold', splits: [rep(seconds, pace, hr), rep(seconds, pace, hr), rep(seconds, pace, hr)] as never })
  const intent = {
    title: 'Threshold 3 x 7:15',
    description: 'Same pace as last week, longer repetitions.',
    weekFocus: 'First full week of five runs.',
  }

  it("hands the model the coach's words for the session, and writes the verdict again when they change", () => {
    const today = threshold('t', '2026-09-29', 435, 265, 172)
    const context = { activity: today, history: runHistory(today, []), planned: null, intent }
    const prompt = runVerdictInsightPrompt(context, [])

    expect(prompt).toContain('- What the coach wrote for this session: "Same pace as last week, longer repetitions."')
    expect(prompt).toContain('- What the plan\'s week is for: "First full week of five runs."')
    expect(hashContext(context)).not.toBe(hashContext({ ...context, intent: null }))
    expect(hashContext(context)).not.toBe(hashContext({ ...context, intent: { ...intent, description: 'Changed.' } }))
    expect(runVerdictInsightPrompt({ ...context, intent: null }, [])).not.toContain('What the coach wrote')
  })

  it('holds a session against the last one of its kind, in words', () => {
    const last = threshold('l', '2026-09-23', 420, 265, 174)
    const today = threshold('t', '2026-09-29', 435, 264, 172)
    const prompt = runVerdictInsightPrompt({ activity: today, history: runHistory(today, [today, last]), planned: null }, [])

    expect(prompt).toContain('- Against your last threshold session, 6 days before (3 reps of 7:00 at 4:25 /km, 174 bpm): as many reps, reps 15 s longer, the same rep pace, the same heart rate')
  })

  it('holds a long run against the longest of the last three months', () => {
    const long = (id: string, date: string, km: number) => run({ id, date, distanceKm: km, durationSeconds: 100 * 60 })
    const longest = long('a', '2026-09-13', 16)
    const lines = (today: Activity, before: Activity[]) =>
      runVerdictInsightPrompt({ activity: today, history: runHistory(today, [today, ...before]), planned: null }, [])

    expect(lines(long('t', '2026-09-27', 13), [longest])).toContain('- 3 km short of your longest run of the last 3 months, 14 days before')
    expect(lines(long('t', '2026-09-27', 16.3), [longest])).toContain('- As long as your longest run of the last 3 months, 14 days before')
    expect(lines(long('t', '2026-09-27', 18), [longest, long('o', '2026-05-24', 21)])).toContain('- Your longest run in 4 months')
    expect(lines(long('t', '2026-09-27', 18), [longest])).toContain('- Longer than any earlier run on record')
    expect(lines(run({ id: 'e', date: '2026-09-27' }), [longest])).not.toContain('longest run')
  })

  it('names the kind a verdict is written for, which the pass groups earlier verdicts by', () => {
    expect(runVerdictKind({ activity: threshold('t', '2026-09-29', 435, 265, 172), planned: null })).toBe('threshold')
    expect(runVerdictKind({ activity: run({ id: 'e', date: '2026-09-27' }), planned: null })).toBe('easy')
  })

  it('asks for a coach talking about this run, not the formula every good session of its kind fits', () => {
    const easy = run({ rpe: 2 })
    const prompt = runVerdictInsightPrompt({ activity: easy, history: runHistory(easy, []), planned: null }, [])

    expect(prompt).toContain('Tone: positive. The run did what this session was for. Say it on what matters most about this run today, never on what is true of every good session of its kind.')
    expect(prompt).not.toContain('strongest fact')
    expect(RUN_VERDICT_SYSTEM_INSTRUCTION).toContain('never a label of adjectives and nouns')
    expect(RUN_VERDICT_SYSTEM_INSTRUCTION).toContain('never a list of numbers')
    expect(RUN_VERDICT_SYSTEM_INSTRUCTION).not.toContain('3 reps within 1 s/km of each other')
  })
})
