import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { JsonCoachingRepository } from '@/infrastructure/repositories/JsonCoachingRepository'
import { plan, workout } from '@/domain/coaching/__tests__/fixtures'
import type { CoachingPlan, WorkoutPrescription } from '@/domain/coaching/types'

const projectRoot = process.cwd()
const cli = path.join(projectRoot, 'scripts/coaching-export-garmin.ts')
const temporaryRoots: string[] = []

function session(overrides: Partial<WorkoutPrescription>): WorkoutPrescription {
  return workout({
    type: 'easy',
    description: 'Steady aerobic run.',
    notes: undefined,
    totalDurationSeconds: undefined,
    blocks: [{ kind: 'effort', target: { distanceMeters: 7_000, paceSecPerKm: { min: 310, max: 387 } } }],
    ...overrides,
  })
}

function exportablePlan(): CoachingPlan {
  return plan({
    weeks: [
      {
        id: 'week-1',
        index: 1,
        startDate: '2026-09-07',
        endDate: '2026-09-13',
        focus: 'Aerobic base',
        workouts: [
          session({ id: 'w-past', date: '2026-09-08', title: 'Missed Run' }),
          session({ id: 'w-cancelled', date: '2026-09-11', title: 'Cancelled Run', status: 'cancelled' }),
          session({ id: 'w-first', date: '2026-09-12', title: 'Easy Aerobic Run' }),
        ],
      },
      {
        id: 'week-2',
        index: 2,
        startDate: '2026-09-14',
        endDate: '2026-09-20',
        focus: 'Threshold',
        workouts: [session({ id: 'w-second', date: '2026-09-16', title: 'Second Easy Run' })],
      },
    ],
  })
}

function workspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runomics-coach-export-'))
  temporaryRoots.push(root)
  new JsonCoachingRepository(root).saveCurrentPlan(exportablePlan())
  return root
}

function run(root: string, ...args: string[]) {
  return spawnSync(
    process.execPath,
    ['--conditions=react-server', '--import', 'tsx', cli, '--data-dir', root, '--reference-date', '2026-09-10', ...args],
    { cwd: projectRoot, encoding: 'utf-8', env: { ...process.env, RUNOMICS_DATA_DIR: '', RUNOMICS_DATA_REPO_URL: '' } },
  )
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

describe('coaching Garmin export CLI', () => {
  it('exports future prescriptions from the selected workspace and leaves the plan untouched', () => {
    const root = workspace()
    const planPath = path.join(root, 'coaching/current_plan.json')
    const before = fs.readFileSync(planPath, 'utf-8')
    const output = path.join(root, 'exports')

    const result = run(root, '--out', output)

    const written = path.join(output, 'importmyworkout-2026-09-12-to-2026-09-16.txt')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Exported 2 workout(s) from 2026-09-12 to 2026-09-16')
    expect(fs.readFileSync(written, 'utf-8')).toBe(
      [
        '2026-09-12 — Easy Aerobic Run',
        'Sport: Running',
        '',
        '7 km easy at 5:10-6:27/km',
        '',
        'Notes:',
        '- Steady aerobic run.',
        '',
        '',
        '2026-09-16 — Second Easy Run',
        'Sport: Running',
        '',
        '7 km easy at 5:10-6:27/km',
        '',
        'Notes:',
        '- Steady aerobic run.',
        '',
      ].join('\n'),
    )
    expect(fs.readFileSync(planPath, 'utf-8')).toBe(before)
  })

  it('writes to stdout without adding anything to the workspace', () => {
    const root = workspace()
    const before = fs.readdirSync(root)

    const result = run(root, '--stdout')

    expect(result.status).toBe(0)
    expect(result.stdout.startsWith('2026-09-12 — Easy Aerobic Run\n')).toBe(true)
    expect(result.stdout).toContain('2026-09-16 — Second Easy Run')
    expect(fs.readdirSync(root)).toEqual(before)
  })

  it('treats an --out path with an extension as the file itself', () => {
    const root = workspace()
    const destination = path.join(root, 'nested/plan.txt')

    const result = run(root, '--out', destination)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(`Written to ${destination}`)
    expect(fs.readFileSync(destination, 'utf-8')).toContain('2026-09-12 — Easy Aerobic Run')
  })

  it('honours --from and --to', () => {
    const root = workspace()

    const result = run(root, '--stdout', '--from', '2026-09-13', '--to', '2026-09-16')

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('2026-09-16 — Second Easy Run')
    expect(result.stdout).not.toContain('Easy Aerobic Run')
  })

  it('reports an empty range instead of writing a file', () => {
    const root = workspace()
    const output = path.join(root, 'exports')

    const result = run(root, '--out', output, '--to', '2026-09-11')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('No future prescribed workouts to export')
    expect(fs.existsSync(output)).toBe(false)
  })

  it('fails clearly when the selected workspace has no coaching plan', () => {
    const root = workspace()
    fs.rmSync(path.join(root, 'coaching'), { recursive: true, force: true })

    const result = run(root, '--stdout')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('No coaching plan found')
  })
})
