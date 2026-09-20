#!/usr/bin/env node
import path from 'path'
import { interopImport } from './interopImport'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function usage(): string {
  return [
    'RunOmics coaching sync to Garmin Connect',
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
    '  --print-payload <YYYY-MM-DD>   Print the Garmin JSON for that date and exit.',
    '  --data-dir <path>    Data workspace to use (default: RUNOMICS_DATA_DIR).',
    '',
    'Requires GARMIN_SECRET in the environment for --apply. It is read only by the',
    'Python bridge and never printed.',
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

function dataRoot(args: string[]): string {
  const explicit = option(args, '--data-dir') ?? process.env.RUNOMICS_DATA_DIR?.trim()
  return explicit ? path.resolve(explicit) : path.join(process.cwd(), 'data')
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage())
    return
  }

  const root = dataRoot(args)
  process.env.RUNOMICS_DATA_DIR = root

  const { JsonCoachingRepository } = await interopImport(import('@/infrastructure/repositories/JsonCoachingRepository'))
  const { JsonGarminSyncStore } = await interopImport(import('@/infrastructure/repositories/JsonGarminSyncStore'))
  const { buildGarminSyncPlan, countOperations, formatGarminSyncPreview, hasGarminMutations } =
    await interopImport(import('@/application/coaching/garminSync'))
  const { toGarminWorkoutPayload } = await interopImport(import('@/application/coaching/garminWorkoutMapping'))

  const repository = new JsonCoachingRepository(root)
  const plan = repository.getCurrentPlan()
  if (!plan) throw new Error(`No coaching plan found in ${path.join(root, 'coaching')}`)

  const today = isoDate(args, '--reference-date') ?? new Date().toISOString().slice(0, 10)
  const from = isoDate(args, '--from')
  const to = isoDate(args, '--to')
  if (to && from && to < from) throw new Error('--to must not precede --from')

  const printPayload = isoDate(args, '--print-payload')
  if (printPayload) {
    const workout = plan.weeks.flatMap((week) => week.workouts).find((candidate) => candidate.date === printPayload)
    if (!workout) throw new Error(`No prescription on ${printPayload}`)
    console.log(JSON.stringify(toGarminWorkoutPayload(workout), null, 2))
    return
  }

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
  }
}

main().catch((error) => {
  console.error(`Garmin sync failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
