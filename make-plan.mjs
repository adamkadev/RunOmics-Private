import fs from 'fs'

const EASY = { min: 320, max: 380 }
const JOG = { min: 335, max: 384 }
const THR = { min: 258, max: 266 }          // centred on the measured 4:23/km

const easy = (date, m, title, desc, type = 'easy', strides = 0, notes) => ({
  date, type, title, description: desc, notes: [],
  blocks: [
    { kind: 'effort', target: { distanceMeters: m, paceSecPerKm: EASY, hrZone: 2 }, ...(notes ? { notes } : {}) },
    ...(strides ? [{ kind: 'repeat', repetitions: strides, steps: [
      { kind: 'strides', target: { durationSeconds: 20 }, notes: ['Fast but relaxed.', 'Tall posture, quick light steps, no straining.'] },
      { kind: 'recovery', target: { durationSeconds: 60, paceSecPerKm: JOG }, notes: ['Easy jog before the next stride.'] },
    ] }] : []),
  ],
})

const threshold = (date, reps, repM, recM, wu, cd, title, desc, notes) => ({
  date, type: 'threshold', title, description: desc, notes,
  blocks: [
    { kind: 'warmup', target: { distanceMeters: wu, paceSecPerKm: EASY, hrZone: 2 } },
    { kind: 'repeat', repetitions: reps, steps: [
      { kind: 'effort', target: { distanceMeters: repM, paceSecPerKm: THR }, notes: ['Comfortably hard and controlled.', 'Hold every repetition at the same rhythm.'] },
      { kind: 'recovery', target: { distanceMeters: recM, paceSecPerKm: JOG, hrZone: 2 }, notes: ['Easy jog until breathing settles.'] },
    ] },
    { kind: 'cooldown', target: { distanceMeters: cd, paceSecPerKm: EASY, hrZone: 2 } },
  ],
})

const LONG = ['Keep the whole run easy.', 'No faster finish.']

// tue, wed(threshold), thu, sat, sun(long) - edit the metres to reshape a week
const WEEKS = [
  { window: ['2026-09-22', '2026-09-27'], days: ['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-26', '2026-09-27'],
    focus: 'Settle back into the five-run rhythm at a volume just above the most recent sustained week. Load is optimal, so threshold work resumes at a controlled repetition length.',
    tue: 8500, thu: 7500, sat: 7000, long: 13000, strides: 4,
    thr: [3, 1600, 500, 2000, 1500, 'Threshold 3 x 1600 m', 'Three controlled threshold repetitions with easy jog recovery.', ['Finish feeling another repetition would have been possible.']] },
  { window: ['2026-09-28', '2026-10-04'], days: ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-03', '2026-10-04'],
    focus: 'Build aerobic volume on the opening week and add a fourth threshold repetition. The extra volume comes from easy running and the long run, not from faster work.',
    tue: 8500, thu: 7300, sat: 7000, long: 15000, strides: 4,
    thr: [4, 1600, 500, 2000, 1600, 'Threshold 4 x 1600 m', 'A fourth repetition at the same controlled threshold rhythm.', ['Add the repetition, not the pace.']] },
  { window: ['2026-10-05', '2026-10-11'], days: ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-10', '2026-10-11'],
    focus: 'Cutback week to absorb the first two weeks. Frequency and structure stay, aerobic volume and threshold repetitions both come down, and the long run shortens.',
    tue: 7000, thu: 6500, sat: 6000, long: 12000, strides: 4,
    thr: [3, 1600, 500, 2000, 1500, 'Threshold 3 x 1600 m', 'Threshold held at the same rhythm with the repetition count reduced for the cutback week.', ['Cut the number of repetitions, never the quality of them.']] },
  { window: ['2026-10-12', '2026-10-18'], days: ['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-17', '2026-10-18'],
    focus: 'Resume the build above the pre-cutback level and lengthen the threshold repetitions for the first time. Long-run durability is the other emphasis.',
    tue: 9000, thu: 7800, sat: 7400, long: 15500, strides: 5,
    thr: [3, 2000, 600, 2200, 1800, 'Threshold 3 x 2000 m', 'Longer threshold repetitions at the same rhythm, the first extension of repetition length in the block.', ['The repetition is longer, so start it a shade conservatively.']] },
]

const plan = {
  name: '10K aerobic build',
  focus: 'Rebuild weekly aerobic volume toward demonstrated capacity, extend threshold work by repetitions and then by length, and grow long-run durability for the 10K target.',
  weeks: [
    ...WEEKS.map((w) => {
      const [tue, wed, thu, sat, sun] = w.days
      return {
        startDate: w.window[0], endDate: w.window[1], focus: w.focus,
        workouts: [
          easy(tue, w.tue, 'Easy aerobic run with strides', 'Easy aerobic running finished with relaxed strides for leg turnover.', 'easy', w.strides),
          threshold(wed, ...w.thr),
          easy(thu, w.thu, 'Easy recovery run', 'Easy running to absorb the threshold session while keeping frequency.', 'easy', 0, ['Clearly easier than yesterday.']),
          easy(sat, w.sat, 'Easy aerobic run', 'Comfortable aerobic mileage with no added intensity.'),
          easy(sun, w.long, 'Easy long run', 'Long aerobic run held entirely at easy effort to build durability.', 'long_run', 0, LONG),
        ],
      }
    }),
    { startDate: '2026-10-19', endDate: '2026-10-19', workouts: [],
      focus: 'No workouts: Monday is not an available training day, so this single-day planning week stays empty.' },
  ],
}

fs.writeFileSync('answer.json', JSON.stringify(plan, null, 2))
console.log(`Wrote answer.json - ${plan.weeks.length} weeks`)
