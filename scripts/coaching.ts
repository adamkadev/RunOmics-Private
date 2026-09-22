#!/usr/bin/env node
import fs from 'fs'
import os from 'os'
import path from 'path'
import { readProposalPreview, writeProposalPreview } from '@/application/coaching/preview'
import { interopImport } from './interopImport'

const WEEKDAY: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

function usage(): string {
  return [
    'RunOmics coaching preview/apply',
    '',
    '  npm run coach -- bootstrap --days tue,wed,thu,sat,sun --runs-per-week 5 [--race <id|name>]',
    '  npm run coach -- bootstrap --days ... --runs-per-week 5 --prompt-out coach-prompt.md',
    '  npm run coach -- bootstrap --days ... --runs-per-week 5 --from-answer answer.json',
    '  npm run coach -- evaluate --activity <id|latest>',
    '  npm run coach -- weekly-review',
    '  npm run coach -- --apply .coach-previews/<proposal>.json',
    '',
    'Options:',
    '  --data-dir <path>  Read/write an existing workspace without fetching or pushing it.',
    '  --runs-per-week <n> Normal desired runs, independently of available --days.',
    '  --guidance-file <path> Additional athlete instructions for bootstrap.',
    '  --context-out <path> Save the compact bootstrap context for inspection.',
    '  --prompt-out <path> Write the coaching prompt to paste into a chat instead of calling the API.',
    '  --from-answer <path> Build the proposal from a chat reply saved as JSON.',
    '  --reference-date <YYYY-MM-DD> Reproduce coaching at a specified date.',
    '  --replace          Supersede the active plan instead of refusing. The outgoing',
    '                     plan is kept under coaching/superseded/.',
    '  --out <path>       Directory for preview files (default: .coach-previews).',
  ].join('\n')
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

/** A path that is not there should name the flag that asked for it. */
function fileOption(args: string[], name: string): string | undefined {
  const given = option(args, name)
  if (given === undefined) return undefined

  const resolved = path.resolve(given)
  if (!fs.existsSync(resolved)) throw new Error(`${name} ${given} does not exist (looked for ${resolved})`)
  return fs.readFileSync(resolved, 'utf-8')
}

function availableDays(raw: string | undefined): number[] {
  if (!raw) throw new Error('bootstrap requires --days (for example: --days tue,thu,sat,sun)')
  const parsed = raw.split(',').map((day) => {
    const value = WEEKDAY[day.trim().toLowerCase()]
    if (value === undefined) throw new Error(`Unknown weekday: ${day}`)
    return value
  })
  return [...new Set(parsed)]
}

function requestedRuns(args: string[]): number {
  const raw = option(args, '--runs-per-week')
  if (!raw) throw new Error('bootstrap requires --runs-per-week independently of --days')
  return Number(raw)
}

interface ManualPaths {
  promptPath: string
  answerPath: string | undefined
}

/** The prompt is only needed again if a pasted answer is rejected, so it has a default. */
function manualPaths(args: string[]): ManualPaths | undefined {
  const promptOut = option(args, '--prompt-out')
  const answer = option(args, '--from-answer')
  if (!promptOut && !answer) return undefined

  const promptPath = path.resolve(promptOut ?? path.join(option(args, '--out') ?? '.coach-previews', 'coach-prompt.md'))
  fs.mkdirSync(path.dirname(promptPath), { recursive: true })
  return { promptPath, answerPath: answer ? path.resolve(answer) : undefined }
}

interface DataWorkspace {
  root: string
  temporaryRoot?: string
  shouldPush: boolean
}

async function dataWorkspace(args: string[], applying: boolean): Promise<DataWorkspace> {
  const explicit = option(args, '--data-dir') ?? process.env.RUNOMICS_DATA_DIR?.trim()
  if (explicit) return { root: path.resolve(explicit), shouldPush: false }

  if (process.env.RUNOMICS_DATA_REPO_URL) {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'runomics-coach-'))
    const root = path.join(temporaryRoot, 'data')
    const { fetchPrivateData } = await interopImport(import('./fetch_private_data.mjs'))
    fetchPrivateData(root)
    return { root, temporaryRoot, shouldPush: applying }
  }

  if (applying) throw new Error('--apply requires private data repository credentials or an explicit --data-dir workspace')
  return { root: path.join(process.cwd(), 'data'), shouldPush: false }
}

function printProposal(filePath: string, proposal: Awaited<ReturnType<typeof createProposal>>): void {
  console.log(`\n${proposal.decision.outcome}: ${proposal.decision.summary}`)
  for (const evidence of proposal.decision.evidence) console.log(`- ${evidence.message}`)
  console.log(`Changes: ${proposal.decision.changes.length}`)
  console.log(`Preview saved to ${filePath}`)
  console.log(`Apply this exact proposal with:\n  npm run coach -- --apply ${filePath}`)
}

async function createProposal(command: string, args: string[]) {
  const { JsonCoachingRepository } = await interopImport(import('@/infrastructure/repositories/JsonCoachingRepository'))
  const { GeminiCoachingAdvisor } = await interopImport(import('@/infrastructure/ai/GeminiCoachingAdvisor'))
  const { ManualCoachingAdvisor } = await interopImport(import('@/infrastructure/ai/ManualCoachingAdvisor'))
  const { getCoachingContext } = await interopImport(import('@/application/coaching/GetCoachingContext'))
  const { createBootstrapProposal, createPostActivityProposal, createWeeklyReviewProposal } = await interopImport(import('@/application/coaching/workflows'))
  const { getAllActivities } = await interopImport(import('@/infrastructure/repositories/JsonActivityRepository'))

  const repository = new JsonCoachingRepository(process.env.RUNOMICS_DATA_DIR)
  const manual = manualPaths(args)
  const advisor = manual ? new ManualCoachingAdvisor(manual.promptPath, manual.answerPath) : new GeminiCoachingAdvisor()
  const currentPlan = repository.getCurrentPlan()

  if (command === 'bootstrap') {
    const referenceDate = option(args, '--reference-date') ?? new Date().toISOString().slice(0, 10)
    const context = await getCoachingContext(currentPlan, referenceDate)
    const contextOutput = option(args, '--context-out')
    if (contextOutput) fs.writeFileSync(path.resolve(contextOutput), JSON.stringify(context, null, 2) + '\n')
    return createBootstrapProposal(context, availableDays(option(args, '--days')), { advisor, repository }, option(args, '--race'), requestedRuns(args), fileOption(args, '--guidance-file'), args.includes('--replace'))
  }

  if (command === 'evaluate') {
    const requested = option(args, '--activity')
    if (!requested) throw new Error('evaluate requires --activity <id|latest>')
    const activities = getAllActivities()
    const activity = requested === 'latest' ? activities[0] : activities.find((candidate) => candidate.id === requested)
    if (!activity) throw new Error(`Activity not found: ${requested}`)
    const context = await getCoachingContext(currentPlan, activity.date.slice(0, 10))
    return createPostActivityProposal(context, activity, { advisor, repository })
  }

  if (command === 'weekly-review') {
    const referenceDate = option(args, '--reference-date') ?? new Date().toISOString().slice(0, 10)
    const context = await getCoachingContext(currentPlan, referenceDate)
    return createWeeklyReviewProposal(context, { advisor, repository })
  }

  throw new Error(`Unknown command: ${command}`)
}

async function applyPreview(args: string[], proposalPath: string): Promise<void> {
  const workspace = await dataWorkspace(args, true)
  try {
    process.env.RUNOMICS_DATA_DIR = workspace.root
    const { JsonCoachingRepository } = await interopImport(import('@/infrastructure/repositories/JsonCoachingRepository'))
    const { getCoachingContext } = await interopImport(import('@/application/coaching/GetCoachingContext'))
    const { coachingContextHash } = await interopImport(import('@/application/coaching/context'))
    const { applyCoachingProposal } = await interopImport(import('@/application/coaching/workflows'))
    const proposal = readProposalPreview(path.resolve(proposalPath))
    const repository = new JsonCoachingRepository(workspace.root)
    const context = await getCoachingContext(repository.getCurrentPlan(), proposal.referenceDate)
    const plan = applyCoachingProposal(proposal, repository, coachingContextHash(context))

    if (workspace.shouldPush) {
      const { pushPrivateData } = await interopImport(import('./push_private_data.mjs'))
      pushPrivateData(workspace.root)
    }
    console.log(`Applied ${proposal.decision.outcome}; coaching plan is now revision ${plan.revision}.`)
    if (workspace.shouldPush) console.log('Private coaching data pushed. Deployment was not triggered.')
  } finally {
    if (workspace.temporaryRoot) fs.rmSync(workspace.temporaryRoot, { recursive: true, force: true })
  }
}

function isPromptWritten(error: unknown): error is { promptPath: string } {
  return error instanceof Error && error.name === 'ManualPromptWritten'
}

function printPasteInstructions(promptPath: string, answerPath: string | undefined): void {
  const bytes = fs.statSync(promptPath).size
  console.log(`\nCoaching prompt written to ${promptPath} (${Math.ceil(bytes / 1024)} KB).`)
  if (answerPath) {
    console.log('The pasted plan was rejected; the prompt above now carries the reason.')
    console.log(`Paste it into the same chat and overwrite ${answerPath} with the corrected reply.`)
  } else {
    console.log('Paste it into a chat, save the JSON reply, then run the same command again with:')
    console.log('  --from-answer <path to the saved reply>')
  }
  console.log('It contains your health data - keep it out of anything you would not trust with that.')
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(usage())
    return
  }

  const applyIndex = args.indexOf('--apply')
  if (applyIndex >= 0) {
    const proposalPath = args[applyIndex + 1]
    if (!proposalPath) throw new Error('--apply requires a proposal file')
    await applyPreview(args, proposalPath)
    return
  }

  const workspace = await dataWorkspace(args, false)
  try {
    process.env.RUNOMICS_DATA_DIR = workspace.root
    const proposal = await createProposal(args[0]!, args)
    const outputDir = path.resolve(option(args, '--out') ?? '.coach-previews')
    printProposal(writeProposalPreview(proposal, outputDir), proposal)
  } catch (error) {
    if (!isPromptWritten(error)) throw error
    printPasteInstructions(error.promptPath, option(args, '--from-answer'))
  } finally {
    if (workspace.temporaryRoot) fs.rmSync(workspace.temporaryRoot, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(`Coaching command failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
