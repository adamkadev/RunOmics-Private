#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { readProposalPreview, writeProposalPreview } from '@/application/coaching/preview'
import { renewalDefaults } from '@/domain/coaching/renewal'
import { appTodayIso } from '@/lib/calendarDate'
import { dataWorkspace, pushWorkspace, removeWorkspace } from './coachingWorkspace'
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
    '  npm run coach -- bootstrap --days tue,wed,thu,sat,sun --runs-per-week 5 [--race <id|name> | --general]',
    '  npm run coach -- bootstrap --days ... --runs-per-week 5 --from-answer answer.json',
    '  npm run coach -- evaluate --activity <id|latest> [--from-answer answer.json]',
    '  npm run coach -- weekly-review [--from-answer answer.json]',
    '  npm run coach -- autoregulate   (after each threshold session: proposes, never applies)',
    '  npm run coach -- --apply .coach-previews/<proposal>.json',
    '',
    'Options:',
    '  --data-dir <path>  Read/write an existing workspace without fetching or pushing it.',
    '  --runs-per-week <n> Normal desired runs, independently of available --days.',
    '                     With a current plan, --days, --runs-per-week and --start all',
    '                     default to it, so a renewal needs none of them.',
    '  --start <monday>   Write the new block from that Monday, at most a week out,',
    '                     keeping the current plan\'s sessions until then unchanged.',
    '  --general          Plan general preparation toward no race; races inside the',
    '                     block are run as supporting ones. The default with no race.',
    '  --guidance-file <path> Athlete instructions for bootstrap, in place of the data',
    '                     workspace\'s coaching/guidance.md (read by default).',
    '  --context-out <path> Save the compact bootstrap context for inspection.',
    '  --prompt-out <path> Where to write the coaching prompt for Claude Code',
    '                     (default: <out>/coach-prompt.md).',
    '  --from-answer <path> Build the proposal from the reply to that prompt, saved as JSON.',
    '  --advisor gemini   Ask Gemini (GEMINI_COACH_API_KEY) instead of writing the prompt.',
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

function fileOption(args: string[], name: string): string | undefined {
  const given = option(args, name)
  if (given === undefined) return undefined

  const resolved = path.resolve(given)
  if (!fs.existsSync(resolved)) throw new Error(`${name} ${given} does not exist (looked for ${resolved})`)
  return fs.readFileSync(resolved, 'utf-8')
}

function availableDays(raw: string | undefined, fallback: number[] | undefined): number[] {
  if (!raw) {
    if (fallback?.length) return fallback
    throw new Error('bootstrap requires --days (for example: --days tue,thu,sat,sun)')
  }
  const parsed = raw.split(',').map((day) => {
    const value = WEEKDAY[day.trim().toLowerCase()]
    if (value === undefined) throw new Error(`Unknown weekday: ${day}`)
    return value
  })
  return [...new Set(parsed)]
}

function requestedRuns(args: string[], fallback: number | undefined): number {
  const raw = option(args, '--runs-per-week')
  if (!raw) {
    if (fallback) return fallback
    throw new Error('bootstrap requires --runs-per-week independently of --days')
  }
  return Number(raw)
}

type AdvisorChoice =
  | { kind: 'manual'; promptPath: string; answerPath: string | undefined }
  | { kind: 'gemini' }

function advisorChoice(args: string[]): AdvisorChoice {
  const advisor = option(args, '--advisor') ?? 'manual'
  const promptOut = option(args, '--prompt-out')
  const answer = option(args, '--from-answer')

  if (advisor === 'gemini') {
    if (promptOut || answer) throw new Error('--advisor gemini asks the API; drop --prompt-out and --from-answer')
    return { kind: 'gemini' }
  }
  if (advisor !== 'manual') throw new Error(`Unknown --advisor ${advisor}: use gemini, or leave it out for the manual prompt`)

  const promptPath = path.resolve(promptOut ?? path.join(option(args, '--out') ?? '.coach-previews', 'coach-prompt.md'))
  return { kind: 'manual', promptPath, answerPath: answer ? path.resolve(answer) : undefined }
}

/** guidance.md keeps what a hand-guided block was told, so the next renewal is told it too. */
function bootstrapGuidance(args: string[], stored: string | null): string | undefined {
  const given = fileOption(args, '--guidance-file')
  if (given !== undefined) {
    console.log(`Guidance: ${option(args, '--guidance-file')}`)
    return given
  }
  console.log(stored === null ? 'Guidance: none (no coaching/guidance.md)' : 'Guidance: coaching/guidance.md')
  return stored ?? undefined
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
  const choice = advisorChoice(args)
  if (choice.kind === 'manual') fs.mkdirSync(path.dirname(choice.promptPath), { recursive: true })
  const advisor = choice.kind === 'manual' ? new ManualCoachingAdvisor(choice.promptPath, choice.answerPath) : new GeminiCoachingAdvisor()
  const currentPlan = repository.getCurrentPlan()

  if (command === 'bootstrap') {
    const referenceDate = option(args, '--reference-date') ?? appTodayIso()
    const context = await getCoachingContext(currentPlan, referenceDate)
    const contextOutput = option(args, '--context-out')
    if (contextOutput) fs.writeFileSync(path.resolve(contextOutput), JSON.stringify(context, null, 2) + '\n')
    const defaults = renewalDefaults(currentPlan, referenceDate)
    const days = availableDays(option(args, '--days'), defaults.availableWeekdays)
    const runs = requestedRuns(args, defaults.runsPerWeek)
    const start = option(args, '--start') ?? defaults.start
    const defaulted = [
      option(args, '--days') ? null : `--days ${days.join(',')}`,
      option(args, '--runs-per-week') ? null : `--runs-per-week ${runs}`,
      option(args, '--start') || !start ? null : `--start ${start}`,
    ].filter((part): part is string => part !== null)
    if (defaulted.length) console.log(`From the current plan: ${defaulted.join(' ')}`)
    return createBootstrapProposal(context, days, { advisor, repository }, option(args, '--race'), runs, bootstrapGuidance(args, repository.getGuidance()), args.includes('--replace'), args.includes('--general'), start)
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
    const referenceDate = option(args, '--reference-date') ?? appTodayIso()
    const context = await getCoachingContext(currentPlan, referenceDate)
    return createWeeklyReviewProposal(context, { advisor, repository })
  }

  throw new Error(`Unknown command: ${command}`)
}

async function applyPreview(args: string[], proposalPath: string): Promise<void> {
  const workspace = await dataWorkspace(option(args, '--data-dir'), true)
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

    if (workspace.shouldPush) await pushWorkspace(workspace)
    console.log(`Applied ${proposal.decision.outcome}; coaching plan is now revision ${plan.revision}.`)
    if (workspace.shouldPush) console.log('Private coaching data pushed. Deployment was not triggered.')
  } finally {
    removeWorkspace(workspace)
  }
}

const pace = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`

/** Nothing is applied: each preview is applied, or not, by hand with --apply. */
async function autoregulate(args: string[]): Promise<void> {
  const { JsonCoachingRepository } = await interopImport(import('@/infrastructure/repositories/JsonCoachingRepository'))
  const { getAllActivities } = await interopImport(import('@/infrastructure/repositories/JsonActivityRepository'))
  const { getCoachingContext } = await interopImport(import('@/application/coaching/GetCoachingContext'))
  const { autoregulationReport, fatigueBasis } = await interopImport(import('@/application/coaching/autoregulation'))
  const { createAutoregulationProposal } = await interopImport(import('@/application/coaching/workflows'))
  const { CONTROLLED_THRESHOLD, controlledThresholdHr } = await interopImport(import('@/application/coaching/controlledThreshold'))
  const { getAthleteProfile } = await interopImport(import('@/infrastructure/repositories/JsonAthleteRepository'))
  const { getOfficialRaceResults } = await interopImport(import('@/infrastructure/repositories/JsonRaceResultRepository'))

  const repository = new JsonCoachingRepository(process.env.RUNOMICS_DATA_DIR)
  const plan = repository.getCurrentPlan()
  if (!plan) throw new Error('No current coaching plan exists')
  const referenceDate = option(args, '--reference-date') ?? appTodayIso()
  const report = autoregulationReport(getAllActivities(), [plan, ...repository.getArchivedPlans()], referenceDate, getOfficialRaceResults())

  const hr = controlledThresholdHr(getAthleteProfile().lthrBpm)
  console.log(hr
    ? `\nFrom LTHR ${hr.lthrBpm}: ceiling ${hr.ceilingBpm}, target ${hr.targetBpm.long} long / ${hr.targetBpm.medium} medium / ${hr.targetBpm.short} short.`
    : '\nNo lactate threshold heart rate in the athlete data, so a new block gets no controlled threshold sessions.')
  console.log(`\nControlled threshold sessions in the last ${CONTROLLED_THRESHOLD.fatigue.lookbackDays} days (heart rate from minute 3, against the ceiling each prescribed):`)
  if (report.controlledSessions.length === 0) console.log('  none read yet')
  for (const session of report.controlledSessions) {
    const reps = session.reps.map((rep) => `${rep.windowHr} @ ${pace(rep.paceSecPerKm)}`).join(', ')
    const temperature = session.tempC === null ? '' : `, ${session.tempC} °C`
    console.log(`  ${session.date} ${session.repClass.padEnd(6)} guide ${pace(session.guide.min)}-${pace(session.guide.max)}  ${reps || 'no repetitions read'}${temperature}  target ${session.targetHr} / ceiling ${session.ceilingHr}: ${session.verdict}`)
  }

  const fatigue = report.fatigue
  if (fatigue) {
    const gap = fatigue.run.gapSecPerKm === null ? '' : ` (${pace(fatigue.run.gapSecPerKm)} grade-adjusted)`
    const run = `${fatigue.run.date} easy run ${fatigue.run.hr} bpm at ${pace(fatigue.run.paceSecPerKm)}${gap}${fatigue.run.tempC === null ? '' : `, ${fatigue.run.tempC} °C`}`
    console.log(fatigue.normalHr === null
      ? `\nFatigue: ${run} - ${fatigue.comparables} similar run(s), ${CONTROLLED_THRESHOLD.fatigue.minComparables} needed to judge`
      : `\nFatigue: ${run} against a normal of ${fatigue.normalHr} over ${fatigue.comparables} runs at similar ${fatigueBasis(fatigue)} - ${fatigue.flagged ? 'FLAGGED' : 'fine'}`)
    for (const left of fatigue.leftOut) {
      console.log(`  ${left.date}: climbed ${Math.round(left.climbMPerKm ?? 0)} m/km with no grade-adjusted pace, so its pace says little about effort - left out`)
    }
  }

  const check = report.fitnessCheck
  if (check) {
    const moved = check.previous ? ` (${pace(check.previous.paceSecPerKm)}/km on ${check.previous.date})` : ' - the first check, so the baseline'
    console.log(`\nFitness check: 5K on ${check.date} at ${pace(check.paceSecPerKm)}/km${moved}; it implies a threshold of ${pace(check.impliedThresholdSecPerKm)}/km`)
    for (const { repClass, guide, proposedGuide } of check.proposedGuides) {
      console.log(`  proposed ${repClass} guide: ${pace(guide.min)}-${pace(guide.max)} -> ${pace(proposedGuide.min)}-${pace(proposedGuide.max)} (for the next block)`)
    }
  }

  const changes = [
    ...report.guideProposals.map((proposal) => ({ kind: 'pace_guide' as const, proposal })),
    ...(fatigue?.flagged ? [{ kind: 'lighter_week' as const, fatigue }] : []),
  ]
  if (changes.length === 0) {
    console.log('\nNothing to propose.')
    return
  }
  const context = await getCoachingContext(plan, referenceDate)
  const outputDir = path.resolve(option(args, '--out') ?? '.coach-previews')
  for (const change of changes) {
    const proposal = createAutoregulationProposal(context, { repository }, change)
    if (proposal) printProposal(writeProposalPreview(proposal, outputDir), proposal)
    else console.log(`\n${change.kind}: nothing left in the plan for it to change.`)
  }
  if (changes.length > 1) console.log('\nEach preview is built on the current plan: apply one, then run autoregulate again for the next.')
}

function isPromptWritten(error: unknown): error is { promptPath: string } {
  return error instanceof Error && error.name === 'ManualPromptWritten'
}

function printPasteInstructions(promptPath: string, answerPath: string | undefined): void {
  const bytes = fs.statSync(promptPath).size
  console.log(`\nCoaching prompt written to ${promptPath} (${Math.ceil(bytes / 1024)} KB).`)
  if (answerPath) {
    console.log('The answer was rejected; the prompt above now carries the reason.')
    console.log(`Hand it to Claude Code again and overwrite ${answerPath} with the corrected reply.`)
  } else {
    console.log('Hand it to Claude Code, save the JSON reply, then run the same command again with:')
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

  const workspace = await dataWorkspace(option(args, '--data-dir'), false)
  try {
    process.env.RUNOMICS_DATA_DIR = workspace.root
    if (args[0] === 'autoregulate') {
      await autoregulate(args)
      return
    }
    const proposal = await createProposal(args[0]!, args)
    const outputDir = path.resolve(option(args, '--out') ?? '.coach-previews')
    printProposal(writeProposalPreview(proposal, outputDir), proposal)
  } catch (error) {
    if (!isPromptWritten(error)) throw error
    printPasteInstructions(error.promptPath, option(args, '--from-answer'))
  } finally {
    removeWorkspace(workspace)
  }
}

main().catch((error) => {
  console.error(`Coaching command failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
