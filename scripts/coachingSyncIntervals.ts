import type { CoachingPlan, WorkoutEvaluation } from '@/domain/coaching/types'
import type { GarminSyncWindow } from '@/application/coaching/garminSync'
import { interopImport } from './interopImport'

export interface IntervalsSyncRun {
  root: string
  plan: CoachingPlan
  evaluations: WorkoutEvaluation[]
  window: GarminSyncWindow
  apply: boolean
  expect: string | undefined
  syncRaces: boolean
  retireConnect: boolean
}

/** Adds each file it is about to change to `changed`, which the caller pushes back even when the run throws. */
export async function syncIntervals(run: IntervalsSyncRun, changed: string[]): Promise<void> {
  const { JsonIntervalsSyncStore } = await interopImport(import('@/infrastructure/repositories/JsonIntervalsSyncStore'))
  const { JsonGarminSyncStore } = await interopImport(import('@/infrastructure/repositories/JsonGarminSyncStore'))
  const { buildIntervalsSyncPlan, formatIntervalsSyncPreview, intervalsMutationCount } =
    await interopImport(import('@/application/coaching/intervalsSync'))
  const { connectRetirementPlan, intervalsAthleteId, pendingConnectEntries } =
    await interopImport(import('@/application/coaching/syncRoute'))

  const athleteId = intervalsAthleteId(process.env)
  const store = new JsonIntervalsSyncStore(run.root)
  const connectStore = new JsonGarminSyncStore(run.root)
  const state = store.read()
  const syncPlan = buildIntervalsSyncPlan(run.plan, run.evaluations, state, run.window, { syncRaces: run.syncRaces })
  const connectLeft = pendingConnectEntries(connectStore.read(), run.window.today)
  const handOver = connectLeft.length
    ? `RunOmics still has ${connectLeft.length} Garmin Connect workout(s) from ${run.window.today} on (${connectStore.location}). ` +
      '--apply needs --retire-connect to delete them first, or the watch gets those sessions twice.'
    : null

  if (!run.apply) {
    console.log(formatIntervalsSyncPreview(syncPlan))
    console.log('')
    console.log(`Plan ${run.plan.id} revision ${run.plan.revision} (${run.plan.status}); intervals.icu athlete ${athleteId}; state at ${store.location}`)
    console.log(`Fingerprint: ${syncPlan.fingerprint}`)
    if (handOver) console.log(`\n${handOver}`)
    console.log('')
    console.log(intervalsMutationCount(syncPlan)
      ? 'Preview only. Re-run with --apply to perform these intervals.icu mutations.'
      : 'intervals.icu is already in sync. No changes to apply.')
    return
  }

  if (run.expect && run.expect !== syncPlan.fingerprint) {
    throw new Error(
      `The sync plan changed since that preview (expected ${run.expect}, computed ${syncPlan.fingerprint}). ` +
        'Re-run the preview and review it before applying.',
    )
  }
  if (handOver && !run.retireConnect) throw new Error(`${handOver} Nothing was sent.`)

  if (connectLeft.length) {
    if (!process.env.GARMIN_SECRET?.trim()) throw new Error('--retire-connect needs GARMIN_SECRET to delete the Connect workouts; nothing was sent')
    const { applyGarminSyncPlan, formatGarminSyncResults } = await interopImport(import('@/application/coaching/garminSyncApply'))
    const { PythonGarminGateway } = await interopImport(import('@/infrastructure/garmin/PythonGarminGateway'))
    const gateway = new PythonGarminGateway()
    try {
      changed.push(connectStore.location)
      const retired = await applyGarminSyncPlan(connectRetirementPlan(connectStore.read(), run.window.today), connectStore.read(), gateway, {
        now: () => new Date().toISOString(),
        pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        persist: (next) => connectStore.write(next),
      })
      connectStore.write(retired.state)
      console.log(formatGarminSyncResults(retired))
      if (retired.results.some((result) => result.outcome === 'failed')) {
        process.exitCode = 1
        console.error('Some Connect workouts could not be deleted; nothing was sent to intervals.icu. Re-run to finish.')
        return
      }
    } finally {
      gateway.close()
    }
  }

  const { applyIntervalsSyncPlan, formatIntervalsSyncResults, verifyIntervalsSync } =
    await interopImport(import('@/application/coaching/intervalsSync'))
  const { HttpIntervalsGateway } = await interopImport(import('@/infrastructure/intervals/HttpIntervalsGateway'))
  const gateway = new HttpIntervalsGateway({ apiKey: process.env.INTERVALS_API_KEY ?? '', athleteId })
  changed.push(store.location)
  const applied = await applyIntervalsSyncPlan(syncPlan, store.read(), gateway, {
    athleteId,
    now: () => new Date().toISOString(),
    persist: (next) => store.write(next),
  })
  const verified = await verifyIntervalsSync(applied, gateway)
  store.write(verified.state)
  console.log(formatIntervalsSyncResults(verified))
  console.log('intervals.icu sends the workouts on to Garmin Connect through its own Garmin connection.')
  if (verified.results.some((result) => result.outcome === 'failed')) process.exitCode = 1
}

/** Deletes RunOmics's intervals.icu events from today on, before the Connect route takes over again. */
export async function retireIntervals(root: string, today: string): Promise<boolean> {
  const { JsonIntervalsSyncStore } = await interopImport(import('@/infrastructure/repositories/JsonIntervalsSyncStore'))
  const { applyIntervalsSyncPlan, formatIntervalsSyncResults, intervalsRetirementPlan } =
    await interopImport(import('@/application/coaching/intervalsSync'))
  const { intervalsAthleteId } = await interopImport(import('@/application/coaching/syncRoute'))
  const { HttpIntervalsGateway } = await interopImport(import('@/infrastructure/intervals/HttpIntervalsGateway'))

  if (!process.env.INTERVALS_API_KEY?.trim()) throw new Error('--retire-intervals needs INTERVALS_API_KEY; nothing was sent')
  const athleteId = intervalsAthleteId(process.env)
  const store = new JsonIntervalsSyncStore(root)
  const report = await applyIntervalsSyncPlan(intervalsRetirementPlan(store.read(), today), store.read(),
    new HttpIntervalsGateway({ apiKey: process.env.INTERVALS_API_KEY, athleteId }), {
      athleteId,
      now: () => new Date().toISOString(),
      persist: (next) => store.write(next),
    })
  store.write(report.state)
  console.log(formatIntervalsSyncResults(report))
  return !report.results.some((result) => result.outcome === 'failed')
}
