#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { appTodayIso } from '@/lib/calendarDate'
import { dataWorkspace, pushWorkspace, removeWorkspace, type DataWorkspace } from './coachingWorkspace'
import { interopImport } from './interopImport'
import { retireIntervals, syncIntervals } from './coachingSyncIntervals'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function usage(): string {
  return [
    'RunOmics coaching sync to the watch, through intervals.icu or Garmin Connect',
    '',
    '  npm run coach:sync-garmin                       Preview only (default).',
    '  npm run coach:sync-garmin -- --apply            Apply the previewed mutations.',
    '  npm run coach:sync-garmin -- --apply --expect <fingerprint>',
    '',
    'Options:',
    '  --apply              Perform the Garmin mutations. Without it nothing is written.',
    '  --expect <hash>      Refuse to apply unless the sync plan still matches this',
    '                       fingerprint (printed by the preview).',
    '  --from <YYYY-MM-DD>  Inclusive lower bound (default: today; never earlier).',
    '  --to <YYYY-MM-DD>    Inclusive upper bound (default: the end of the plan).',
    '  --reference-date <YYYY-MM-DD>  Treat this date as today.',
    '  --sync-races         Also push races as structured workouts. Off by default:',
    '                       a race is already on the Garmin calendar as an event. A',
    '                       course-aware race still goes out with its race effort',
    '                       unpaced, so PacePro keeps the pacing.',
    '  --print-payload <YYYY-MM-DD>   Print the payload for that date and exit.',
    '  --route connect|intervals      Override the route. Default: intervals when',
    '                       INTERVALS_API_KEY is set, Garmin Connect otherwise.',
    '  --retire-connect     On the intervals route, delete RunOmics\'s own Connect',
    '                       workouts from today on first, so none reaches the watch twice.',
    '  --retire-intervals   On the Connect route, delete RunOmics\'s own intervals.icu',
    '                       events from today on first.',
    '  --data-dir <path>    Read/write an existing workspace without fetching or pushing',
    '                       it (default: RUNOMICS_DATA_DIR). Without one, the private data',
    '                       repository is fetched, and --apply pushes the mapping back.',
    '',
    'The Connect route requires GARMIN_SECRET for --apply, read only by the Python',
    'bridge. The intervals.icu route requires INTERVALS_API_KEY (and optionally',
    'INTERVALS_ATHLETE_ID). Neither is ever printed.',
  ].join('\n')
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function isoDate(args: string[], name: string): string | undefined {
  const value = option(args, name)
  if (value === undefined) return undefined
  if (!ISO_DATE.test(value)) throw new Error(`${name} must be a YYYY-MM-DD date`)
  return value
}

/** The mapping alone records what is on Garmin, so one the push could not deliver is saved outside the workspace. */
async function pushMapping(workspace: DataWorkspace, mappingPaths: string[]): Promise<void> {
  try {
    await pushWorkspace(workspace)
    console.log('Sync state pushed to the private data repository.')
  } catch (error) {
    process.exitCode = 1
    console.error(`Could not push the sync state: ${error instanceof Error ? error.message : String(error)}`)
    for (const mappingPath of mappingPaths.filter((candidate) => fs.existsSync(candidate))) {
      const name = path.basename(mappingPath, '.json')
      const saved = path.resolve('.coach-previews', `${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
      fs.mkdirSync(path.dirname(saved), { recursive: true })
      fs.copyFileSync(mappingPath, saved)
      fs.chmodSync(saved, 0o600)
      console.error(`Saved it to ${saved}: commit it as data/coaching/${name}.json before the next sync.`)
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage())
    return
  }

  const workspace = await dataWorkspace(option(args, '--data-dir'), args.includes('--apply'))
  try {
    await sync(args, workspace)
  } finally {
    removeWorkspace(workspace)
  }
}

async function sync(args: string[], workspace: DataWorkspace): Promise<void> {
  const root = workspace.root
  process.env.RUNOMICS_DATA_DIR = root

  const { JsonCoachingRepository } = await interopImport(import('@/infrastructure/repositories/JsonCoachingRepository'))
  const { JsonGarminSyncStore } = await interopImport(import('@/infrastructure/repositories/JsonGarminSyncStore'))
  const { buildGarminSyncPlan, countOperations, formatGarminSyncPreview, hasGarminMutations } =
    await interopImport(import('@/application/coaching/garminSync'))
  const { toGarminWorkoutPayload } = await interopImport(import('@/application/coaching/garminWorkoutMapping'))

  const repository = new JsonCoachingRepository(root)
  const plan = repository.getCurrentPlan()
  if (!plan) throw new Error(`No coaching plan found in ${path.join(root, 'coaching')}`)

  const today = isoDate(args, '--reference-date') ?? appTodayIso()
  const from = isoDate(args, '--from')
  const to = isoDate(args, '--to')
  if (to && from && to < from) throw new Error('--to must not precede --from')

  const { resolveWorkoutSyncRoute } = await interopImport(import('@/application/coaching/syncRoute'))
  const route = resolveWorkoutSyncRoute(option(args, '--route'), process.env)
  const applying = args.includes('--apply')

  const printPayload = isoDate(args, '--print-payload')
  if (printPayload) {
    const workout = plan.weeks.flatMap((week) => week.workouts).find((candidate) => candidate.date === printPayload)
    if (!workout) throw new Error(`No prescription on ${printPayload}`)
    if (route === 'intervals') {
      const { toIntervalsWorkoutEvent } = await interopImport(import('@/application/coaching/intervalsWorkoutEncoding'))
      const event = toIntervalsWorkoutEvent(workout)
      console.log(JSON.stringify(event, null, 2))
      console.log(`\n${event.description}`)
    } else {
      console.log(JSON.stringify(toGarminWorkoutPayload(workout), null, 2))
    }
    return
  }

  if (route === 'intervals') {
    const changed: string[] = []
    try {
      await syncIntervals({
        root,
        plan,
        evaluations: repository.getEvaluations(),
        window: { today, from, to },
        apply: applying,
        expect: option(args, '--expect'),
        syncRaces: args.includes('--sync-races'),
        retireConnect: args.includes('--retire-connect'),
      }, changed)
    } finally {
      if (changed.length && workspace.shouldPush) await pushMapping(workspace, changed)
      else if (changed.length) console.log(`Commit ${changed.join(' and ')} to the data repository: it is the only record of these workouts.`)
    }
    return
  }

  const { JsonIntervalsSyncStore } = await interopImport(import('@/infrastructure/repositories/JsonIntervalsSyncStore'))
  const { pendingIntervalsEntries } = await interopImport(import('@/application/coaching/intervalsSync'))
  const intervalsStore = new JsonIntervalsSyncStore(root)
  const intervalsLeft = pendingIntervalsEntries(intervalsStore.read(), today)
  const handBack = intervalsLeft.length
    ? `RunOmics still has ${intervalsLeft.length} intervals.icu workout(s) from ${today} on (${intervalsStore.location}). ` +
      '--apply needs --retire-intervals to delete them first, or the watch gets those sessions twice.'
    : null

  const store = new JsonGarminSyncStore(root)
  const syncPlan = buildGarminSyncPlan(plan, repository.getEvaluations(), store.read(), { today, from, to }, {
    syncRaces: args.includes('--sync-races'),
  })

  if (!args.includes('--apply')) {
    const mutating = hasGarminMutations(countOperations(syncPlan.operations))
    console.log(formatGarminSyncPreview(syncPlan))
    console.log('')
    console.log(`Plan ${plan.id} revision ${plan.revision} (${plan.status}); mapping at ${store.location}`)
    console.log(`Fingerprint: ${syncPlan.fingerprint}`)
    if (handBack) console.log(`\n${handBack}`)
    console.log('')
    console.log(
      mutating
        ? 'Preview only. Re-run with --apply to perform these Garmin mutations.'
        : 'Garmin is already in sync. No changes to apply.',
    )
    return
  }

  const expected = option(args, '--expect')
  if (expected && expected !== syncPlan.fingerprint) {
    throw new Error(
      `The sync plan changed since that preview (expected ${expected}, computed ${syncPlan.fingerprint}). ` +
        'Re-run the preview and review it before applying.',
    )
  }

  if (!process.env.GARMIN_SECRET?.trim()) throw new Error('GARMIN_SECRET is not set; nothing was sent to Garmin')
  if (handBack && !args.includes('--retire-intervals')) throw new Error(`${handBack} Nothing was sent.`)
  if (handBack) {
    let retired = false
    try {
      retired = await retireIntervals(root, today)
    } finally {
      if (!retired) {
        process.exitCode = 1
        console.error('Some intervals.icu events could not be deleted; nothing was sent to Garmin Connect. Re-run to finish.')
        if (workspace.shouldPush) await pushMapping(workspace, [intervalsStore.location])
      }
    }
    if (!retired) return
  }

  const { applyGarminSyncPlan, formatGarminSyncResults, verifyGarminSync } =
    await interopImport(import('@/application/coaching/garminSyncApply'))
  const { PythonGarminGateway } = await interopImport(import('@/infrastructure/garmin/PythonGarminGateway'))

  const gateway = new PythonGarminGateway()
  try {
    const applied = await applyGarminSyncPlan(syncPlan, store.read(), gateway, {
      now: () => new Date().toISOString(),
      pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      persist: (state) => store.write(state),
    })

    const verified = await verifyGarminSync(applied, gateway)
    store.write(verified.state)
    console.log(formatGarminSyncResults(verified))

    if (verified.results.some((result) => result.outcome === 'failed')) process.exitCode = 1
  } finally {
    gateway.close()
    if (workspace.shouldPush) await pushMapping(workspace, handBack ? [store.location, intervalsStore.location] : [store.location])
    else console.log(`Commit ${store.location} to the data repository: it is the only record of these Garmin workouts.`)
  }
}

main().catch((error) => {
  console.error(`Workout sync failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
