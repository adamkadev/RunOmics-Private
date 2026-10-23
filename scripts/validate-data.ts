// Runs before every build: a dataset that would crash a page fails the build, so the live deployment keeps serving.
import path from 'node:path'
import { checkDataDirectory, type Problem } from '@/infrastructure/contracts/dataContract'

const SHOWN_PER_SEVERITY = 25

const dir = path.resolve(process.argv[2] ?? process.env.RUNOMICS_DATA_DIR ?? path.join(process.cwd(), 'data'))
const problems = checkDataDirectory(dir)

function print(label: string, list: Problem[]) {
  if (!list.length) return
  console.log(`${label} (${list.length}):`)
  for (const p of list.slice(0, SHOWN_PER_SEVERITY)) console.log(`  ${p.file} ${p.path}: ${p.message}`)
  if (list.length > SHOWN_PER_SEVERITY) console.log(`  ... and ${list.length - SHOWN_PER_SEVERITY} more`)
}

const errors = problems.filter((p) => p.severity === 'error')
const warnings = problems.filter((p) => p.severity === 'warning')

print('[validate-data] errors - the app would crash on these', errors)
print('[validate-data] warnings', warnings)
console.log(
  errors.length
    ? `[validate-data] ${dir} breaks the data contract.`
    : `[validate-data] ${dir} honours the data contract${warnings.length ? ' (with warnings)' : ''}.`
)

process.exit(errors.length ? 1 : 0)
