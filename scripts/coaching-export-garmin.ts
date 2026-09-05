#!/usr/bin/env node
/**
 * Exports the active coaching plan's future prescriptions as one plain-text
 * file that ImportMyWorkout can split into separate dated Garmin workouts.
 *
 * Read-only: the coaching plan lives in the private data workspace and is never
 * modified, and nothing is fetched or pushed.
 */
import fs from 'fs'
import path from 'path'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function usage(): string {
  return [
    'RunOmics coaching export for ImportMyWorkout',
    '',
    '  npm run coach:export-garmin',
    '  npm run coach:export-garmin -- --from 2026-09-08',
    '  npm run coach:export-garmin -- --to 2026-10-03',
    '  npm run coach:export-garmin -- --out <path>',
    '  npm run coach:export-garmin -- --stdout',
    '',
    'Options:',
    '  --from <YYYY-MM-DD>  Inclusive lower bound (default: today; never earlier).',
    '  --to <YYYY-MM-DD>    Inclusive upper bound (default: the end of the plan).',
    '  --out <path>         Output file, or a directory to name the file inside.',
    '  --stdout             Write the export to stdout instead of a file.',
    '  --reference-date <YYYY-MM-DD> Treat this date as today.',
    '  --data-dir <path>    Read an existing data workspace (default: RUNOMICS_DATA_DIR).',
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

/** Read-only resolution: an explicit workspace, the configured one, or the local default. */
function dataRoot(args: string[]): string {
  const explicit = option(args, '--data-dir') ?? process.env.RUNOMICS_DATA_DIR?.trim()
  return explicit ? path.resolve(explicit) : path.join(process.cwd(), 'data')
}

/** `--out` names a file when it carries an extension, and a directory otherwise. */
function outputPath(args: string[], fileName: string): string {
  const requested = option(args, '--out')
  if (!requested) return path.resolve('.coach-exports', fileName)
  const resolved = path.resolve(requested)
  return path.extname(resolved) ? resolved : path.join(resolved, fileName)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage())
    return
  }

  const root = dataRoot(args)
  process.env.RUNOMICS_DATA_DIR = root
  const { JsonCoachingRepository } = await import('@/infrastructure/repositories/JsonCoachingRepository')
  const { buildGarminExport } = await import('@/application/coaching/garminExport')

  const repository = new JsonCoachingRepository(root)
  const plan = repository.getCurrentPlan()
  if (!plan) throw new Error(`No coaching plan found in ${path.join(root, 'coaching')}`)

  const today = isoDate(args, '--reference-date') ?? new Date().toISOString().slice(0, 10)
  const to = isoDate(args, '--to')
  const from = isoDate(args, '--from')
  if (to && from && to < from) throw new Error('--to must not precede --from')

  const exported = buildGarminExport(plan, repository.getEvaluations(), { today, from, to })
  if (!exported) throw new Error('No future prescribed workouts to export in the requested range')

  if (args.includes('--stdout')) {
    process.stdout.write(exported.text)
    return
  }

  const destination = outputPath(args, exported.fileName)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, exported.text, 'utf-8')
  console.log(
    `Exported ${exported.workouts.length} workout(s) from ${exported.startDate} to ${exported.endDate} ` +
      `(plan ${plan.id} revision ${plan.revision}, status ${plan.status}).`,
  )
  console.log(`Written to ${destination}`)
}

main().catch((error) => {
  console.error(`Coaching export failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
