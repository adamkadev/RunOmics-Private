import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync, spawnSync } from 'child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { JsonCoachingRepository } from '@/infrastructure/repositories/JsonCoachingRepository'
import { plan } from '@/domain/coaching/__tests__/fixtures'

const projectRoot = process.cwd()
const cli = path.join(projectRoot, 'scripts/coaching.ts')
const temporaryRoots: string[] = []

function workspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runomics-coach-cli-'))
  temporaryRoots.push(root)
  fs.cpSync(path.join(projectRoot, 'data'), root, { recursive: true })
  const repository = new JsonCoachingRepository(root)
  if (!repository.getCurrentPlan()) repository.saveCurrentPlan(plan())
  return root
}

function nodeArgs(...args: string[]): string[] {
  return ['--conditions=react-server', '--import', 'tsx', cli, ...args]
}

function writeKeepReview(root: string, output: string): string {
  const script = `
    (async () => {
      // The same normalisation scripts/interopImport.ts does, inlined because
      // this runs through \`node -e\` with no module of its own to import from:
      // under tsx a dynamic import of a .ts file yields { default: exports }
      // rather than hoisted named exports on Node 22.
      const load = async (loading) => {
        const loaded = await loading
        const fallback = loaded.default
        return fallback && typeof fallback === 'object' ? { ...fallback, ...loaded } : loaded
      }
      const { JsonCoachingRepository } = await load(import('./src/infrastructure/repositories/JsonCoachingRepository.ts'))
      const { getCoachingContext } = await load(import('./src/application/coaching/GetCoachingContext.ts'))
      const { createWeeklyReviewProposal } = await load(import('./src/application/coaching/workflows.ts'))
      const { writeProposalPreview } = await load(import('./src/application/coaching/preview.ts'))
      const repository = new JsonCoachingRepository(process.env.RUNOMICS_DATA_DIR)
      const plan = repository.getCurrentPlan()
      const referenceDate = plan.block.startDate
      const context = await getCoachingContext(plan, referenceDate)
      let next = 0
      const advisor = {
        bootstrap: async () => { throw new Error('not called') },
        evaluateActivity: async () => { throw new Error('not called') },
        reviewWeek: async () => ({ outcome: 'KEEP', reasonCodes: ['ON_TRACK'], summary: 'Keep the reviewed plan.', evidence: [], changes: [] }),
      }
      const proposal = await createWeeklyReviewProposal(context, {
        repository, advisor, id: () => 'cli-' + (++next), now: () => new Date('2026-09-05T10:00:00.000Z'),
      })
      process.stdout.write(writeProposalPreview(proposal, process.env.COACH_PREVIEW_DIR))
    })().catch((error) => { console.error(error); process.exitCode = 1 })
  `
  return execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '-e', script], {
    cwd: projectRoot,
    encoding: 'utf-8',
    env: { ...process.env, RUNOMICS_DATA_DIR: root, COACH_PREVIEW_DIR: output },
  }).trim()
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

describe('coaching CLI', { timeout: 20_000 }, () => {
  it('leaves data and previews untouched when generation fails', () => {
    const root = workspace()
    fs.rmSync(path.join(root, 'coaching'), { recursive: true, force: true })
    const output = path.join(root, 'previews')

    const result = spawnSync(process.execPath, nodeArgs('bootstrap', '--days', 'tue,thu,sat,sun', '--runs-per-week', '4', '--advisor', 'gemini', '--data-dir', root, '--out', output), {
      cwd: projectRoot,
      encoding: 'utf-8',
      env: { ...process.env, GEMINI_API_KEY: 'general-key', GEMINI_COACH_API_KEY: '', RUNOMICS_DATA_REPO_URL: '' },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('GEMINI_COACH_API_KEY is not configured')
    expect(fs.existsSync(path.join(root, 'coaching'))).toBe(false)
    expect(fs.existsSync(output)).toBe(false)
  })

  it('writes the prompt for Claude Code by default, with no API key, and builds the review from the saved reply', () => {
    const root = workspace()
    const output = path.join(root, 'previews')
    const env = { ...process.env, GEMINI_COACH_API_KEY: '', RUNOMICS_DATA_REPO_URL: '' }
    const referenceDate = new JsonCoachingRepository(root).getCurrentPlan()!.block.startDate

    let result = spawnSync(process.execPath, nodeArgs('weekly-review', '--reference-date', referenceDate, '--data-dir', root, '--out', output), { cwd: projectRoot, encoding: 'utf-8', env })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Hand it to Claude Code')
    expect(fs.readFileSync(path.join(output, 'coach-prompt.md'), 'utf-8')).toContain('Review the rolling running plan')

    const answer = path.join(root, 'answer.json')
    fs.writeFileSync(answer, JSON.stringify({ outcome: 'KEEP', reasonCodes: ['ON_PLAN'], summary: 'The plan stands.', evidence: [], changes: [] }))
    result = spawnSync(process.execPath, nodeArgs('weekly-review', '--reference-date', referenceDate, '--data-dir', root, '--out', output, '--from-answer', answer), { cwd: projectRoot, encoding: 'utf-8', env })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('KEEP: The plan stands.')
    const preview = fs.readdirSync(output).find((file) => file.endsWith('.json'))!
    expect(JSON.parse(fs.readFileSync(path.join(output, preview), 'utf-8'))).toMatchObject({ kind: 'weekly_review', decision: { provenance: { source: 'manual' } } })
  })

  it('asks Gemini for a review only when told to', () => {
    const root = workspace()
    const output = path.join(root, 'previews')

    const result = spawnSync(process.execPath, nodeArgs('weekly-review', '--advisor', 'gemini', '--data-dir', root, '--out', output), {
      cwd: projectRoot,
      encoding: 'utf-8',
      env: { ...process.env, GEMINI_COACH_API_KEY: '', RUNOMICS_DATA_REPO_URL: '' },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('GEMINI_COACH_API_KEY is not configured')
    expect(fs.existsSync(path.join(output, 'coach-prompt.md'))).toBe(false)
  })

  it('refuses an advisor it does not know, and a prompt file alongside Gemini', () => {
    const root = workspace()
    const run = (...args: string[]) => spawnSync(process.execPath, nodeArgs('weekly-review', '--data-dir', root, ...args), {
      cwd: projectRoot,
      encoding: 'utf-8',
      env: { ...process.env, RUNOMICS_DATA_REPO_URL: '' },
    })

    expect(run('--advisor', 'openai').stderr).toContain('Unknown --advisor openai')
    expect(run('--advisor', 'gemini', '--from-answer', 'answer.json').stderr).toContain('drop --prompt-out and --from-answer')
  })

  it('tells bootstrap the guidance kept in the data workspace when no guidance file is given', () => {
    const root = workspace()
    fs.writeFileSync(path.join(root, 'coaching/guidance.md'), 'Walk breaks by time only; stop on any pain.\n')
    const prompt = path.join(root, 'prompt.md')

    const result = spawnSync(process.execPath, nodeArgs('bootstrap', '--days', 'tue,thu,sat,sun', '--runs-per-week', '4', '--replace', '--data-dir', root, '--prompt-out', prompt), {
      cwd: projectRoot,
      encoding: 'utf-8',
      env: { ...process.env, RUNOMICS_DATA_REPO_URL: '' },
    })

    expect(result.stdout).toContain('Guidance: coaching/guidance.md')
    expect(fs.readFileSync(prompt, 'utf-8')).toContain('Additional athlete guidance (volume ranges are guidance, not mandatory quotas): Walk breaks by time only; stop on any pain.')
  })

  it('rejects a stale saved proposal before writing, then applies the exact reviewed proposal in an explicit data workspace once its context is restored', () => {
    const root = workspace()
    const preview = writeKeepReview(root, path.join(root, 'previews'))
    const planBefore = fs.readFileSync(path.join(root, 'coaching/current_plan.json'), 'utf-8')
    const athletePath = path.join(root, 'athlete.json')
    const athleteBytes = fs.readFileSync(athletePath)
    const athlete = JSON.parse(fs.readFileSync(athletePath, 'utf-8')) as Record<string, unknown>
    fs.writeFileSync(athletePath, JSON.stringify({ ...athlete, thresholdPaceSecPerKm: 999 }, null, 2))

    let result = spawnSync(process.execPath, nodeArgs('--apply', preview, '--data-dir', root), {
      cwd: projectRoot,
      encoding: 'utf-8',
      env: { ...process.env, RUNOMICS_DATA_REPO_URL: '' },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('context changed')
    expect(fs.readFileSync(path.join(root, 'coaching/current_plan.json'), 'utf-8')).toBe(planBefore)
    expect(new JsonCoachingRepository(root).getDecision('cli-1')).toBeNull()

    fs.writeFileSync(athletePath, athleteBytes)

    result = spawnSync(process.execPath, nodeArgs('--apply', preview, '--data-dir', root), {
      cwd: projectRoot,
      encoding: 'utf-8',
      env: { ...process.env, RUNOMICS_DATA_REPO_URL: '' },
    })

    const repository = new JsonCoachingRepository(root)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Applied KEEP')
    expect(repository.getDecision('cli-1')?.summary).toBe('Keep the reviewed plan.')
    expect(repository.getState()?.lastWeeklyReviewAt).toBe('2026-09-05T10:00:00.000Z')
  })
})
